import dotenv from 'dotenv';
import { SocksProxyAgent } from 'socks-proxy-agent';
import { HttpsProxyAgent } from 'https-proxy-agent';

dotenv.config();

export class ProxyService {
  private static SOCKS5_URL = process.env.SOCKS5_PROXY_URL;
  private static HTTP_URL = process.env.PROXY_URL;

  /**
   * Returns a SOCKS5 agent if configured, otherwise an HTTP agent.
   * Optimized for high-speed concurrent requests.
   */
  public static getAgent() {
    if (this.SOCKS5_URL) {
      return new SocksProxyAgent(this.SOCKS5_URL, {
        keepAlive: true,
        timeout: 5000
      });
    }
    
    if (this.HTTP_URL) {
      return new HttpsProxyAgent(this.HTTP_URL, {
        keepAlive: true,
        timeout: 5000,
        rejectUnauthorized: false
      });
    }

    return null;
  }

  /**
   * Returns axios configuration with the appropriate agent.
   */
  public static getAxiosConfig() {
    const agent = this.getAgent();
    if (!agent) return {};

    return {
      httpAgent: agent,
      httpsAgent: agent,
      proxy: false as const, // Important: tell axios not to use its internal proxy logic
      timeout: 5000
    };
  }
}
