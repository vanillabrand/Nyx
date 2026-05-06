import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createProxyMiddleware } from 'http-proxy-middleware';
import dotenv from 'dotenv';

import { HttpsProxyAgent } from 'https-proxy-agent';
import { SocksProxyAgent } from 'socks-proxy-agent';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8080;

// Preferred proxy resolution: SOCKS5 > HTTPS > DIRECT
const PROXY_URL = process.env.PROXY_URL || process.env.SOCKS5_PROXY_URL;
let agent;
if (PROXY_URL) {
  const agentOpts = { timeout: 30000, rejectUnauthorized: false, keepAlive: true };
  agent = PROXY_URL.startsWith('socks') 
    ? new SocksProxyAgent(PROXY_URL, agentOpts) 
    : new HttpsProxyAgent(PROXY_URL, agentOpts);
}

// Tactical Telemetry Proxy
// Proxies local /api/adsb requests to api.adsb.lol (Development Target)
app.use('/api/adsb', createProxyMiddleware({
  target: 'https://api.adsb.lol',
  changeOrigin: true,
  agent: agent,
  secure: false,
  pathRewrite: {
    '^/api/adsb': '',
  },
  onProxyRes: (proxyRes, req, res) => {
    // Suppress noise
  },
  onError: (err, req, res) => {
    // Absorb handshake errors silently to match Vite dev behavior
    const msg = err.message || '';
    if (msg.includes('EPROTO') || msg.includes('CONNECT') || msg.includes('SSL') || msg.includes('socket')) {
      res.status(502).send('Proxy Handshake Failure');
      return;
    }
    console.warn('[PROXY_ERR]', msg);
    res.status(500).send('Proxy Error: ' + msg);
  }
}));

// Serve static assets from dist
app.use(express.static(path.join(__dirname, 'dist')));

// Fallback to index.html for SPA routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\\ AVIATION COMMAND TERMINAL`);
  console.log(`\\ STATUS: OPERATIONAL`);
  console.log(`\\ PORT: ${PORT}`);
});
