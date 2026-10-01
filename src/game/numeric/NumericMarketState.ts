import { Instrument, Candle, StockStyle } from '../../types/market';
import { SimulationEvent } from '../../types/simulation';
import { SeededRandom } from '../../utils/seedRandom';
import { CandleRingBuffer } from './RingBuffer';

export class NumericMarketState {
  public readonly count: number;

  // Static Metadata Dictionaries
  public readonly symbolById: string[];
  public readonly idBySymbol: Map<string, number>;
  public readonly names: string[];
  public readonly exchanges: string[];
  public readonly sectors: string[];
  public readonly markets: string[];
  public readonly currencies: string[];
  public readonly lotSizes: Int32Array;
  public readonly betas: Float64Array;
  public readonly baseVolatilities: Float64Array;
  public readonly liquidities: Float64Array;
  public readonly styles: Int8Array; // 0=Growth, 1=Defensive, 2=Momentum, 3=High-Beta, 4=Value, 5=ETF
  public readonly isVietnamMarket: Uint8Array; // 1 if Vietnam, 0 otherwise

  // Sector Registry (Precomputed sector members)
  public readonly sectorNames: string[];
  public readonly sectorMembers: Int32Array[]; // Sector ID -> Array of instrument IDs
  public readonly sectorDrifts: Float64Array; // Drift per sector ID

  // Dynamic Structure-of-Arrays (SoA)
  public readonly currentPrices: Float64Array;
  public readonly previousCloses: Float64Array;
  public readonly openPrices: Float64Array;
  public readonly dayHighs: Float64Array;
  public readonly dayLows: Float64Array;
  public readonly volumes: Float64Array;
  public readonly momentums: Float64Array;
  public readonly candleBuffers: CandleRingBuffer[];
  public readonly dirtyFlags: Uint8Array;

  // Cached UI Presentation Objects (invalidated on tick)
  private presentationCache: Record<string, Instrument> | null = null;
  private singleInstrumentCache: (Instrument | null)[] = [];

  constructor(sourceInstruments: Record<string, Instrument>) {
    const symbols = Object.keys(sourceInstruments);
    this.count = symbols.length;

    this.symbolById = new Array(this.count);
    this.idBySymbol = new Map<string, number>();
    this.names = new Array(this.count);
    this.exchanges = new Array(this.count);
    this.sectors = new Array(this.count);
    this.markets = new Array(this.count);
    this.currencies = new Array(this.count);
    this.lotSizes = new Int32Array(this.count);
    this.betas = new Float64Array(this.count);
    this.baseVolatilities = new Float64Array(this.count);
    this.liquidities = new Float64Array(this.count);
    this.styles = new Int8Array(this.count);
    this.isVietnamMarket = new Uint8Array(this.count);

    this.currentPrices = new Float64Array(this.count);
    this.previousCloses = new Float64Array(this.count);
    this.openPrices = new Float64Array(this.count);
    this.dayHighs = new Float64Array(this.count);
    this.dayLows = new Float64Array(this.count);
    this.volumes = new Float64Array(this.count);
    this.momentums = new Float64Array(this.count);
    this.candleBuffers = new Array(this.count);
    this.dirtyFlags = new Uint8Array(this.count);
    this.singleInstrumentCache = new Array(this.count).fill(null);

    // Collect sectors
    const sectorSet = new Set<string>();
    const sectorToIdsMap = new Map<string, number[]>();

    for (let i = 0; i < this.count; i++) {
      const sym = symbols[i];
      const inst = sourceInstruments[sym];

      this.symbolById[i] = sym;
      this.idBySymbol.set(sym, i);
      this.names[i] = inst.name;
      this.exchanges[i] = inst.exchange;
      this.sectors[i] = inst.sector;
      this.markets[i] = inst.market;
      this.currencies[i] = inst.currency;
      this.lotSizes[i] = inst.lotSize || 1;
      this.betas[i] = inst.beta;
      this.baseVolatilities[i] = inst.volatility;
      this.liquidities[i] = inst.liquidity;
      this.isVietnamMarket[i] = inst.market === 'vietnam' ? 1 : 0;

      // Style mapping
      let styleCode: number = 0;
      if (inst.style === 'Defensive') styleCode = 1;
      else if (inst.style === 'Momentum') styleCode = 2;
      else if (inst.style === 'High-Beta') styleCode = 3;
      else if (inst.style === 'Value') styleCode = 4;
      else if (inst.style === 'ETF-Index') styleCode = 5;
      this.styles[i] = styleCode;

      // Sector mapping
      sectorSet.add(inst.sector);
      if (!sectorToIdsMap.has(inst.sector)) {
        sectorToIdsMap.set(inst.sector, []);
      }
      sectorToIdsMap.get(inst.sector)!.push(i);

      // Dynamic values
      this.currentPrices[i] = inst.currentPrice;
      this.previousCloses[i] = inst.previousClose;
      this.openPrices[i] = inst.openPrice;
      this.dayHighs[i] = inst.dayHigh;
      this.dayLows[i] = inst.dayLow;
      this.volumes[i] = inst.volume;
      this.momentums[i] = inst.momentum;

      // Initialize candle ring buffer
      const ring = new CandleRingBuffer(60);
      if (inst.history && inst.history.length > 0) {
        ring.loadFromCandles(inst.history);
      } else {
        ring.push(Date.now(), inst.openPrice, inst.dayHigh, inst.dayLow, inst.currentPrice, inst.volume);
      }
      this.candleBuffers[i] = ring;
    }

    // Initialize precomputed sectors
    this.sectorNames = Array.from(sectorSet);
    this.sectorDrifts = new Float64Array(this.sectorNames.length);
    this.sectorMembers = new Array(this.sectorNames.length);

    for (let s = 0; s < this.sectorNames.length; s++) {
      const sName = this.sectorNames[s];
      const memberIds = sectorToIdsMap.get(sName) || [];
      this.sectorMembers[s] = new Int32Array(memberIds);
    }
  }

