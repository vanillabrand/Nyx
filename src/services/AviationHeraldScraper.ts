import axios from 'axios';
import * as cheerio from 'cheerio';
import { ProxyService } from './ProxyService';

export interface StructuredTitle {
  airline: string | null;
  aircraft: string | null;
  location: string | null;
  eventDate: string | null;
  description: string;
}

export interface DetailedIncident extends StructuredTitle {
  id: string;
  narrative: string;
  metar: string | null;
  reportDate: string;
  lastUpdated: string;
  articleUrl: string;
  occurrenceClass?: string;
  occurrenceCategory?: string[];
}

export class AviationHeraldScraper {
  private static BASE_URL = 'https://avherald.com/h';

  /**
   * Scrapes the detailed article page for an incident.
   */
  public static async scrapeArticleDetails(articleId: string): Promise<Partial<DetailedIncident>> {
    const url = `${this.BASE_URL}?article=${articleId}&opt=0`;
    const proxy = ProxyService.getNextProxy();
    const config = proxy ? ProxyService.getAxiosConfig(proxy) : {};

    try {
      const response = await axios.get(url, {
        ...config,
        timeout: 15000,
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });

      const $ = cheerio.load(response.data);
      const fullText = $('span.article_text').text().trim();
      
      // Extract METAR
      const metarMatch = fullText.match(/Metars:([\s\S]+)/i);
      const metar = metarMatch ? metarMatch[1].trim() : null;
      
      // Narrative is the text before METAR
      const narrative = metarMatch ? fullText.split(/Metars:/i)[0].trim() : fullText;

      // Extract Dates
      const dateLine = $('span.small_article_text').first().text();
      const reportDate = dateLine.match(/created (.*?),/)?.[1] || '';
      const lastUpdated = dateLine.match(/last updated (.*?)$/)?.[1] || '';

      return {
        id: articleId,
        narrative,
        metar,
        reportDate,
        lastUpdated,
        articleUrl: url
      };
    } catch (err) {
      console.error(`Failed to scrape article ${articleId}:`, (err as any).message);
      throw err;
    }
  }

  /**
   * Scrapes a list of incident headlines from an offset.
   */
  public static async scrapeIncidentList(offset: string = ''): Promise<{title: string, id: string}[]> {
    const url = `${this.BASE_URL}?list=&opt=0&offset=${offset}`;
    const proxy = ProxyService.getNextProxy();
    const config = proxy ? ProxyService.getAxiosConfig(proxy) : {};

    try {
      const response = await axios.get(url, {
        ...config,
        timeout: 15000,
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });

      const $ = cheerio.load(response.data);
      const incidents: {title: string, id: string}[] = [];

      $('span.headline_main').each((_, el) => {
        const title = $(el).text().trim();
        const id = $(el).closest('a').attr('href')?.match(/article=([^&]+)/)?.[1] || '';
        if (title && id) incidents.push({ title, id });
      });

      return incidents;
    } catch (err) {
      console.error(`Failed to scrape list at offset ${offset}:`, (err as any).message);
      throw err;
    }
  }

  /**
   * Parses a raw title into structured components using fuzzy patterns.
   */
  public static parseTitle(title: string): StructuredTitle {
    // Regex logic for extracting Airline, Aircraft, and Location
    const airlineMatch = title.match(/^(.*?) (B73[0-9]|A3[0-9]{2}|MD[0-9]{2}|ATR[0-9]{2}|DC[0-9]|CRJ[0-9]|ERJ[0-9]|Dash8|Fokker [0-9]{2,3})/i);
    const aircraftMatch = title.match(/(B73[0-9]|A3[0-9]{2}|MD[0-9]{2}|ATR[0-9]{2}|DC[0-9]|CRJ[0-9]|ERJ[0-9]|Dash8|Fokker [0-9]{2,3})/i);
    const locationMatch = title.match(/at (.*?) on/i);
    const dateMatch = title.match(/on (.*?),/i);

    return {
      airline: airlineMatch ? airlineMatch[1].trim() : null,
      aircraft: aircraftMatch ? aircraftMatch[0].trim() : null,
      location: locationMatch ? locationMatch[1].trim() : null,
      eventDate: dateMatch ? dateMatch[1].trim() : null,
      description: title.split(',').slice(-1)[0].trim()
    };
  }
}
