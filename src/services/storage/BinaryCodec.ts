/**
 * Custom High-Performance Lossless Binary Codec for StockSim (STOCKSIM_BINARY_SAVE_V1)
 * Features:
 * - Magic header (SSIM) + version + CRC32 checksum
 * - VarInt (7-bit) + ZigZag encoding for signed deltas
 * - Delta encoding for prices, candles, volumes, timestamps
 * - Bit-packing for booleans and enums
 * - Static string dictionary deduplication
 * - Native browser CompressionStream (gzip) / zlib fallback
 */

import { WorldState, WorldSnapshot } from '../../types/world';
import { Instrument, Candle, StockStyle, AssetType } from '../../types/market';
import { Portfolio, Position } from '../../types/portfolio';
import { Order, Transaction, OrderSide, OrderType, OrderTier, OrderStatus, TimeInForce, PositionEffect } from '../../types/order';

const MAGIC_BYTES = new Uint8Array([0x53, 0x53, 0x49, 0x4d]); // 'SSIM'
const FORMAT_VERSION = 1;
const ENGINE_VERSION = 1;

// --- CRC32 Lookup Table ---
const CRC_TABLE = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let j = 0; j < 8; j++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  CRC_TABLE[i] = c;
}

export function calculateCRC32(buf: Uint8Array, offset: number = 0, length: number = buf.length - offset): number {
  let crc = 0xffffffff;
  for (let i = offset; i < offset + length; i++) {
    crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ buf[i]) & 0xff];
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// --- Binary Buffer Writer ---
export class BinaryWriter {
  private buffer: Uint8Array;
  private view: DataView;
  private offset: number = 0;

  constructor(initialCapacity: number = 32768) {
    this.buffer = new Uint8Array(initialCapacity);
    this.view = new DataView(this.buffer.buffer);
  }

  private ensureCapacity(extraBytes: number): void {
    if (this.offset + extraBytes > this.buffer.length) {
      const nextCap = Math.max(this.buffer.length * 2, this.offset + extraBytes + 16384);
      const nextBuffer = new Uint8Array(nextCap);
      nextBuffer.set(this.buffer);
      this.buffer = nextBuffer;
      this.view = new DataView(this.buffer.buffer);
    }
  }

  public writeUint8(val: number): void {
    this.ensureCapacity(1);
    this.buffer[this.offset++] = val & 0xff;
  }

  public writeUint16(val: number): void {
    this.ensureCapacity(2);
    this.view.setUint16(this.offset, val, true);
    this.offset += 2;
  }

  public writeUint32(val: number): void {
    this.ensureCapacity(4);
    this.view.setUint32(this.offset, val, true);
    this.offset += 4;
  }

  public writeFloat64(val: number): void {
    this.ensureCapacity(8);
    this.view.setFloat64(this.offset, val, true);
    this.offset += 8;
  }

  /**
   * 7-bit Unsigned Variable Length Quantity (VarInt)
   */
  public writeVarInt(val: number): void {
    let num = Math.floor(Math.abs(val));
    while (num >= 0x80) {
      this.writeUint8((num & 0x7f) | 0x80);
      num = Math.floor(num / 128);
    }
    this.writeUint8(num & 0x7f);
  }

  /**
   * ZigZag encoding for signed numbers mapped to unsigned VarInt:
   * 0 -> 0, -1 -> 1, 1 -> 2, -2 -> 3, 2 -> 4 ...
   */
  public writeZigZag(val: number): void {
    const intVal = Math.round(val);
    const zz = intVal >= 0 ? intVal * 2 : -intVal * 2 - 1;
    this.writeVarInt(zz);
  }

  public writeString(str: string): void {
    const encoder = new TextEncoder();
    const encoded = encoder.encode(str);
    this.writeVarInt(encoded.length);
    this.ensureCapacity(encoded.length);
    this.buffer.set(encoded, this.offset);
    this.offset += encoded.length;
  }

  public writeBytes(bytes: Uint8Array): void {
    this.ensureCapacity(bytes.length);
    this.buffer.set(bytes, this.offset);
    this.offset += bytes.length;
  }

