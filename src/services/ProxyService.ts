import dotenv from 'dotenv';
import { SocksProxyAgent } from 'socks-proxy-agent';
import { HttpsProxyAgent } from 'https-proxy-agent';

dotenv.config();

export class ProxyService {
  private static SOCKS5_URL = process.env.SOCKS5_PROXY_URL;
  private static HTTP_URL = process.env.PROXY_URL;

  /**
   * Returns a high-resilience proxy agent.
   * Prioritizes SOCKS5 for tactical TLS stability.
   */
  public static getAgent(url?: string) {
    // TACTICAL BYPASS: AVHerald explicitly blocks proxy ranges.
    // If target is AVHerald, we use a direct connection.
    if (url?.includes('avherald.com')) {
      return null;
    }

    if (this.SOCKS5_URL) {
      return new SocksProxyAgent(this.SOCKS5_URL, {
        keepAlive: true,
        timeout: 30000
      });
    }
    
    if (this.HTTP_URL) {
      return new HttpsProxyAgent(this.HTTP_URL, {
        keepAlive: true,
        timeout: 30000,
        rejectUnauthorized: false
      });
    }

    return null;
  }

  /**
   * Returns axios configuration with the appropriate agent.
   */
  public static getAxiosConfig(url?: string) {
    const agent = this.getAgent(url);
    if (!agent) return { timeout: 30000 };

    return {
      httpAgent: agent,
      httpsAgent: agent,
      proxy: false as const,
      timeout: 30000
    };
  }
}
