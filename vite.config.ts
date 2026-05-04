import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { HttpsProxyAgent } from 'https-proxy-agent'
import { SocksProxyAgent } from 'socks-proxy-agent'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  
  // Prefer SOCKS5 if provided, as it is often more stable for residential proxies
  const proxyUrl = env.PROXY_URL || env.SOCKS5_PROXY_URL;
  
  let agent;
  const agentOpts = { 
    timeout: 15000, 
    rejectUnauthorized: false, 
    keepAlive: true,
  };

  if (proxyUrl) {
    if (proxyUrl.startsWith('socks')) {
      agent = new SocksProxyAgent(proxyUrl, agentOpts);
    } else {
      agent = new HttpsProxyAgent(proxyUrl, agentOpts);
    }
  }

  return {
    plugins: [react()],
    server: {
      proxy: {
        '/api/adsb': {
          target: 'https://api.adsb.lol',
          changeOrigin: true,
          secure: false,
          agent: agent,
          rewrite: (path) => path.replace(/^\/api\/adsb/, '')
        }
      }
    }
  };
});