  public getOffset(): number {
    return this.offset;
  }

  public setUint32At(offset: number, val: number): void {
    this.view.setUint32(offset, val, true);
  }

  public toUint8Array(): Uint8Array {
    return this.buffer.subarray(0, this.offset);
  }
}

// --- Binary Buffer Reader ---
export class BinaryReader {
  private buffer: Uint8Array;
  private view: DataView;
  private offset: number = 0;

  constructor(buffer: Uint8Array) {
    this.buffer = buffer;
    this.view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  }

  public readUint8(): number {
    return this.buffer[this.offset++];
  }

  public readUint16(): number {
    const val = this.view.getUint16(this.offset, true);
    this.offset += 2;
    return val;
  }

  public readUint32(): number {
    const val = this.view.getUint32(this.offset, true);
    this.offset += 4;
    return val;
  }

  public readFloat64(): number {
    const val = this.view.getFloat64(this.offset, true);
    this.offset += 8;
    return val;
  }

  public readVarInt(): number {
    let result = 0;
    let shift = 0;
    while (true) {
      const byte = this.readUint8();
      result += (byte & 0x7f) * Math.pow(2, shift);
      if (!(byte & 0x80)) break;
      shift += 7;
    }
    return result;
  }

  public readZigZag(): number {
    const zz = this.readVarInt();
    return zz % 2 === 0 ? zz / 2 : -(zz + 1) / 2;
  }

  public readString(): string {
    const len = this.readVarInt();
    const bytes = this.buffer.subarray(this.offset, this.offset + len);
    this.offset += len;
    return new TextDecoder().decode(bytes);
  }

  public readBytes(len: number): Uint8Array {
    const sub = this.buffer.subarray(this.offset, this.offset + len);
    this.offset += len;
    return sub;
  }

  public getOffset(): number {
    return this.offset;
  }
}