  /**
   * Fast Structure-of-Arrays price step.
   * Eliminates all intermediate object allocations, string conversions, and array cloning.
   */
  public stepPrices(
    marketTrend: number,
    activeEvents: SimulationEvent[],
    rng: SeededRandom,
    tickTimestampMs: number,
    isNewDay: boolean
  ): void {
    // 1. Evolve sector drifts in place
    for (let s = 0; s < this.sectorNames.length; s++) {
      const prevDrift = this.sectorDrifts[s];
      const nextDrift = prevDrift * 0.9 + rng.nextGaussian() * 0.003;
      this.sectorDrifts[s] = Math.max(-0.03, Math.min(0.03, nextDrift));
    }

    // 2. Precompute active events impact lookup by sector/market
    const numEvents = activeEvents.length;
    let globalEventImpact = 0;
    const sectorEventImpacts = new Float64Array(this.sectorNames.length);

    for (let e = 0; e < numEvents; e++) {
      const ev = activeEvents[e];
      if (!ev.affectedSector && !ev.affectedMarket) {
        globalEventImpact += ev.impact * 0.15;
      } else if (ev.affectedSector) {
        const sIdx = this.sectorNames.indexOf(ev.affectedSector);
        if (sIdx !== -1) {
          sectorEventImpacts[sIdx] += ev.impact * 0.15;
        }
      }
    }

    // 3. Vectorized loop over instruments
    for (let i = 0; i < this.count; i++) {
      const beta = this.betas[i];
      const currPrice = this.currentPrices[i];
      const prevClose = this.previousCloses[i];
      const vol = this.baseVolatilities[i];
      const mom = this.momentums[i];
      const style = this.styles[i];

      // Market factor
      const marketFactor = marketTrend * beta;

      // Sector factor
      const sIdx = this.sectorNames.indexOf(this.sectors[i]);
      const sectorDrift = sIdx !== -1 ? this.sectorDrifts[sIdx] : 0;
      const sectorSensitivity = style === 1 ? 0.6 : style === 0 ? 1.3 : 1.0;
      const sectorFactor = sectorDrift * sectorSensitivity;

      // Momentum factor
      const momentumFactor = mom * 0.2;

      // Mean reversion
      const pctFromPrevClose = prevClose > 0 ? (currPrice - prevClose) / prevClose : 0;
      const meanReversionFactor = -0.04 * pctFromPrevClose;

      // Liquidity & random noise
      const noiseVariance = style === 3 ? 1.4 : style === 1 ? 0.7 : 1.0;
      const randomNoise = rng.nextGaussian() * vol * 0.6 * noiseVariance;
      const liquidityFactor = (1 - this.liquidities[i]) * rng.nextGaussian() * vol * 0.4;

      // Event factor
      const eventMultiplier = style === 3 ? 1.5 : style === 1 ? 0.5 : 1.0;
      let totalEventImpact = globalEventImpact;
      if (sIdx !== -1) {
        totalEventImpact += sectorEventImpacts[sIdx];
      }
      const eventFactor = totalEventImpact * eventMultiplier;

      // Total step return
      const stepReturn = marketFactor + sectorFactor + momentumFactor + meanReversionFactor + liquidityFactor + randomNoise + eventFactor;

      // Next price
      let nextPrice = currPrice * (1 + stepReturn);

      // Price limits & rounding (numerical, no strings or toFixed)
      if (this.isVietnamMarket[i] === 1) {
        const ceiling = Math.floor(prevClose * 1.07);
        const floor = Math.ceil(prevClose * 0.93);
        if (nextPrice > ceiling) nextPrice = ceiling;
        if (nextPrice < floor) nextPrice = floor;
        nextPrice = Math.round(nextPrice / 10) * 10;
        if (nextPrice < 100) nextPrice = 100;
      } else {
        // Round to cents numerically
        nextPrice = Math.round(nextPrice * 100) / 100;
        if (nextPrice < 0.01) nextPrice = 0.01;
      }

      // Volume calculation
      const baseTickVolume = this.volumes[i] > 0 ? Math.floor(this.volumes[i] * 0.01) : 1000;
      const volMultiplier = 1 + Math.abs(stepReturn) * 20;
      const tickVol = Math.floor(baseTickVolume * volMultiplier * (0.8 + rng.next() * 0.4));
      const accumulatedVol = (isNewDay ? 0 : this.volumes[i]) + tickVol;

      // High / Low
      const dayHigh = isNewDay ? nextPrice : Math.max(this.dayHighs[i], nextPrice);
      const dayLow = isNewDay ? nextPrice : Math.min(this.dayLows[i], nextPrice);
      const openPrice = isNewDay ? nextPrice : this.openPrices[i];
      const newPrevClose = isNewDay ? currPrice : prevClose;
      const newMomentum = mom * 0.85 + stepReturn * 0.15;

      // Update dense buffers
      this.currentPrices[i] = nextPrice;
      this.dayHighs[i] = dayHigh;
      this.dayLows[i] = dayLow;
      this.openPrices[i] = openPrice;
      this.previousCloses[i] = newPrevClose;
      this.volumes[i] = accumulatedVol;
      this.momentums[i] = newMomentum;

      // Update ring buffer
      const ring = this.candleBuffers[i];
      if (isNewDay || ring.count === 0) {
        ring.push(tickTimestampMs, nextPrice, nextPrice, nextPrice, nextPrice, tickVol);
      } else {
        ring.updateLatest(dayHigh, dayLow, nextPrice, accumulatedVol);
      }

      this.dirtyFlags[i] = 1;
      this.singleInstrumentCache[i] = null;
    }

    this.presentationCache = null;
  }

