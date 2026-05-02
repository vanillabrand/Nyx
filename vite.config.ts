import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { HttpsProxyAgent } from 'https-proxy-agent'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const proxyUrl = env.PROXY_URL;
  const agent = proxyUrl ? new HttpsProxyAgent(proxyUrl) : undefined;

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