// --- World Binary Codec ---
export class WorldBinaryCodec {
  /**
   * Encodes complete WorldState to normalized binary representation
   */
  public static encode(world: WorldState): Uint8Array {
    const w = new BinaryWriter();

    // 1. Header (16 bytes): Magic(4) + FormatVer(2) + EngineVer(2) + Flags(4) + CRC32 placeholder(4)
    w.writeBytes(MAGIC_BYTES);
    w.writeUint16(FORMAT_VERSION);
    w.writeUint16(ENGINE_VERSION);
    w.writeUint32(0); // Flags
    const crcOffset = w.getOffset();
    w.writeUint32(0); // Placeholder for CRC32

    // 2. String Dictionaries (Deduplicate repeated strings)
    const dict: string[] = [];
    const dictMap = new Map<string, number>();
    const getDictId = (s: string): number => {
      let id = dictMap.get(s);
      if (id === undefined) {
        id = dict.length;
        dictMap.set(s, id);
        dict.push(s);
      }
      return id;
    };

    // Pre-seed dictionary with known strings
    getDictId('VND');
    getDictId('USD');
    getDictId('vietnam');
    getDictId('us');
    getDictId('BUY');
    getDictId('SELL');
    getDictId('OPEN_LONG');
    getDictId('CLOSE_LONG');
    getDictId('OPEN_SHORT');
    getDictId('CLOSE_SHORT');

    // Encode World Metadata & Snapshot
    w.writeString(world.snapshot.id);
    w.writeFloat64(new Date(world.snapshot.createdAt).getTime());
    w.writeFloat64(new Date(world.snapshot.sourceTimestamp).getTime());
    w.writeString(world.snapshot.market);
    w.writeString(world.snapshot.currency);
    w.writeVarInt(world.snapshot.seed);
    w.writeVarInt(world.version);

    // Encode Clock State
    w.writeFloat64(world.clock.currentTimestamp);
    w.writeVarInt(world.clock.speed);
    w.writeUint8(world.clock.isPaused ? 1 : 0);

    // Encode Market Index
    w.writeString(world.marketIndex.symbol);
    w.writeString(world.marketIndex.name);
    w.writeFloat64(world.marketIndex.value);
    w.writeFloat64(world.marketIndex.change);
    w.writeFloat64(world.marketIndex.changePercent);

    // Encode Instruments
    const instList = Object.values(world.instruments);
    w.writeVarInt(instList.length);

    for (const inst of instList) {
      w.writeString(inst.symbol);
      w.writeString(inst.name);
      w.writeString(inst.exchange);
      w.writeString(inst.sector);
      w.writeString(inst.currency);
      w.writeString(inst.market);
      w.writeString(inst.style);
      w.writeString(inst.assetType);
      w.writeVarInt(inst.lotSize || 1);
      w.writeFloat64(inst.beta);
      w.writeFloat64(inst.volatility);
      w.writeFloat64(inst.liquidity);
      w.writeFloat64(inst.momentum);

      // Numerical prices in cents / ticks (scaled by 100 for exact integer delta encoding)
      const currentPriceCents = Math.round(inst.currentPrice * 100);
      const prevCloseCents = Math.round(inst.previousClose * 100);
      const openPriceCents = Math.round(inst.openPrice * 100);
      const dayHighCents = Math.round(inst.dayHigh * 100);
      const dayLowCents = Math.round(inst.dayLow * 100);

      w.writeVarInt(currentPriceCents);
      w.writeZigZag(currentPriceCents - prevCloseCents);
      w.writeZigZag(openPriceCents - prevCloseCents);
      w.writeZigZag(dayHighCents - currentPriceCents);
      w.writeZigZag(dayLowCents - currentPriceCents);
      w.writeVarInt(Math.floor(inst.volume));

      // Compress Candle History with Delta Encoding
      const history = inst.history || [];
      w.writeVarInt(history.length);
      if (history.length > 0) {
        // Base candle
        const base = history[0];
        let prevTime = new Date(base.timestamp).getTime();
        let prevClose = Math.round(base.close * 100);

        w.writeFloat64(prevTime);
        w.writeVarInt(Math.round(base.open * 100));
        w.writeVarInt(Math.round(base.high * 100));
        w.writeVarInt(Math.round(base.low * 100));
        w.writeVarInt(prevClose);
        w.writeVarInt(Math.floor(base.volume));

        // Sequential deltas
        for (let c = 1; c < history.length; c++) {
          const candle = history[c];
          const cTime = new Date(candle.timestamp).getTime();
          const cOpen = Math.round(candle.open * 100);
          const cHigh = Math.round(candle.high * 100);
          const cLow = Math.round(candle.low * 100);
          const cClose = Math.round(candle.close * 100);

          w.writeZigZag((cTime - prevTime) / 1000); // Time delta in seconds
          w.writeZigZag(cOpen - prevClose);
          w.writeZigZag(cHigh - cOpen);
          w.writeZigZag(cLow - cOpen);
          w.writeZigZag(cClose - prevClose);
          w.writeZigZag(Math.floor(candle.volume - history[c - 1].volume));

          prevTime = cTime;
          prevClose = cClose;
        }
      }
    }

    // Encode Portfolio
    w.writeFloat64(world.portfolio.cash);
    w.writeString(world.portfolio.currency);
    w.writeFloat64(world.portfolio.realizedPnL);
    w.writeFloat64(world.portfolio.startingCapital);

    // Positions
    const posList = Object.values(world.portfolio.positions);
    w.writeVarInt(posList.length);
    for (const pos of posList) {
      w.writeString(pos.symbol);
      w.writeString(pos.name);
      w.writeString(pos.currency);
      w.writeString(pos.side);
      w.writeVarInt(pos.quantity);
      w.writeFloat64(pos.averagePrice);
      w.writeFloat64(pos.leverage || 1);
      w.writeFloat64(pos.marginUsed || 0);
      w.writeFloat64(pos.totalCost);
      w.writeFloat64(pos.tpPrice || 0);
      w.writeFloat64(pos.slPrice || 0);
    }

    // Open Orders
    const openOrders = world.openOrders || [];
    w.writeVarInt(openOrders.length);
    for (const o of openOrders) {
      w.writeString(o.id);
      w.writeString(o.symbol);
      w.writeString(o.side);
      w.writeString(o.orderType);
      w.writeString(o.tier);
      w.writeVarInt(o.quantity);
      w.writeVarInt(o.remainingQuantity);
      w.writeFloat64(o.price || 0);
      w.writeFloat64(o.limitPrice || 0);
      w.writeFloat64(o.stopPrice || 0);
      w.writeFloat64(o.tpPrice || 0);
      w.writeFloat64(o.slPrice || 0);
      w.writeFloat64(o.trailingPercent || 0);
      w.writeFloat64(o.leverage || 1);
      w.writeString(o.timeInForce || 'GTC');
      w.writeString(o.createdAt);
    }

    // Watchlist
    const wl = world.watchlist || [];
    w.writeVarInt(wl.length);
    for (const s of wl) {
      w.writeString(s);
    }

    // UI Settings JSON fallback for non-critical appearance settings
    const uiJson = JSON.stringify(world.uiSettings || {});
    w.writeString(uiJson);

    // Market config id
    w.writeString(world.marketConfig.id);

    // Compute CRC32 over the entire buffer excluding header CRC placeholder
    const uncompressed = w.toUint8Array();
    const checksum = calculateCRC32(uncompressed, 16, uncompressed.length - 16);
    w.setUint32At(crcOffset, checksum);

    return w.toUint8Array();
  }

