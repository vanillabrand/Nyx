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

  private async safeRequest(url: string, retries = 3): Promise<any> {
    const axiosConfig = ProxyService.getAxiosConfig();
    for (let i = 0; i < retries; i++) {
      try {
        return await axios.get(url, {
          ...axiosConfig,
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
          timeout: 30000
        });
      } catch (e: any) {
        if (i === retries - 1) throw e;
        console.warn(`⚠️ [HUD] Connection retry ${i + 1}/3 for ${url}`);
        await new Promise(r => setTimeout(r, 2000));
      }
    }
  }

  async execute() {
    console.log(`[${this.mission.mission_id}] ⚡ Starting high-velocity mission...`);
    const targetsData = await Promise.all(this.mission.targets.map(target => this.processTarget(target)));
    const flatTargets = targetsData.flat().filter(Boolean);
    
    console.log(`[${this.mission.mission_id}] 📡 Found ${flatTargets.length} index records. Hydrating deep intelligence...`);

    const hydratedResults = await Promise.all(
      flatTargets.map(incident => 
        this.limit(async () => {
          try {
            const details = await this.scrapeDetails(incident.url);
            return { ...incident, ...details };
          } catch (e) {
            console.error(`❌ [HUD] Hydration failed: ${incident.url}`);
            return incident;
          }
        })
      )
    );
    
    const uniqueMap = new Map<string, ScrapedIncident>();
    hydratedResults.filter(Boolean).forEach((incident: any) => {
      const id = String(incident.source_id).toUpperCase();
      if (!uniqueMap.has(id)) uniqueMap.set(id, incident);
    });

    const flattened = Array.from(uniqueMap.values());
    this.saveResults(flattened);
    console.log(`[${this.mission.mission_id}] 🎯 Mission accomplished. Unique records: ${flattened.length}`);
    return flattened;
  }

  private async processTarget(baseUrl: string) {
    if (baseUrl.includes('article=')) {
      return [await this.limit(() => this.scrapeDetails(baseUrl))];
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
    try {
      const response = await this.safeRequest(url);
      const $ = cheerio.load(response.data);
      const pageIncidents: ScrapedIncident[] = [];
      let currentDate = '';

      $('tr').each((_, tr) => {
        const text = $(tr).text().trim();
        if (text.match(/^[A-Z][a-z]+ [A-Z][a-z]+ \d{1,2}(?:st|nd|rd|th)? \d{4}/i)) {
          currentDate = text;
          return;
        }

        const link = $(tr).find('a[href*="article="]');
        const headlineSpan = $(tr).find('span.headline, span.headline_avherald');
        
        if (link.length > 0 && headlineSpan.length > 0) {
          pageIncidents.push({
            source_id: link.attr('href')?.split('article=')[1]?.split('&')[0] || '',
            occurred_at: currentDate || 'RECENT',
            headline: headlineSpan.text().trim(),
            url: `https://avherald.com${link.attr('href')}`,
            source: 'AVHERALD'
          });
        }
      });
      return pageIncidents;
    } catch { return []; }
  }

  private async scrapeDetails(url: string) {
    try {
      const response = await this.safeRequest(url);
      const $ = cheerio.load(response.data);
      
      // Clinical Production Selectors
      const headline = ($('span.headline_article').first().text() || $('span.headline').first().text() || $('title').text()).trim();
      
      // Robust Narrative Extraction: Find the main article cell
      let narrative = '';
      let metar = '';

      // AVHerald usually puts narrative in a <td> containing "By Simon Hradecky"
      $('td').each((_, td) => {
        const html = $(td).html() || '';
        if (html.includes('By Simon Hradecky') && html.length > 200) {
          // Extract narrative (everything after the timestamp/author)
          const text = $(td).text();
          const splitIdx = text.indexOf('Z)');
          if (splitIdx !== -1) {
            narrative = text.substring(splitIdx + 2).trim();
          } else {
            narrative = text.split('Simon Hradecky')[1]?.trim() || text;
          }
          
          // Extract METAR
          if (html.includes('Metars:')) {
            const metarPart = html.split('Metars:')[1]?.split('<')[0] || '';
            metar = metarPart.trim();
          }
          return false; // Found it
        }
      });

      // fallback to any span with narrative-like content
      if (!narrative) {
        narrative = ($('span.article_text').text() || $('span.article_avherald').text() || '').trim();
      }

      // 1. Hardened Entity Recognition
      const findEntity = (list: string[], text: string) => {
        let bestMatch = null;
        let earliestPos = Infinity;
        for (const item of list) {
          if (item.length < 3) continue;
          const idx = text.toUpperCase().indexOf(item.toUpperCase());
          if (idx !== -1 && idx < earliestPos) {
            earliestPos = idx;
            bestMatch = item;
          }
        }
        return bestMatch;
      };

      const aircraft = findEntity(patterns.aircraft, headline) || 'UNKNOWN';
      const airline = findEntity(patterns.airlines, headline) || 'UNKNOWN';
      
      // 2. Flight Path Intelligence (Regex Extraction from Narrative)
      let departure = 'UNKNOWN';
      let destination = 'UNKNOWN';
      const routeMatch = narrative.match(/(?:from|dep|departing)\s+([A-Z][a-z\s,.\-()]{3,40})\s+(?:to|arr|arriving)\s+([A-Z][a-z\s,.\-()]{3,40})/i);
      
      if (routeMatch) {
        departure = routeMatch[1].split(',')[0].split('(')[0].trim().toUpperCase();
        destination = routeMatch[2].split(',')[0].split('(')[0].trim().toUpperCase();
      }

      return {
        meta: {
          narrative: narrative.substring(0, 3000),
          metar: metar,
          aircraft_type: aircraft,
          operator: airline,
          severity: headline.toLowerCase().includes('accident') ? 'ACCIDENT' : 'INCIDENT',
          departure,
          destination
        }
      };
    } catch { 
      return { meta: { departure: 'UNKNOWN', destination: 'UNKNOWN' } };
    }
  }

  private saveResults(data: any[]) {
    const finalPath = path.join(process.cwd(), 'public', 'data', 'incidents.json');
    fs.writeFileSync(finalPath, JSON.stringify(data, null, 2));
    
    const logPath = path.join(process.cwd(), 'public', 'data', 'automation_log.json');
    fs.writeFileSync(logPath, JSON.stringify({
      last_sync: new Date().toISOString(),
      status: 'ACTIVE'
    }, null, 2));
  }
}
