import axios from 'axios';
import * as cheerio from 'cheerio';
import { ProxyService } from '../src/services/ProxyService';

async function massAnalyze(pages: number) {
  let currentOffset = '20260430000000'; // Start from now
  const allTitles: string[] = [];
  
  console.log(`Starting mass analysis of ${pages} pages (target ~${pages * 50} records)...`);

  for (let i = 0; i < pages; i++) {
    const url = `https://avherald.com/h?list=&opt=0&offset=${currentOffset}`;
    const config = ProxyService.getAxiosConfig(url);

    try {
      const response = await axios.get(url, {
        ...config,
        timeout: 10000,
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });

      const $ = cheerio.load(response.data);
      const pageTitles: string[] = [];
      
      $('span.headline_main').each((_, el) => {
        pageTitles.push($(el).text().trim());
      });

      allTitles.push(...pageTitles);
      
      const nextLink = $('a').filter((_, el) => $(el).text().includes('Next')).attr('href');
      currentOffset = nextLink?.match(/offset=([^&]+)/)?.[1] || '';

      if (!currentOffset) break;
      if (i % 10 === 0) console.log(`Processed ${i} pages (${allTitles.length} records)...`);
      
    } catch (err) {
      console.error(`Error on page ${i}:`, (err as any).message);
    }
  }

  // Final Audit
  const stats = {
    total: allTitles.length,
    diversions: allTitles.filter(t => t.toLowerCase().includes('divert') || t.toLowerCase().includes('return')).length,
    collisions: allTitles.filter(t => t.toLowerCase().includes('collid') || t.toLowerCase().includes('hit')).length,
    multiPlane: allTitles.filter(t => t.toLowerCase().includes(' and ') || t.toLowerCase().includes(' & ')).length,
    groundEntity: allTitles.filter(t => /truck|car|vehicle|tractor|missile|bird|animal/i.test(t)).length
  };

  console.log('\n--- Mass Scrape Analysis Summary ---');
  console.log(JSON.stringify(stats, null, 2));
}

massAnalyze(50); // 50 pages for a deep modern sample
