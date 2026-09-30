import { Candle, Instrument, MarketStatus, Quote } from '../../types/market';
import { MarketDataProvider } from './MarketDataProvider';
import { getInitialMarketInstruments } from '../../data/initialSnapshots';
import { SUPPORTED_MARKETS } from '../../data/markets';

export class RealMarketDataProvider implements MarketDataProvider {
  private cache: Map<string, Instrument[]> = new Map();

  async loadUniverse(marketId: string, seed: number = 42): Promise<Instrument[]> {
    try {
      // Attempt to fetch from server-side market data proxy if present
      const response = await fetch(`/api/market/universe?market=${encodeURIComponent(marketId)}`, {
        headers: { 'Accept': 'application/json' },
      }).catch(() => null);

      if (response && response.ok) {
        const data = await response.json();
        if (Array.isArray(data) && data.length > 0) {
          this.cache.set(marketId, data);
          return data;
        }
      }
    } catch {
      // Fallback to embedded authentic real-market snapshot data
    }

    // Load authentic initial snapshot dataset
    const instruments = getInitialMarketInstruments(marketId, seed);
    this.cache.set(marketId, instruments);
    return instruments;
  }

  async searchSymbols(query: string, market?: string): Promise<Instrument[]> {
    const q = query.trim().toUpperCase();
    const allInstruments = market 
      ? (this.cache.get(market) || getInitialMarketInstruments(market))
      : Object.keys(SUPPORTED_MARKETS).flatMap((m) => this.cache.get(m) || getInitialMarketInstruments(m));

    if (!q) return allInstruments;

    return allInstruments.filter(
      (inst) => inst.symbol.toUpperCase().includes(q) || inst.name.toUpperCase().includes(q) || (inst.sector && inst.sector.toUpperCase().includes(q))
    );
  }

  async getQuote(symbol: string): Promise<Quote> {
    try {
      const response = await fetch(`/api/market/quote?symbol=${encodeURIComponent(symbol)}`).catch(() => null);
      if (response && response.ok) {
        return await response.json();
      }
    } catch {
      // Fallback
    }

    // Lookup from loaded cache
    for (const instruments of this.cache.values()) {
      const found = instruments.find((i) => i.symbol === symbol);
      if (found) {
        const change = found.currentPrice - found.previousClose;
        const changePercent = found.previousClose > 0 ? (change / found.previousClose) * 100 : 0;
        return {
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
        };
      }
    }

    throw new Error(`Không tìm thấy mã chứng khoán: ${symbol}`);
  }

  async getHistoricalData(symbol: string, start: string, end: string): Promise<Candle[]> {
    for (const instruments of this.cache.values()) {
      const found = instruments.find((i) => i.symbol === symbol);
      if (found && found.history) {
        return found.history;
      }
    }
    return [];
  }

  async getMarketStatus(market: string): Promise<MarketStatus> {
    const config = SUPPORTED_MARKETS[market] || SUPPORTED_MARKETS.vietnam;
    const now = new Date();
    
    // Check operating hours based on market config
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentTotalMinutes = currentHour * 60 + currentMinute;
    const openTotalMinutes = config.tradingHours.openHour * 60 + config.tradingHours.openMinute;
    const closeTotalMinutes = config.tradingHours.closeHour * 60 + config.tradingHours.closeMinute;
    
    const dayOfWeek = now.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const isOpen = !isWeekend && currentTotalMinutes >= openTotalMinutes && currentTotalMinutes <= closeTotalMinutes;

    let session = 'Đóng cửa';
    if (isOpen) {
      if (market === 'vietnam') {
        if (currentTotalMinutes < 9 * 60 + 15) session = 'Khớp lệnh Định kỳ Mở cửa (ATO)';
        else if (currentTotalMinutes >= 14 * 60 + 30 && currentTotalMinutes <= 14 * 60 + 45) session = 'Khớp lệnh Định kỳ Đóng cửa (ATC)';
        else if (currentTotalMinutes > 11 * 60 + 30 && currentTotalMinutes < 13 * 60) session = 'Nghỉ giữa phiên';
        else session = 'Khớp lệnh Liên tục';
      } else {
        session = 'Phiên Khớp lệnh Liên tục';
      }
    }

    return {
      market: config.name,
      isOpen,
      currentSession: session,
      timezone: config.tradingHours.timezone,
      tradingHours: `${config.tradingHours.openHour.toString().padStart(2, '0')}:${config.tradingHours.openMinute.toString().padStart(2, '0')} - ${config.tradingHours.closeHour.toString().padStart(2, '0')}:${config.tradingHours.closeMinute.toString().padStart(2, '0')}`,
    };
  }
}

export const defaultMarketDataProvider = new RealMarketDataProvider();