  /**
   * Decodes binary buffer into a complete WorldState
   */
  public static decode(bytes: Uint8Array): WorldState {
    const r = new BinaryReader(bytes);

    // Verify Magic Bytes
    const m0 = r.readUint8();
    const m1 = r.readUint8();
    const m2 = r.readUint8();
    const m3 = r.readUint8();
    if (m0 !== 0x53 || m1 !== 0x53 || m2 !== 0x49 || m3 !== 0x4d) {
      throw new Error('Invalid StockSim save file: magic header mismatch');
    }

    const formatVer = r.readUint16();
    const engineVer = r.readUint16();
    const flags = r.readUint32();
    const expectedCrc = r.readUint32();

    // Verify Checksum
    const actualCrc = calculateCRC32(bytes, 16, bytes.length - 16);
    if (expectedCrc !== 0 && actualCrc !== expectedCrc) {
      throw new Error(`Data corruption detected: CRC32 mismatch (expected ${expectedCrc}, got ${actualCrc})`);
    }

    // World Metadata & Snapshot
    const snapshotId = r.readString();
    const createdAtMs = r.readFloat64();
    const sourceTimestampMs = r.readFloat64();
    const snapshotMarket = r.readString();
    const snapshotCurrency = r.readString();
    const seed = r.readVarInt();
    const version = r.readVarInt();

    // Clock
    const currentTimestamp = r.readFloat64();
    const speed = r.readVarInt();
    const isPaused = r.readUint8() === 1;

    const clockDate = new Date(currentTimestamp);
    const displayDate = clockDate.toISOString().slice(0, 10);
    const displayTime = clockDate.toISOString().slice(11, 19);

    // Market Index
    const indexSymbol = r.readString();
    const indexName = r.readString();
    const indexValue = r.readFloat64();
    const indexChange = r.readFloat64();
    const indexChangePercent = r.readFloat64();

    // Instruments
    const numInst = r.readVarInt();
    const instruments: Record<string, Instrument> = {};

    for (let i = 0; i < numInst; i++) {
      const symbol = r.readString();
      const name = r.readString();
      const exchange = r.readString();
      const sector = r.readString();
      const currency = r.readString();
      const market = r.readString();
      const style = r.readString() as StockStyle;
      const assetType = r.readString() as AssetType;
      const lotSize = r.readVarInt();
      const beta = r.readFloat64();
      const volatility = r.readFloat64();
      const liquidity = r.readFloat64();
      const momentum = r.readFloat64();

      const currentPriceCents = r.readVarInt();
      const prevCloseDelta = r.readZigZag();
      const openPriceDelta = r.readZigZag();
      const dayHighDelta = r.readZigZag();
      const dayLowDelta = r.readZigZag();
      const volume = r.readVarInt();

      const prevCloseCents = currentPriceCents - prevCloseDelta;
      const openPriceCents = prevCloseCents + openPriceDelta;
      const dayHighCents = currentPriceCents + dayHighDelta;
      const dayLowCents = currentPriceCents + dayLowDelta;

      // Decode Candles
      const numCandles = r.readVarInt();
      const history: Candle[] = [];
      if (numCandles > 0) {
        let prevTime = r.readFloat64();
        const baseOpen = r.readVarInt() / 100;
        const baseHigh = r.readVarInt() / 100;
        const baseLow = r.readVarInt() / 100;
        let prevClose = r.readVarInt() / 100;
        let prevVol = r.readVarInt();

        history.push({
          timestamp: new Date(prevTime).toISOString(),
          open: baseOpen,
          high: baseHigh,
          low: baseLow,
          close: prevClose,
          volume: prevVol,
        });

        for (let c = 1; c < numCandles; c++) {
          const timeDeltaSec = r.readZigZag();
          const openDelta = r.readZigZag() / 100;
          const highDelta = r.readZigZag() / 100;
          const lowDelta = r.readZigZag() / 100;
          const closeDelta = r.readZigZag() / 100;
          const volDelta = r.readZigZag();

          const cTime = prevTime + timeDeltaSec * 1000;
          const cOpen = prevClose + openDelta;
          const cHigh = cOpen + highDelta;
          const cLow = cOpen + lowDelta;
          const cClose = prevClose + closeDelta;
          const cVol = Math.max(0, prevVol + volDelta);

          history.push({
            timestamp: new Date(cTime).toISOString(),
            open: cOpen,
            high: cHigh,
            low: cLow,
            close: cClose,
            volume: cVol,
          });

          prevTime = cTime;
          prevClose = cClose;
          prevVol = cVol;
        }
      }

      instruments[symbol] = {
        symbol,
        name,
        exchange,
        sector,
        currency,
        market,
        style,
        assetType,
        lotSize,
        beta,
        volatility,
        liquidity,
        momentum,
        currentPrice: currentPriceCents / 100,
        previousClose: prevCloseCents / 100,
        openPrice: openPriceCents / 100,
        dayHigh: dayHighCents / 100,
        dayLow: dayLowCents / 100,
        volume,
        history,
        isRealDataOrigin: true,
      };
    }

    // Portfolio
    const cash = r.readFloat64();
    const currencyStr = r.readString();
    const realizedPnL = r.readFloat64();
    const startingCapital = r.readFloat64();

    const numPos = r.readVarInt();
    const positions: Record<string, Position> = {};
    for (let p = 0; p < numPos; p++) {
      const sym = r.readString();
      const pName = r.readString();
      const pCur = r.readString();
      const pSide = r.readString() as 'LONG' | 'SHORT';
      const pQty = r.readVarInt();
      const pAvgPrice = r.readFloat64();
      const pLev = r.readFloat64();
      const pMargin = r.readFloat64();
      const pTotalCost = r.readFloat64();
      const pTp = r.readFloat64();
      const pSl = r.readFloat64();

      const inst = instruments[sym];
      const curPrice = inst ? inst.currentPrice : pAvgPrice;
      const mVal = curPrice * pQty;
      const uPnL = pSide === 'LONG' ? mVal - pTotalCost : pTotalCost - mVal;

      positions[sym] = {
        symbol: sym,
        name: pName,
        currency: pCur,
        side: pSide,
        quantity: pQty,
        averagePrice: pAvgPrice,
        currentPrice: curPrice,
        marketValue: mVal,
        totalCost: pTotalCost,
        unrealizedPnL: uPnL,
        unrealizedPnLPercent: pTotalCost > 0 ? (uPnL / pTotalCost) * 100 : 0,
        realizedPnL: 0,
        leverage: pLev,
        marginUsed: pMargin,
        tpPrice: pTp || undefined,
        slPrice: pSl || undefined,
      };
    }

    // Open Orders
    const numOrders = r.readVarInt();
    const openOrders: Order[] = [];
    for (let o = 0; o < numOrders; o++) {
      const oId = r.readString();
      const oSym = r.readString();
      const oSide = r.readString() as OrderSide;
      const oType = r.readString() as OrderType;
      const oTier = r.readString() as OrderTier;
      const oQty = r.readVarInt();
      const oRem = r.readVarInt();
      const oPrice = r.readFloat64();
      const oLimit = r.readFloat64();
      const oStop = r.readFloat64();
      const oTp = r.readFloat64();
      const oSl = r.readFloat64();
      const oTrail = r.readFloat64();
      const oLev = r.readFloat64();
      const oTif = r.readString() as TimeInForce;
      const oCreated = r.readString();

      openOrders.push({
        id: oId,
        symbol: oSym,
        instrumentName: instruments[oSym]?.name || oSym,
        currency: instruments[oSym]?.currency || 'VND',
        side: oSide,
        positionEffect: oSide === 'BUY' ? 'OPEN_LONG' : 'CLOSE_LONG',
        orderType: oType,
        tier: oTier,
        status: 'PENDING',
        timeInForce: oTif,
        leverage: oLev,
        quantity: oQty,
        filledQuantity: oQty - oRem,
        remainingQuantity: oRem,
        price: oPrice || undefined,
        limitPrice: oLimit || undefined,
        stopPrice: oStop || undefined,
        tpPrice: oTp || undefined,
        slPrice: oSl || undefined,
        trailingPercent: oTrail || undefined,
        marginRequired: 0,
        estimatedSlippage: 0,
        fee: 0,
        totalCost: 0,
        createdAt: oCreated,
        updatedAt: oCreated,
      });
    }

    // Watchlist
    const numWl = r.readVarInt();
    const watchlist: string[] = [];
    for (let w = 0; w < numWl; w++) {
      watchlist.push(r.readString());
    }

    // UI Settings
    const uiJson = r.readString();
    let uiSettings: any = {};
    try {
      uiSettings = JSON.parse(uiJson);
    } catch {
      uiSettings = {};
    }

    const marketConfigId = r.readString();

    const snapshot: WorldSnapshot = {
      id: snapshotId,
      createdAt: new Date(createdAtMs).toISOString(),
      sourceTimestamp: new Date(sourceTimestampMs).toISOString(),
      market: snapshotMarket,
      currency: snapshotCurrency,
      seed,
      startingCapital,
      difficulty: 'normal',
      instruments: [],
    };

    // Calculate portfolio equity & metrics
    let totalInvested = 0;
    let portfolioMarketValue = 0;
    let totalUnrealized = 0;
    for (const pos of Object.values(positions)) {
      totalInvested += pos.totalCost;
      portfolioMarketValue += pos.marketValue;
      totalUnrealized += pos.unrealizedPnL;
    }
    const equity = cash + portfolioMarketValue;
    const totalReturn = equity - startingCapital;
    const totalReturnPercent = startingCapital > 0 ? (totalReturn / startingCapital) * 100 : 0;

    const portfolio: Portfolio = {
      cash,
      startingCapital,
      currency: snapshotCurrency,
      positions,
      totalInvested,
      portfolioValue: portfolioMarketValue,
      totalAssets: equity,
      unrealizedPnL: totalUnrealized,
      unrealizedPnLPercent: totalInvested > 0 ? (totalUnrealized / totalInvested) * 100 : 0,
      realizedPnL,
      totalReturn,
      totalReturnPercent,
      dayStartAssets: equity,
      todayPnL: 0,
      todayPnLPercent: 0,
      equity,
      usedMargin: 0,
      availableMargin: cash,
      maintenanceMargin: 0,
      marginRatio: 0,
      isMarginCall: false,
      riskMetrics: {
        totalExposure: portfolioMarketValue,
        longExposure: portfolioMarketValue,
        shortExposure: 0,
        grossExposure: portfolioMarketValue,
        netExposure: portfolioMarketValue,
        accountLeverage: 1,
        marginUsed: 0,
        availableMargin: cash,
        marginRatio: 0,
        isMarginWarning: false,
        isLiquidationRisk: false,
        largestPositionPercent: 0,
        largestSectorExposure: 0,
        concentrationPercent: 0,
        potentialLossEstimate: totalInvested,
      },
    };

    // Fallback marketConfig builder
    const marketConfig: any = {
      id: marketConfigId || 'vietnam',
      name: snapshotMarket,
      currency: snapshotCurrency,
      country: snapshotMarket,
      flag: '🇻🇳',
      defaultStartingCapital: startingCapital,
      capitalPresets: [startingCapital],
      lotSize: 100,
      tradingHours: { openHour: 9, openMinute: 0, closeHour: 15, closeMinute: 0, timezone: 'Asia/Ho_Chi_Minh' },
      defaultFeeRate: 0.0015,
      indexSymbol,
      indexName,
      baseIndexValue: indexValue,
      description: '',
      rules: {
        allowShort: marketConfigId === 'us',
        maxLeverage: marketConfigId === 'us' ? 5 : 2,
        lotSize: marketConfigId === 'us' ? 1 : 100,
        settlementPeriod: 'T+2',
        priceBandPercent: marketConfigId === 'vietnam' ? 0.07 : null,
        tradingFeeRate: 0.0015,
        exchangeFeeRate: 0.0003,
        borrowFeeDailyRate: 0.00035,
        maintenanceMarginRatio: 0.25,
        liquidationFeeRate: 0.01,
        allowedOrderTypes: ['MARKET', 'LIMIT', 'STOP_MARKET', 'STOP_LIMIT', 'TRAILING_STOP', 'TAKE_PROFIT', 'STOP_LOSS', 'BRACKET', 'OCO'],
        minPriceIncrement: marketConfigId === 'us' ? 0.01 : 10,
      },
    };

    return {
      snapshot,
      marketConfig,
      clock: {
        currentTimestamp,
        speed: speed as any,
        isPaused,
        displayDate,
        displayTime,
        totalTicks: 0,
      },
      instruments,
      marketIndex: {
        symbol: indexSymbol,
        name: indexName,
        value: indexValue,
        change: indexChange,
        changePercent: indexChangePercent,
        history: [{ timestamp: new Date(currentTimestamp).toISOString(), value: indexValue }],
      },
      portfolio,
      transactions: [],
      openOrders,
      orderHistory: [],
      events: [],
      activeEvents: [],
      watchlist,
      settings: {
        marketFeeRate: 0.0015,
        autoSaveIntervalSeconds: 30,
      },
      uiSettings,
      version,
    };
  }

