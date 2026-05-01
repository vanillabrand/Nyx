import axios from 'axios';
import * as cheerio from 'cheerio';
import pLimit from 'p-limit';
import fs from 'fs';
import path from 'path';
import { ProxyService } from '../src/services/ProxyService';

interface ScrapeConfig {
  startPage: number;
  maxPages: number;
  concurrency: number;
  outputFile: string;
}

class HighSpeedScraper {
  private config: ScrapeConfig;
  private limit: any;

  constructor(config: ScrapeConfig) {
    this.config = config;
    this.limit = pLimit(config.concurrency);
  }

  /**
   * Main entry point
   */
  async run() {
    console.log(`🚀 Starting High-Speed Scraper...`);
    console.log(`   Target: Aviation Herald`);
    console.log(`   Pages: ${this.config.startPage} to ${this.config.startPage + this.config.maxPages}`);
    console.log(`   Concurrency: ${this.config.concurrency}`);

    const allIncidents: any[] = [];
    const pageTasks = [];

    for (let i = 0; i < this.config.maxPages; i++) {
      const pageNum = this.config.startPage + i;
      pageTasks.push(this.limit(() => this.scrapePage(pageNum)));
    }

    const results = await Promise.all(pageTasks);
    const flattenedResults = results.flat().filter(r => r !== null);

    console.log(`✅ Scraped ${flattenedResults.length} incident summaries.`);

    // Write to JSON file
    const outputPath = path.resolve(this.config.outputFile);
    fs.writeFileSync(outputPath, JSON.stringify(flattenedResults, null, 2));
    console.log(`💾 Data saved to ${outputPath}`);

    return flattenedResults;
  }

  /**
   * Scrapes a single index page
   */
  private async scrapePage(pageNum: number) {
    const url = `https://avherald.com/?page=${pageNum}`;
    const axiosConfig = ProxyService.getAxiosConfig();

    try {
      const response = await axios.get(url, {
        ...axiosConfig,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept-Encoding': 'gzip, deflate, br'
        }
      });

      const $ = cheerio.load(response.data);
      const incidents: any[] = [];
      let currentDate = '';

      $('td').each((_, td) => {
        const span = $(td).find('span.headline_avherald');
        if (span.length > 0) {
          const link = $(td).find('a[href^="/h?article="]');
          if (link.length > 0) {
            // This is an incident
            const headline = span.text().trim();
            const href = link.attr('href');
            incidents.push({
              headline,
              url: href ? `https://avherald.com${href}` : null,
              date: currentDate,
              source: 'Aviation Herald'
            });
          } else {
            // This is likely a date header
            currentDate = span.text().trim();
          }
        }
      });

      console.log(`   [Page ${pageNum}] Found ${incidents.length} incidents.`);
      return incidents;
    } catch (error: any) {
      console.error(`❌ Error on page ${pageNum}: ${error.message}`);
      return null;
    }
  }
}

// Standalone execution
if (import.meta.url.endsWith(process.argv[1])) {
  const scraper = new HighSpeedScraper({
    startPage: 1,
    maxPages: 10, // Default to 10 for safety in test
    concurrency: 5,
    outputFile: './data/scraped_incidents.json'
  });

  scraper.run().catch(console.error);
}

export { HighSpeedScraper };
