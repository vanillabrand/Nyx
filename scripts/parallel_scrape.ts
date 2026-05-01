import axios from 'axios';
import * as cheerio from 'cheerio';
import { ProxyService } from '../src/services/ProxyService';
import fs from 'fs';

async function parallelScrape(startYear: number, endYear: number) {
  const filePath = 'C:/Users/bruce/Will_Flight_Query_Analyser/mega_titles_sample.txt';
  const years = Array.from({ length: endYear - startYear + 1 }, (_, i) => startYear + i);
  
  const tasks: string[] = [];
  for (const year of years) {
    for (let month = 1; month <= 12; month++) {
      for (let day of [1, 8, 15, 22]) {
        const monthStr = month.toString().padStart(2, '0');
        const dayStr = day.toString().padStart(2, '0');
        tasks.push(`${year}${monthStr}${dayStr}000000`);
      }
    }
  }

  console.log(`Parallel Scrape: Targeting ${tasks.length} pages...`);

  const batchSize = 10;
  for (let i = 0; i < tasks.length; i += batchSize) {
    const batch = tasks.slice(i, i + batchSize);
    console.log(`Processing batch ${i / batchSize + 1}/${Math.ceil(tasks.length / batchSize)}...`);
    
    const batchTitles: string[] = [];
    await Promise.all(batch.map(async (offset) => {
      const url = `https://avherald.com/h?list=&opt=0&offset=${offset}`;
      const proxy = ProxyService.getNextProxy();
      const config = proxy ? ProxyService.getAxiosConfig(proxy) : {};

      try {
        const response = await axios.get(url, {
          ...config,
          timeout: 45000,
          headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        const $ = cheerio.load(response.data);
        $('span.headline_main').each((_, el) => {
          batchTitles.push($(el).text().trim());
        });
      } catch (err) {
        console.error(`Offset ${offset} failed:`, (err as any).message);
      }
    }));
    
    if (batchTitles.length > 0) {
      fs.appendFileSync(filePath, batchTitles.join('\n') + '\n');
      console.log(`Wrote ${batchTitles.length} titles to disk.`);
    }
    
    await new Promise(r => setTimeout(r, 500));
  }
}

parallelScrape(2014, 2024);
