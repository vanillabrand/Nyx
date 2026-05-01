import axios from 'axios';
import * as cheerio from 'cheerio';
import { ProxyService } from '../src/services/ProxyService';

async function megaScrape(startOffset: string, targetPages: number) {
  let currentOffset = startOffset;
  const titles: string[] = [];
  
  console.log(`Mega-Scrape: Targeting ${targetPages} pages starting at ${startOffset}...`);

  for (let i = 0; i < targetPages; i++) {
    const url = `https://avherald.com/h?list=&opt=0&offset=${currentOffset}`;
    const proxy = ProxyService.getNextProxy();
    const config = proxy ? ProxyService.getAxiosConfig(proxy) : {};

    try {
      // High timeout for slow residential proxy
      const response = await axios.get(url, {
        ...config,
        timeout: 30000, 
        headers: { 
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept-Language': 'en-US,en;q=0.9'
        }
      });

      const $ = cheerio.load(response.data);
      let count = 0;
      $('span.headline_main').each((_, el) => {
        titles.push($(el).text().trim());
        count++;
      });

      console.log(`[Page ${i}] Scraped ${count} titles. Total: ${titles.length}`);

      const nextLink = $('a').filter((_, el) => $(el).text().includes('Next')).attr('href');
      currentOffset = nextLink?.match(/offset=([^&]+)/)?.[1] || '';

      if (!currentOffset) {
        console.log('No next link found. Stopping.');
        break;
      }
    } catch (err) {
      console.error(`[Page ${i}] Failed:`, (err as any).message);
      // Wait a bit and retry the same offset once
      await new Promise(r => setTimeout(r, 2000));
      i--; 
      continue;
    }

    // Small delay to be respectful and prevent IP burn
    await new Promise(r => setTimeout(r, 500));
  }

  // Final Audit of the Mega-Sample
  const audits = {
    total: titles.length,
    diversions: titles.filter(t => /divert|return|diversion/i.test(t)).length,
    multiEntities: titles.filter(t => / and | & | collided | with /i.test(t)).length,
    groundDamage: titles.filter(t => /truck|tractor|car|vehicle|building|missile|fire/i.test(t)).length,
    medical: titles.filter(t => /ill|incapacitated|faint|sick|death/i.test(t)).length
  };

  console.log('\n--- Mega-Scrape Results ---');
  console.log(JSON.stringify(audits, null, 2));

  // Save the titles for a deep pattern check
  fs.writeFileSync('C:/Users/bruce/Will_Flight_Query_Analyser/mega_titles_sample.txt', titles.join('\n'));
}

import fs from 'fs';
// Running for 100 pages to get another ~5,000 modern records (in addition to 30k local)
// I will run multiple instances with different offsets if needed.
megaScrape('20240101000000', 100); 
