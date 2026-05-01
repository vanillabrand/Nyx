import Database from 'better-sqlite3';
import path from 'path';

export class AICacheService {
  private db: Database.Database;

  constructor(dbPath: string = 'ai_cache.db') {
    this.db = new Database(dbPath);
    this.init();
  }

  private init() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS ai_cache (
        query_hash TEXT PRIMARY KEY,
        raw_query TEXT,
        cypher_query TEXT,
        result_json TEXT,
        embedding_vector BLOB,
        model_name TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS scraping_audit (
        url TEXT PRIMARY KEY,
        status TEXT,
        last_scraped DATETIME,
        content_hash TEXT,
        proxy_id TEXT,
        retry_count INTEGER DEFAULT 0
      );
    `);
  }

  setCache(hash: string, data: any) {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO ai_cache 
      (query_hash, raw_query, cypher_query, result_json, model_name)
      VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run(hash, data.raw_query, data.cypher_query, JSON.stringify(data.result_json), data.model_name);
  }

  getCache(hash: string) {
    const stmt = this.db.prepare('SELECT * FROM ai_cache WHERE query_hash = ?');
    const result = stmt.get(hash) as any;
    if (result) {
      result.result_json = JSON.parse(result.result_json);
    }
    return result;
  }
}
