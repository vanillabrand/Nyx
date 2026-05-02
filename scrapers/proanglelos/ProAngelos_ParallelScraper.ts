import axios from 'axios';
import * as cheerio from 'cheerio';
import pLimit from 'p-limit';
import fs from 'fs';
import path from 'path';
import { ProxyService } from '../../src/services/ProxyService.ts';
import type { ScrapeMission, ScrapedIncident } from './PayloadSchema.ts';
import patterns from '../../src/constants/aviation_patterns.json' with { type: 'json' };

export class ProAngelos_ParallelScraper {
  private mission: ScrapeMission;
  private limit: any;

  constructor(mission: ScrapeMission) {
    this.mission = mission;
    this.limit = pLimit(this.mission.engine_config.concurrency);
  }

  async execute() {
    console.log(`[${this.mission.mission_id}] ⚡ Starting high-velocity mission...`);
    const tasks = this.mission.targets.map(target => this.processTarget(target));
    const results = await Promise.all(tasks);
    
    const uniqueMap = new Map<string, ScrapedIncident>();
    results.flat().filter(Boolean).forEach(incident => {
      if (!uniqueMap.has(incident.source_id)) {
        uniqueMap.set(incident.source_id, incident);
      }
    });

    const flattened = Array.from(uniqueMap.values());
    this.saveResults(flattened);
    console.log(`[${this.mission.mission_id}] 🎯 Mission accomplished. Total unique records: ${flattened.length}`);
    return flattened;
  }

  private async processTarget(baseUrl: string) {
    if (baseUrl.includes('article=')) {
      return [await this.limit(() => this.scrapeDetails(baseUrl, true))];
    }
    const pagePromises = [];
    for (let p = 1; p <= this.mission.engine_config.depth_per_url; p++) {
      const pageUrl = baseUrl.includes('?') ? `${baseUrl}&page=${p}` : `${baseUrl}?page=${p}`;
      pagePromises.push(this.limit(() => this.scrapeIndexPage(pageUrl)));
    }
    const pagesData = await Promise.all(pagePromises);
    return pagesData.flat().filter(Boolean);
  }

  private async scrapeIndexPage(url: string): Promise<ScrapedIncident[]> {
    const axiosConfig = ProxyService.getAxiosConfig();
    try {
      const response = await axios.get(url, { 
        ...axiosConfig, 
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
        timeout: this.mission.engine_config.timeout_ms 
      });
      const $ = cheerio.load(response.data);
      const pageIncidents: ScrapedIncident[] = [];
      let currentDate = '';

      $('td').each((_, td) => {
        const span = $(td).find('span.headline_avherald');
        if (span.length > 0) {
          const link = $(td).find('a[href^="/h?article="]');
          if (link.length > 0) {
            pageIncidents.push({
              source_id: link.attr('href')?.split('article=')[1]?.split('&')[0] || '',
              occurred_at: currentDate,
              headline: span.text().trim(),
              url: `https://avherald.com${link.attr('href')}`,
              source: 'AVHERALD'
            });
          } else {
            currentDate = span.text().trim();
          }
        }
      });
      return pageIncidents;
    } catch { return []; }
  }

  private async scrapeDetails(url: string, isFullIncident = false) {
    const axiosConfig = ProxyService.getAxiosConfig();
    try {
      const response = await axios.get(url, { 
        ...axiosConfig, 
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
        timeout: this.mission.engine_config.timeout_ms 
      });
      const $ = cheerio.load(response.data);
      
      // Use refined article-specific selectors
      const headline = $('span.headline_article').first().text().trim();
      const narrative = $('span.article_avherald').first().text().trim();
      const metar = $('span.brief_avherald').first().text().trim();
      const fullText = `${headline} ${narrative}`;

      // 1. Precise Date Extraction (look for "on Month DDth YYYY" in headline)
      let occurred_at = '';
      const dateMatch = headline.match(/on\s+([A-Z][a-z]{2}\s+\d{1,2}(?:st|nd|rd|th)?\s+\d{4})/i);
      if (dateMatch) {
        occurred_at = dateMatch[1];
      } else {
        // Fallback: look in metadata lines
        $('td').each((_, td) => {
          const text = $(td).text();
          if (text.startsWith('Date:')) occurred_at = text.replace('Date:', '').trim();
        });
      }

      // 2. Hardened Entity Extraction
      const findEntity = (list: string[]) => {
        for (const item of list) {
          if (item.length < 3) continue; // Skip too-short patterns
          const escaped = item.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const regex = new RegExp(`\\b${escaped}\\b`, 'i');
          if (regex.test(fullText)) return item;
        }
        return null;
      };

      const aircraft = findEntity(patterns.aircraft);
      const airline = findEntity(patterns.airlines);
      
      // 3. ICAO Airport Detection
      const icaoMatch = fullText.match(/\b([A-Z]{4})\b/g);
      const airport_icao = icaoMatch ? icaoMatch[0] : null;

      // 4. Severity Class Detection
      let severity = 'Incident';
      if (headline.toLowerCase().includes('accident')) severity = 'Accident';
      else if (headline.toLowerCase().includes('serious incident')) severity = 'Serious Incident';
      else if (headline.toLowerCase().includes('crash')) severity = 'Accident';

      return {
        source_id: url.split('article=')[1]?.split('&')[0] || '',
        occurred_at: occurred_at || '',
        headline,
        url,
        source: 'AVHERALD',
        meta: {
          narrative: narrative.substring(0, 2000), // Larger narrative capture
          metar,
          aircraft_type: aircraft,
          operator: airline,
          airport_icao,
          severity
        }
      };
    } catch { return isFullIncident ? null : {}; }
  }

  private saveResults(data: any[]) {
    const outPath = path.resolve(this.mission.output_settings.path);
    if (!fs.existsSync(outPath)) fs.mkdirSync(outPath, { recursive: true });
    fs.writeFileSync(path.join(outPath, `${this.mission.mission_id}_${Date.now()}.json`), JSON.stringify(data, null, 2));
  }
}