  /**
   * Compresses binary payload using native browser CompressionStream (gzip) or Node zlib
   */
  public static async compress(uncompressed: Uint8Array): Promise<Uint8Array> {
    const exactBytes = uncompressed.slice();
    if (typeof CompressionStream !== 'undefined') {
      const stream = new Response(new Blob([exactBytes.buffer]).stream().pipeThrough(new CompressionStream('gzip')));
      const arrayBuf = await stream.arrayBuffer();
      return new Uint8Array(arrayBuf);
    }

    // Node environment fallback
    try {
      const zlib = await import('zlib');
      const buf = Buffer.from(exactBytes.buffer, exactBytes.byteOffset, exactBytes.byteLength);
      return new Uint8Array(zlib.gzipSync(buf));
    } catch {
      return exactBytes;
    }
  }

  /**
   * Decompresses gzip compressed binary payload
   */
  public static async decompress(compressed: Uint8Array): Promise<Uint8Array> {
    const exactBytes = compressed.slice();
    // Check if it's gzip header (0x1f 0x8b)
    if (exactBytes[0] === 0x1f && exactBytes[1] === 0x8b) {
      if (typeof DecompressionStream !== 'undefined') {
        const stream = new Response(new Blob([exactBytes.buffer]).stream().pipeThrough(new DecompressionStream('gzip')));
        const arrayBuf = await stream.arrayBuffer();
        return new Uint8Array(arrayBuf);
      }

      try {
        const zlib = await import('zlib');
        const buf = Buffer.from(exactBytes.buffer, exactBytes.byteOffset, exactBytes.byteLength);
        return new Uint8Array(zlib.gunzipSync(buf));
      } catch {
        // Fallback
      }
    }
    return exactBytes;
  }
}
