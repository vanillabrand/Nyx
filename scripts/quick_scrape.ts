import axios from 'axios';
import * as cheerio from 'cheerio';
import { ProxyService } from '../src/services/ProxyService';
import fs from 'fs';

async function optimizedQuickScrape(pages: number) {
  let currentOffset = '20260430000000';
  const allTitles: string[] = [];
  const filePath = 'C:/Users/bruce/Will_Flight_Query_Analyser/quick_5000_sample.txt';
  
  console.log(`Optimized Quick-Scrape: Targeting ${pages} pages...`);

  for (let i = 0; i < pages; i++) {
    const url = `https://avherald.com/h?list=&opt=0&offset=${currentOffset}`;
    const config = ProxyService.getAxiosConfig(url);

    try {
      const response = await axios.get(url, {
        ...config,
        timeout: 60000, // 60s timeout
        headers: { 
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });
      const $ = cheerio.load(response.data);
      const pageTitles: string[] = [];
      $('span.headline_main').each((_, el) => {
        pageTitles.push($(el).text().trim());
      });
      allTitles.push(...pageTitles);
      
      const nextLink = $('a').filter((_, el) => $(el).text().includes('Next')).attr('href');
      currentOffset = nextLink?.match(/offset=([^&]+)/)?.[1] || '';
      
      console.log(`[Page ${i}] Scraped ${pageTitles.length} titles. Total: ${allTitles.length}`);
      
      if (allTitles.length > 0) {
        fs.appendFileSync(filePath, pageTitles.join('\n') + '\n');
      }

      if (!currentOffset) break;
    } catch (err) {
      console.error(`Page ${i} failed:`, (err as any).message);
      await new Promise(r => setTimeout(r, 2000));
    }
  }
}

optimizedQuickScrape(100);
