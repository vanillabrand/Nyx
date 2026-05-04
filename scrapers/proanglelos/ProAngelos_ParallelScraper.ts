import axios from 'axios';
import * as cheerio from 'cheerio';
import pLimit from 'p-limit';
import fs from 'fs';
import path from 'path';
import { ProxyService } from '../../src/services/ProxyService.ts';
import type { ScrapeMission, ScrapedIncident } from './PayloadSchema.ts';
import patterns from '../../src/constants/aviation_patterns.json' with { type: 'json' };
import airportLookup from '../../src/constants/airport_lookup.json' with { type: 'json' };

export class ProAngelos_ParallelScraper {
  private mission: ScrapeMission;
  private limit: any;

  constructor(mission: ScrapeMission) {
    this.mission = mission;
    this.limit = pLimit(this.mission.engine_config.concurrency);
  }

  private async safeRequest(url: string, retries = 3): Promise<any> {
    const axiosConfig = ProxyService.getAxiosConfig(url);
    for (let i = 0; i < retries; i++) {
      try {
        return await axios.get(url, {
          ...axiosConfig,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Referer': 'https://avherald.com/',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          },
          timeout: 45000
        });
      } catch (e: any) {
        if (i === retries - 1) throw e;
        console.warn(`⚠️ [HUD] Connection retry ${i + 1}/3 for ${url}`);
        await new Promise(r => setTimeout(r, 5000));
      }
    }
  }

  async execute() {
    console.log(`[${this.mission.mission_id}] ⚡ Starting mission (DIRECT LINK MODE)...`);
    const targetsData = await Promise.all(this.mission.targets.map(target => this.processTarget(target)));
    const flatTargets = targetsData.flat().filter(Boolean);
    
    console.log(`[${this.mission.mission_id}] 📡 Found ${flatTargets.length} records. Deep hydration active...`);

    const hydratedResults = await Promise.all(
      flatTargets.map(incident => 
        this.limit(async () => {
          try {
            const details = await this.scrapeDetails(incident.url);
            return { ...incident, ...details };
          } catch (e) {
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

    this.saveResults(Array.from(uniqueMap.values()));
    return Array.from(uniqueMap.values());
  }

  private async processTarget(baseUrl: string) {
    if (baseUrl.includes('article=')) return [await this.limit(() => this.scrapeDetails(baseUrl))];
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
      if (response.data.includes('closed access to proxies')) {
        throw new Error('PROXY_BLOCKED');
      }
      
      const $ = cheerio.load(response.data);
      const headline = ($('span.headline_article').first().text() || $('span.headline').first().text() || $('title').text()).trim();
      let narrative = $('span.sitetext').first().text().trim();
      
      if (!narrative || narrative.length < 50) {
        $('td').each((_, td) => {
          const text = $(td).text();
          if (text.includes('By Simon Hradecky') && text.length > 200) {
            const splitIdx = text.indexOf('Z)');
            narrative = splitIdx !== -1 ? text.substring(splitIdx + 2).trim() : text.split('Simon Hradecky')[1]?.trim() || text;
            return false;
          }
        });
      }

      let metar = '';
      const metarMatch = response.data.match(/Metars:<\/span>\s*([^<]+)/i);
      if (metarMatch) metar = metarMatch[1].trim();

      const lookupIATA = (name: string) => {
        if (!name || name === 'UNKNOWN') return 'UNK';
        const clean = name.toLowerCase().replace(/[\(\)].*$/, '').trim();
        if ((airportLookup as any)[clean]) return (airportLookup as any)[clean];
        const parts = clean.split(/[,\s]+/);
        for (const part of parts) {
          if (part.length < 3) continue;
          if ((airportLookup as any)[part]) return (airportLookup as any)[part];
        }
        return clean.substring(0, 3).toUpperCase();
      };

      const aircraft = (patterns.aircraft as string[]).find(a => headline.toUpperCase().includes(a.toUpperCase())) || 'UNKNOWN';
      const airline = (patterns.airlines as string[]).find(a => headline.toUpperCase().includes(a.toUpperCase())) || 'UNKNOWN';
      
      let departure = 'UNKNOWN';
      let destination = 'UNKNOWN';
      const routeMatch = narrative.match(/(?:from|dep|departing)\s+([^,]+(?:,[^,]+)?)\s+(?:to|arr|arriving)\s+([^,]+(?:,[^,]+)?)/i);
      if (routeMatch) {
        departure = lookupIATA(routeMatch[1].split('performing')[0].trim());
        destination = lookupIATA(routeMatch[2].split('with')[0].trim());
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
    } catch (e: any) { 
      console.error(`❌ [HUD] Hydration failed: ${url} (${e.message})`);
      return { meta: { departure: 'UNK', destination: 'UNK' } }; 
    }
  }

  private saveResults(data: any[]) {
    fs.writeFileSync(path.join(process.cwd(), 'public/data/incidents.json'), JSON.stringify(data, null, 2));
    fs.writeFileSync(path.join(process.cwd(), 'public/data/automation_log.json'), JSON.stringify({ last_sync: new Date().toISOString(), status: 'ACTIVE' }, null, 2));
  }
}
