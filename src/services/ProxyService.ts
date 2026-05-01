import dotenv from 'dotenv';
dotenv.config();

export class ProxyService {
  private static PROXY_LIST = [
    process.env.PROXY_URL || ''
  ].filter(url => url !== '');

  private static currentIndex = 0;

  public static getNextProxy(): string | null {
    if (this.PROXY_LIST.length === 0) return null;
    const proxy = this.PROXY_LIST[this.currentIndex];
    this.currentIndex = (this.currentIndex + 1) % this.PROXY_LIST.length;
    return proxy;
  }

  public static getAxiosConfig(proxyUrl: string) {
    try {
      const url = new URL(proxyUrl);
      return {
        proxy: {
          protocol: url.protocol.replace(':', ''),
          host: url.hostname,
          port: parseInt(url.port),
          auth: {
            username: url.username,
            password: url.password
          }
        }
      };
    } catch (e) {
      console.error('Invalid proxy URL:', proxyUrl);
      return {};
    }
  }
}