  /**
   * Presentation adapter: converts individual instrument to UI representation on demand
   */
  public getInstrument(symbol: string): Instrument | null {
    const idx = this.idBySymbol.get(symbol);
    if (idx === undefined) return null;

    if (this.singleInstrumentCache[idx]) {
      return this.singleInstrumentCache[idx];
    }

    const inst: Instrument = {
      symbol,
      name: this.names[idx],
      exchange: this.exchanges[idx],
      market: this.markets[idx],
      currency: this.currencies[idx],
      sector: this.sectors[idx],
      currentPrice: this.currentPrices[idx],
      previousClose: this.previousCloses[idx],
      openPrice: this.openPrices[idx],
      dayHigh: this.dayHighs[idx],
      dayLow: this.dayLows[idx],
      volume: this.volumes[idx],
      volatility: this.baseVolatilities[idx],
      history: this.candleBuffers[idx].toArray(),
      assetType: 'Stock',
      style: (['Growth', 'Defensive', 'Momentum', 'High-Beta', 'Value', 'ETF-Index'] as StockStyle[])[this.styles[idx]],
      beta: this.betas[idx],
      momentum: this.momentums[idx],
      liquidity: this.liquidities[idx],
      lotSize: this.lotSizes[idx],
      isRealDataOrigin: true,
    };

    this.singleInstrumentCache[idx] = inst;
    return inst;
  }

  /**
   * Presentation adapter: returns all instruments as a Record for components that require it
   */
  public toRecord(): Record<string, Instrument> {
    if (this.presentationCache) {
      return this.presentationCache;
    }

    const record: Record<string, Instrument> = {};
    for (let i = 0; i < this.count; i++) {
      const sym = this.symbolById[i];
      record[sym] = this.getInstrument(sym)!;
    }

    this.presentationCache = record;
    return record;
  }
}
