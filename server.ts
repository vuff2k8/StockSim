import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { getInitialMarketInstruments } from './src/data/initialSnapshots';
import { SUPPORTED_MARKETS } from './src/data/markets';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const port = process.env.PORT || 3000;
  const isProd = process.env.NODE_ENV === 'production';

  app.use(express.json());

  // Health check endpoint
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'StockSim Market Server',
      timestamp: new Date().toISOString(),
    });
  });

  // Market universe endpoint
  app.get('/api/market/universe', (req, res) => {
    try {
      const marketId = (req.query.market as string) || 'vietnam';
      const instruments = getInitialMarketInstruments(marketId, 42);
      res.json(instruments);
    } catch (err: any) {
      res.status(500).json({ error: 'Không thể tải dữ liệu thị trường', message: err.message });
    }
  });

  // Quote endpoint
  app.get('/api/market/quote', (req, res) => {
    try {
      const symbol = (req.query.symbol as string)?.toUpperCase();
      if (!symbol) {
        return res.status(400).json({ error: 'Thiếu mã chứng khoán' });
      }

      // Find symbol across all markets
      for (const mId of Object.keys(SUPPORTED_MARKETS)) {
        const instruments = getInitialMarketInstruments(mId, 42);
        const found = instruments.find((i) => i.symbol === symbol);
        if (found) {
          const change = found.currentPrice - found.previousClose;
          const changePercent = found.previousClose > 0 ? (change / found.previousClose) * 100 : 0;
          return res.json({
            symbol: found.symbol,
            price: found.currentPrice,
            change,
            changePercent,
            high: found.dayHigh,
            low: found.dayLow,
            open: found.openPrice,
            previousClose: found.previousClose,
            volume: found.volume,
            timestamp: new Date().toISOString(),
          });
        }
      }

      res.status(404).json({ error: `Không tìm thấy mã: ${symbol}` });
    } catch (err: any) {
      res.status(500).json({ error: 'Lỗi máy chủ', message: err.message });
    }
  });

  // Market status endpoint
  app.get('/api/market/status', (req, res) => {
    const marketId = (req.query.market as string) || 'vietnam';
    const config = SUPPORTED_MARKETS[marketId] || SUPPORTED_MARKETS.vietnam;
    res.json({
      market: config.name,
      isOpen: true,
      currentSession: 'Phiên Khớp lệnh Liên tục',
      timezone: config.tradingHours.timezone,
      tradingHours: `${config.tradingHours.openHour}:00 - ${config.tradingHours.closeHour}:00`,
    });
  });

  if (!isProd) {
    // Vite middleware in development
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Serve production static build
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(port, () => {
    console.log(`StockSim server running on port ${port} (mode: ${isProd ? 'production' : 'development'})`);
  });
}

startServer().catch((err) => {
  console.error('Fatal server startup error:', err);
});
