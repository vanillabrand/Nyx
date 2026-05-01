import axios from 'axios';
import * as cheerio from 'cheerio';
import pLimit from 'p-limit';
import fs from 'fs';
import path from 'path';
import { ProxyService } from '../../src/services/ProxyService';
import { ScrapeMission, ScrapedIncident } from './PayloadSchema';

export class ProAngelos_ParallelScraper {
  private mission: ScrapeMission;
  private limit: any;

  constructor(mission: ScrapeMission) {
    this.mission = mission;
    this.limit = pLimit(this.mission.engine_config.concurrency);
  }

  /**
   * Execute the mission
   */
  async execute() {
    console.log(`[${this.mission.mission_id}] ⚡ Starting high-velocity mission...`);
    
    const tasks = this.mission.targets.map(target => 
      this.processTarget(target)
    );

    const results = await Promise.all(tasks);
    const flattened = results.flat().filter(Boolean);

    this.saveResults(flattened);
    console.log(`[${this.mission.mission_id}] 🎯 Mission accomplished. Total records: ${flattened.length}`);
    return flattened;
  }

  private async processTarget(baseUrl: string) {
    const targetResults: ScrapedIncident[] = [];
    const pagePromises = [];

    for (let p = 1; p <= this.mission.engine_config.depth_per_url; p++) {
      const pageUrl = baseUrl.includes('?') 
        ? `${baseUrl}&page=${p}` 
        : `${baseUrl}?page=${p}`;
      
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
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept-Encoding': 'gzip, deflate, br'
        },
        timeout: this.mission.engine_config.timeout_ms
      });

      const $ = cheerio.load(response.data);
      const pageIncidents: ScrapedIncident[] = [];
      let currentDate = '';

      const rows = $('td');
      const extractionTasks: any[] = [];

      rows.each((_, td) => {
        const span = $(td).find('span.headline_avherald');
        if (span.length > 0) {
          const link = $(td).find('a[href^="/h?article="]');
          if (link.length > 0) {
            const headline = span.text().trim();
            const href = link.attr('href');
            const source_id = href?.split('article=')[1]?.split('&')[0] || '';
            const fullUrl = href ? `https://avherald.com${href}` : '';

            const incident: ScrapedIncident = {
              source_id,
              occurred_at: currentDate,
              headline,
              url: fullUrl,
              source: 'AVHERALD'
            };

            if (this.mission.extraction_mode === 'FULL' && fullUrl) {
              extractionTasks.push(this.limit(async () => {
                const details = await this.scrapeDetails(fullUrl);
                incident.meta = { ...incident.meta, ...details };
                return incident;
              }));
            } else {
              pageIncidents.push(incident);
            }
          } else {
            currentDate = span.text().trim();
          }
        }
      });

      if (extractionTasks.length > 0) {
        const detailedIncidents = await Promise.all(extractionTasks);
        return detailedIncidents;
      }

      return pageIncidents;
    } catch (error: any) {
      console.error(`[Scraper] ❌ Error fetching ${url}: ${error.message}`);
      return [];
    }
  }

  private async scrapeDetails(url: string) {
    const axiosConfig = ProxyService.getAxiosConfig();
    try {
      const response = await axios.get(url, { ...axiosConfig, timeout: this.mission.engine_config.timeout_ms });
      const $ = cheerio.load(response.data);
      
      const narrative = $('.main_column').text().trim().substring(0, 500); // Truncated for lean storage
      const metar = $('span.metar').text().trim();

      return { narrative, metar };
    } catch (e) {
      return {};
    }
  }

  private saveResults(data: any[]) {
    const outPath = path.resolve(this.mission.output_settings.path);
    if (!fs.existsSync(outPath)) {
      fs.mkdirSync(outPath, { recursive: true });
    }

    const fileName = `${this.mission.mission_id}_${Date.now()}.json`;
    const fullPath = path.join(outPath, fileName);

    fs.writeFileSync(fullPath, JSON.stringify(data, null, 2));
    console.log(`[Scraper] 💾 Results saved to ${fullPath}`);
  }
}

// CLI / Standalone Runner
const run = async () => {
  const args = process.argv.slice(2);
  let mission: ScrapeMission;

  if (args.length > 0 && fs.existsSync(args[0])) {
    mission = JSON.parse(fs.readFileSync(args[0], 'utf-8'));
  } else {
    // Default fallback mission
    mission = {
      mission_id: "DEFAULT_MISSION",
      targets: ["https://avherald.com/h?search_term=737+max"],
      engine_config: {
        depth_per_url: 1,
        concurrency: 5,
        timeout_ms: 10000,
        retry_limit: 3
      },
      extraction_mode: "LEAN",
      output_settings: {
        format: "json",
        path: "./data/scrapes"
      }
    };
  }

  const scraper = new ProAngelos_ParallelScraper(mission);
  await scraper.execute();
};

if (process.argv[1].includes('ProAngelos_ParallelScraper')) {
  run().catch(console.error);
}
