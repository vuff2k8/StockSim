import React, { useState, useMemo } from 'react';
import {
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Shield,
  Layers,
  Zap,
  Sliders,
  DollarSign,
  Info,
  CheckCircle2,
  X,
  Target,
  ArrowRight,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Instrument, MarketConfig } from '../types/market';
import {
  FeeConfig,
  OrderSide,
  OrderTier,
  OrderType,
  PositionEffect,
  TimeInForce,
} from '../types/order';
import { Portfolio } from '../types/portfolio';
import { OrderEngine, SubmitOrderParams, SubmitOrderResult } from '../game/orders/OrderEngine';
import {
  formatCurrency,
  formatStockPrice,
  formatPercent,
} from '../utils/formatters';

interface TradingTerminalOrderPanelProps {
  instrument: Instrument;
  portfolio: Portfolio;
  marketConfig: MarketConfig;
  feeConfig: FeeConfig;
  activeTier?: OrderTier;
  onTierChange?: (tier: OrderTier) => void;
  onSubmitOrder: (params: SubmitOrderParams) => SubmitOrderResult;
  onClose?: () => void;
  inline?: boolean;
}

export const TradingTerminalOrderPanel: React.FC<TradingTerminalOrderPanelProps> = ({
  instrument,
  portfolio,
  marketConfig,
  feeConfig,
  activeTier: initialTier = 'BASIC',
  onTierChange,
  onSubmitOrder,
  onClose,
  inline = false,
}) => {
  const [tier, setTier] = useState<OrderTier>(initialTier);
  const [side, setSide] = useState<OrderSide>('BUY');
  const [positionEffect, setPositionEffect] = useState<PositionEffect>('OPEN_LONG');
  const [orderType, setOrderType] = useState<OrderType>('MARKET');
  const [timeInForce, setTimeInForce] = useState<TimeInForce>('GTC');

  // Basic Mode action: 'BUY' | 'SELL' | 'CLOSE'
  const [basicMode, setBasicMode] = useState<'BUY' | 'SELL' | 'CLOSE'>('BUY');

  const lotSize = marketConfig.rules.lotSize || 1;
  const [quantity, setQuantity] = useState<number>(lotSize);

  // Advanced & Pro fields
  const [limitPrice, setLimitPrice] = useState<number>(instrument.currentPrice);
  const [stopPrice, setStopPrice] = useState<number>(instrument.currentPrice);
  const [enableTP, setEnableTP] = useState<boolean>(false);
  const [tpPrice, setTpPrice] = useState<number>(
    () => Math.round(instrument.currentPrice * 1.05)
  );
  const [enableSL, setEnableSL] = useState<boolean>(false);
  const [slPrice, setSlPrice] = useState<number>(
    () => Math.round(instrument.currentPrice * 0.95)
  );
  const [trailingPercent, setTrailingPercent] = useState<number>(5); // 5%
  const [leverage, setLeverage] = useState<number>(1);

  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null
  );
  const [confirmingHighRisk, setConfirmingHighRisk] = useState<boolean>(false);

  const existingPosition = portfolio.positions[instrument.symbol];
  const holdingShares = existingPosition ? existingPosition.quantity : 0;
  const hasPosition = !!existingPosition && existingPosition.quantity > 0;
  const maxMarketLeverage = marketConfig.rules.maxLeverage || 1;
  const allowShort = marketConfig.rules.allowShort;

  // Compact secondary drawer state for Pro mode
  const [showSecondaryDrawer, setShowSecondaryDrawer] = useState<boolean>(() => {
    return leverage > 1 || enableTP || enableSL || orderType === 'BRACKET' || orderType === 'OCO' || orderType === 'TRAILING_STOP';
  });

  const handleTierSwitch = (newTier: OrderTier) => {
    setTier(newTier);
    if (onTierChange) onTierChange(newTier);
    setFeedback(null);
    setConfirmingHighRisk(false);

    // Reset scroll position safely using requestAnimationFrame (Requirement 7)
    requestAnimationFrame(() => {
      const scrollContainer = document.getElementById('app-scroll-container');
      if (scrollContainer) {
        scrollContainer.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });

    if (newTier === 'BASIC') {
      setOrderType('MARKET');
      setLeverage(1);
      setEnableTP(false);
      setEnableSL(false);
      // Restore basic mode selection
      if (basicMode === 'BUY') {
        setSide('BUY');
        setPositionEffect('OPEN_LONG');
      } else if (basicMode === 'SELL') {
        setSide('SELL');
        setPositionEffect('CLOSE_LONG');
      } else if (basicMode === 'CLOSE' && hasPosition) {
        setSide(existingPosition.side === 'LONG' ? 'SELL' : 'BUY');
        setPositionEffect(existingPosition.side === 'LONG' ? 'CLOSE_LONG' : 'CLOSE_SHORT');
        setQuantity(holdingShares);
      }
    } else if (newTier === 'ADVANCED') {
      if (leverage > 1) setLeverage(1);
      if (orderType === 'MARKET') setOrderType('LIMIT');
      if (positionEffect === 'OPEN_SHORT') {
        setSide('BUY');
        setPositionEffect('OPEN_LONG');
      }
    } else if (newTier === 'PRO') {
      // Keep existing pro state or set default
    }
  };

  // Basic Tier 3-way action handler (BUY / SELL / CLOSE)
  const handleBasicAction = (action: 'BUY' | 'SELL' | 'CLOSE') => {
    setBasicMode(action);
    setFeedback(null);
    setOrderType('MARKET');
    setLeverage(1);

    if (action === 'BUY') {
      setSide('BUY');
      setPositionEffect('OPEN_LONG');
      if (quantity === holdingShares && holdingShares > 0) {
        setQuantity(lotSize);
      }
    } else if (action === 'SELL') {
      setSide('SELL');
      setPositionEffect('CLOSE_LONG');
      if (holdingShares > 0 && quantity > holdingShares) {
        setQuantity(holdingShares);
      }
    } else if (action === 'CLOSE') {
      if (hasPosition) {
        setSide(existingPosition.side === 'LONG' ? 'SELL' : 'BUY');
        setPositionEffect(existingPosition.side === 'LONG' ? 'CLOSE_LONG' : 'CLOSE_SHORT');
        setQuantity(holdingShares);
      }
    }
  };

  // Advanced / Pro Side & Effect Handler
  const handleSideChange = (newSide: OrderSide, effect?: PositionEffect) => {
    setSide(newSide);
    setConfirmingHighRisk(false);
    setFeedback(null);

    if (effect) {
      setPositionEffect(effect);
      return;
    }

    if (newSide === 'BUY') {
      if (existingPosition && existingPosition.side === 'SHORT') {
        setPositionEffect('CLOSE_SHORT');
      } else {
        setPositionEffect('OPEN_LONG');
      }
    } else {
      if (existingPosition && existingPosition.side === 'LONG') {
        setPositionEffect('CLOSE_LONG');
      } else if (allowShort && tier === 'PRO') {
        setPositionEffect('OPEN_SHORT');
      } else {
        setPositionEffect('CLOSE_LONG');
      }
    }
  };

  // Preview calculation
  const preview = useMemo(() => {
    return OrderEngine.calculatePreview(
      {
        instrument,
        side,
        positionEffect,
        orderType,
        tier,
        quantity,
        price: instrument.currentPrice,
        limitPrice: orderType === 'LIMIT' || orderType === 'STOP_LIMIT' || orderType === 'BRACKET' ? limitPrice : undefined,
        stopPrice: orderType === 'STOP_MARKET' || orderType === 'STOP_LIMIT' ? stopPrice : undefined,
        tpPrice: enableTP || orderType === 'BRACKET' || orderType === 'OCO' ? tpPrice : undefined,
        slPrice: enableSL || orderType === 'BRACKET' || orderType === 'OCO' ? slPrice : undefined,
        trailingPercent: orderType === 'TRAILING_STOP' ? trailingPercent / 100 : undefined,
        leverage,
        timeInForce,
      },
      portfolio,
      feeConfig,
      marketConfig
    );
  }, [
    instrument,
    side,
    positionEffect,
    orderType,
    tier,
    quantity,
    limitPrice,
    stopPrice,
    enableTP,
    tpPrice,
    enableSL,
    slPrice,
    trailingPercent,
    leverage,
    timeInForce,
    portfolio,
    feeConfig,
    marketConfig,
  ]);

  // Quick percentage sizing (+10%, +25%, +50%, MAX)
  const handleQuickPercent = (pct: number) => {
    if (side === 'BUY' || positionEffect.startsWith('OPEN')) {
      const priceForCalc = (orderType === 'LIMIT' ? limitPrice : instrument.currentPrice) / leverage;
      const budget = portfolio.availableMargin * (pct / 100);
      const rawShares = Math.floor(budget / priceForCalc);
      const rounded = Math.floor(rawShares / lotSize) * lotSize;
      setQuantity(Math.max(lotSize, rounded));
    } else {
      // Closing position
      if (holdingShares > 0) {
        const rawShares = Math.floor((holdingShares * pct) / 100);
        const rounded = Math.floor(rawShares / lotSize) * lotSize;
        setQuantity(Math.max(lotSize, Math.min(holdingShares, rounded || lotSize)));
      }
    }
    setFeedback(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!preview.isValid) {
      setFeedback({ type: 'error', message: preview.errorMessage || 'Lệnh không hợp lệ.' });
      return;
    }

    // High risk confirmation requirement for leverage > 1 or short selling
    if (preview.requiresHighRiskConfirmation && !confirmingHighRisk) {
      setConfirmingHighRisk(true);
      return;
    }

    const result = onSubmitOrder({
      instrument,
      side,
      positionEffect,
      orderType,
      tier,
      quantity,
      price: instrument.currentPrice,
      limitPrice: orderType === 'LIMIT' || orderType === 'STOP_LIMIT' || orderType === 'BRACKET' ? limitPrice : undefined,
      stopPrice: orderType === 'STOP_MARKET' || orderType === 'STOP_LIMIT' ? stopPrice : undefined,
      tpPrice: enableTP || orderType === 'BRACKET' || orderType === 'OCO' ? tpPrice : undefined,
      slPrice: enableSL || orderType === 'BRACKET' || orderType === 'OCO' ? slPrice : undefined,
      trailingPercent: orderType === 'TRAILING_STOP' ? trailingPercent / 100 : undefined,
      leverage,
      timeInForce,
    });

    if (result.success) {
      setConfirmingHighRisk(false);
      setFeedback({
        type: 'success',
        message:
          orderType === 'MARKET'
            ? `Đã khớp lệnh Thị trường ${side} ${quantity.toLocaleString()} ${instrument.symbol} thành công!`
            : `Đã gửi lệnh ${orderType} ${side} ${quantity.toLocaleString()} ${instrument.symbol} vào hệ thống!`,
      });
      setTimeout(() => {
        setFeedback(null);
        if (onClose) onClose();
      }, 1400);
    } else {
      setFeedback({ type: 'error', message: result.errorMessage || 'Lỗi gửi lệnh.' });
    }
  };

  // Liquidation distance percentage
  const liquidationDistancePct = useMemo(() => {
    if (!preview.estimatedLiquidationPrice || instrument.currentPrice <= 0) return null;
    const diff = ((preview.estimatedLiquidationPrice - instrument.currentPrice) / instrument.currentPrice) * 100;
    return diff;
  }, [preview.estimatedLiquidationPrice, instrument.currentPrice]);

  return (
    <div className={`bg-neutral-900 border border-neutral-800 rounded-2xl overflow-visible h-auto min-h-max shadow-2xl ${inline ? 'w-full' : 'max-w-md w-full'}`}>
      {/* 1. Header with 3 Tiers (Basic / Advanced / Pro) and Dismiss Button */}
      <div className="bg-neutral-950 px-4 py-3 border-b border-neutral-800 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold text-white text-base">{instrument.symbol}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-300 font-mono">
              {instrument.exchange}
            </span>
            <span className="text-[10px] text-neutral-400 font-mono">
              {instrument.market.toUpperCase()}
            </span>
          </div>
          <span className="text-[11px] text-neutral-400 font-mono">
            Giá hiện tại:{' '}
            <span className="text-white font-bold">
              {formatStockPrice(instrument.currentPrice, instrument.currency)}
            </span>
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* 3-Tier Selector Buttons */}
          <div className="flex items-center p-0.5 bg-neutral-900 rounded-lg border border-neutral-800 text-xs font-semibold">
            {(['BASIC', 'ADVANCED', 'PRO'] as OrderTier[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => handleTierSwitch(t)}
                className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                  tier === t
                    ? 'bg-emerald-600 text-white shadow-xs font-bold'
                    : 'text-neutral-400 hover:text-white'
                }`}
                title={t === 'BASIC' ? 'Beginner Mode' : t === 'ADVANCED' ? 'Advanced Mode' : 'Pro Mode'}
                data-tier={t}
              >
                {t === 'BASIC' ? 'Cơ bản' : t === 'ADVANCED' ? 'Nâng cao' : 'Pro'}
              </button>
            ))}
          </div>

          {onClose && (
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
              title="Đóng cửa sổ đặt lệnh"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* TIER 1: BASIC (BUY / SELL / Close) */}
        {tier === 'BASIC' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-[11px] text-neutral-400 font-medium">
              <span>CHẾ ĐỘ GIAO DỊCH CƠ BẢN</span>
              <span className="text-emerald-400 font-mono font-semibold">Khớp tức thì (Market)</span>
            </div>

            {/* 3 Distinct Buttons: BUY / SELL / Close */}
            <div className="grid grid-cols-3 gap-2 p-1 bg-neutral-950 rounded-xl border border-neutral-800">
              {/* 1. BUY */}
              <button
                type="button"
                onClick={() => handleBasicAction('BUY')}
                className={`py-2 px-2 text-xs font-bold rounded-lg transition-all cursor-pointer flex flex-col items-center justify-center gap-0.5 ${
                  basicMode === 'BUY'
                    ? 'bg-emerald-600 text-white shadow-md'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                <span>MUA (BUY)</span>
                <span className="text-[10px] font-normal opacity-80">Mở vị thế</span>
              </button>

              {/* 2. SELL */}
              <button
                type="button"
                onClick={() => handleBasicAction('SELL')}
                className={`py-2 px-2 text-xs font-bold rounded-lg transition-all cursor-pointer flex flex-col items-center justify-center gap-0.5 ${
                  basicMode === 'SELL'
                    ? 'bg-rose-600 text-white shadow-md'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                <span>BÁN (SELL)</span>
                <span className="text-[10px] font-normal opacity-80">Hạ tỷ trọng</span>
              </button>

              {/* 3. CLOSE */}
              <button
                type="button"
                disabled={!hasPosition}
                onClick={() => handleBasicAction('CLOSE')}
                className={`py-2 px-2 text-xs font-bold rounded-lg transition-all flex flex-col items-center justify-center gap-0.5 ${
                  !hasPosition
                    ? 'bg-neutral-900/50 text-neutral-600 cursor-not-allowed border border-neutral-800/40'
                    : basicMode === 'CLOSE'
                    ? 'bg-amber-600 text-white shadow-md cursor-pointer'
                    : 'text-neutral-400 hover:text-white cursor-pointer'
                }`}
              >
                <span>ĐÓNG (CLOSE)</span>
                <span className="text-[10px] font-normal opacity-80">
                  {hasPosition ? `${holdingShares.toLocaleString()} CP` : 'Chưa có CP'}
                </span>
              </button>
            </div>

            {/* Position info banner if in Close mode */}
            {basicMode === 'CLOSE' && hasPosition && (
              <div className="p-2.5 bg-amber-950/40 border border-amber-800/50 rounded-xl text-xs text-amber-200 flex items-center justify-between">
                <span>
                  Đang đóng vị thế {existingPosition.side}:{' '}
                  <strong className="text-white">{holdingShares.toLocaleString()} CP</strong>
                </span>
                <button
                  type="button"
                  onClick={() => setQuantity(holdingShares)}
                  className="px-2 py-0.5 bg-amber-600 hover:bg-amber-500 text-white text-[11px] font-bold rounded transition-colors"
                >
                  Đóng 100%
                </button>
              </div>
            )}
          </div>
        )}

        {/* TIER 2: ADVANCED (Limit / Stop / TP / SL / Trailing) */}
        {tier === 'ADVANCED' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-[11px] text-neutral-400 font-medium">
              <span>CHẾ ĐỘ NÂNG CAO (SPOT ORDER ENGINE)</span>
              <span className="text-emerald-400 font-mono">Đòn bẩy 1x · Spot</span>
            </div>

            {/* Buy / Sell Selector */}
            <div className="grid grid-cols-2 gap-2 p-1 bg-neutral-950 rounded-xl border border-neutral-800">
              <button
                type="button"
                onClick={() => handleSideChange('BUY')}
                className={`py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  side === 'BUY'
                    ? 'bg-emerald-600 text-white shadow-md'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                MUA (BUY)
              </button>
              <button
                type="button"
                onClick={() => handleSideChange('SELL')}
                className={`py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  side === 'SELL'
                    ? 'bg-rose-600 text-white shadow-md'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                BÁN (SELL)
              </button>
            </div>

            {/* Advanced Order Types: Limit / Stop / Stop Limit / Trailing */}
            <div>
              <label className="text-[11px] font-semibold text-neutral-400 block mb-1.5 uppercase tracking-wider">
                Loại lệnh nâng cao
              </label>
              <div className="grid grid-cols-4 gap-1.5 text-xs font-mono">
                {[
                  { id: 'LIMIT', label: 'Limit' },
                  { id: 'STOP_MARKET', label: 'Stop' },
                  { id: 'STOP_LIMIT', label: 'Stop Limit' },
                  { id: 'TRAILING_STOP', label: 'Trailing' },
                ].map((ot) => (
                  <button
                    key={ot.id}
                    type="button"
                    onClick={() => setOrderType(ot.id as OrderType)}
                    className={`py-1.5 px-2 rounded-lg border text-center transition-colors cursor-pointer ${
                      orderType === ot.id
                        ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400 font-bold'
                        : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-white'
                    }`}
                  >
                    {ot.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TIER 3: PRO (Margin / Leverage / Short / Bracket / OCO / Risk) */}
        {tier === 'PRO' && (
          <div className="space-y-3 overflow-visible h-auto">
            <div className="flex items-center justify-between text-[11px] text-amber-400 font-medium">
              <span>TERMINAL PRO ENGINE</span>
              <span className="font-mono text-neutral-400">
                {allowShort ? 'Hỗ trợ Short' : 'Không short'} · Max {maxMarketLeverage}x
              </span>
            </div>

            {/* Action Buttons: Long, Sell, Short, Close - 2x2 on mobile, 4-col on desktop */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-1.5 bg-neutral-950 rounded-xl border border-neutral-800 text-xs font-bold">
              <button
                type="button"
                onClick={() => handleSideChange('BUY', 'OPEN_LONG')}
                className={`py-2.5 px-2 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  side === 'BUY' && positionEffect === 'OPEN_LONG'
                    ? 'bg-emerald-600 text-white shadow-md'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                <span>MUA (LONG)</span>
              </button>

              <button
                type="button"
                onClick={() => handleSideChange('SELL', 'CLOSE_LONG')}
                className={`py-2.5 px-2 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  side === 'SELL' && positionEffect === 'CLOSE_LONG'
                    ? 'bg-rose-600 text-white shadow-md'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                <span>BÁN (SELL)</span>
              </button>

              {/* Short Selling (Conditional by market rules) */}
              <button
                type="button"
                disabled={!allowShort}
                onClick={() => {
                  if (allowShort) {
                    setSide('SELL');
                    setPositionEffect('OPEN_SHORT');
                  }
                }}
                className={`py-2.5 px-2 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                  !allowShort
                    ? 'bg-neutral-900/40 text-neutral-600 cursor-not-allowed'
                    : side === 'SELL' && positionEffect === 'OPEN_SHORT'
                    ? 'bg-purple-600 text-white shadow-md cursor-pointer'
                    : 'text-neutral-400 hover:text-white cursor-pointer'
                }`}
                title={allowShort ? 'Bán khống cổ phiếu' : 'Sàn không hỗ trợ bán khống'}
              >
                <span>SHORT {allowShort ? '' : '(N/A)'}</span>
              </button>

              {/* Close Position */}
              <button
                type="button"
                disabled={!hasPosition}
                onClick={() => {
                  if (hasPosition) {
                    setSide(existingPosition.side === 'LONG' ? 'SELL' : 'BUY');
                    setPositionEffect(existingPosition.side === 'LONG' ? 'CLOSE_LONG' : 'CLOSE_SHORT');
                    setQuantity(holdingShares);
                  }
                }}
                className={`py-2.5 px-2 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                  !hasPosition
                    ? 'bg-neutral-900/40 text-neutral-600 cursor-not-allowed'
                    : positionEffect.startsWith('CLOSE')
                    ? 'bg-amber-600 text-white shadow-md cursor-pointer'
                    : 'text-neutral-400 hover:text-white cursor-pointer'
                }`}
              >
                <span>ĐÓNG</span>
              </button>
            </div>

            {/* Primary Order Types (Market / Limit / Stop Limit) */}
            <div>
              <label className="text-[11px] font-semibold text-neutral-400 block mb-1.5 uppercase tracking-wider">
                Loại lệnh cơ bản Pro
              </label>
              <div className="grid grid-cols-3 gap-1.5 text-xs font-mono">
                {[
                  { id: 'MARKET', label: 'Market' },
                  { id: 'LIMIT', label: 'Limit' },
                  { id: 'STOP_LIMIT', label: 'Stop Limit' },
                ].map((ot) => (
                  <button
                    key={ot.id}
                    type="button"
                    onClick={() => setOrderType(ot.id as OrderType)}
                    className={`py-2 px-1 rounded-lg border text-center transition-colors cursor-pointer text-xs ${
                      orderType === ot.id
                        ? 'bg-amber-500/20 border-amber-500 text-amber-300 font-bold'
                        : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-white'
                    }`}
                  >
                    {ot.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Secondary Controls Drawer / Accordion (Requirement 10) */}
            <div className="border border-neutral-800 rounded-xl overflow-visible bg-neutral-950/70">
              <button
                type="button"
                onClick={() => setShowSecondaryDrawer((prev) => !prev)}
                className="w-full px-3 py-2.5 flex items-center justify-between text-xs text-neutral-300 hover:text-white transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <Sliders className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span className="font-semibold">Lệnh nâng cao & Đòn bẩy (TP/SL, Leverage)</span>
                  {(leverage > 1 || enableTP || enableSL || ['TRAILING_STOP', 'BRACKET', 'OCO'].includes(orderType)) && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-500/20 text-amber-300 font-mono font-bold">
                      {leverage > 1 ? `${leverage}x` : ''} {['TRAILING_STOP', 'BRACKET', 'OCO'].includes(orderType) ? orderType : ''}
                    </span>
                  )}
                </div>
                {showSecondaryDrawer ? (
                  <ChevronUp className="w-4 h-4 text-neutral-400 shrink-0" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-neutral-400 shrink-0" />
                )}
              </button>

              {showSecondaryDrawer && (
                <div className="p-3 pt-1 border-t border-neutral-800/80 space-y-3">
                  {/* Secondary Advanced Order Types */}
                  <div>
                    <span className="text-[11px] text-neutral-400 block mb-1.5 font-medium">
                      Lệnh điều kiện phức hợp:
                    </span>
                    <div className="grid grid-cols-3 gap-1.5 text-xs font-mono">
                      {[
                        { id: 'TRAILING_STOP', label: 'Trailing' },
                        { id: 'BRACKET', label: 'Bracket' },
                        { id: 'OCO', label: 'OCO' },
                      ].map((ot) => (
                        <button
                          key={ot.id}
                          type="button"
                          onClick={() => setOrderType(ot.id as OrderType)}
                          className={`py-1.5 px-1 rounded-lg border text-center transition-colors cursor-pointer text-[11px] ${
                            orderType === ot.id
                              ? 'bg-amber-500/20 border-amber-500 text-amber-300 font-bold'
                              : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-white'
                          }`}
                        >
                          {ot.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 4. Form inputs (Quantity, Prices, TP/SL, Leverage) */}
        <form onSubmit={handleSubmit} className="space-y-3.5">
          {/* Quantity */}
          <div>
            <div className="flex items-center justify-between text-xs text-neutral-400 mb-1">
              <span>Số lượng (Lô: {lotSize})</span>
              <span>
                {holdingShares > 0
                  ? `Đang có: ${holdingShares.toLocaleString()} CP`
                  : `Sức mua: ${formatCurrency(portfolio.availableMargin, portfolio.currency, { compact: true })}`}
              </span>
            </div>
            <div className="relative">
              <input
                type="number"
                min={lotSize}
                step={lotSize}
                value={quantity || ''}
                onChange={(e) => {
                  setQuantity(parseInt(e.target.value) || 0);
                  setFeedback(null);
                }}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2.5 font-mono text-sm text-white focus:outline-none focus:border-emerald-500"
                placeholder={`Bội số của ${lotSize}`}
              />
              <span className="absolute right-3 top-2.5 text-xs text-neutral-500 font-mono">CP</span>
            </div>

            {/* Quick Sizing Buttons */}
            <div className="grid grid-cols-4 gap-1.5 mt-2">
              {[10, 25, 50, 100].map((pct) => (
                <button
                  key={pct}
                  type="button"
                  onClick={() => handleQuickPercent(pct)}
                  className="py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-[11px] font-mono rounded transition-colors cursor-pointer"
                >
                  {pct === 100 ? 'MAX' : `${pct}%`}
                </button>
              ))}
            </div>
          </div>

          {/* Conditional Price Fields */}
          {(orderType === 'LIMIT' || orderType === 'STOP_LIMIT' || orderType === 'BRACKET') && (
            <div>
              <div className="flex items-center justify-between text-xs text-neutral-400 mb-1">
                <span>
                  {orderType === 'BRACKET' ? 'Giá khớp mở vị thế (Entry Limit)' : 'Giá giới hạn (Limit Price)'}
                </span>
                <span className="font-mono text-neutral-300">
                  {formatStockPrice(limitPrice, instrument.currency)}
                </span>
              </div>
              <input
                type="number"
                step={marketConfig.rules.minPriceIncrement}
                value={limitPrice || ''}
                onChange={(e) => setLimitPrice(parseFloat(e.target.value) || 0)}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2 font-mono text-sm text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
          )}

          {(orderType === 'STOP_MARKET' || orderType === 'STOP_LIMIT') && (
            <div>
              <div className="flex items-center justify-between text-xs text-neutral-400 mb-1">
                <span>Giá kích hoạt (Stop Price)</span>
                <span className="font-mono text-neutral-300">
                  {formatStockPrice(stopPrice, instrument.currency)}
                </span>
              </div>
              <input
                type="number"
                step={marketConfig.rules.minPriceIncrement}
                value={stopPrice || ''}
                onChange={(e) => setStopPrice(parseFloat(e.target.value) || 0)}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2 font-mono text-sm text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
          )}

          {orderType === 'TRAILING_STOP' && (
            <div>
              <div className="flex items-center justify-between text-xs text-neutral-400 mb-1">
                <span>Khoảng kéo dừng lỗ (Trailing Delta %)</span>
                <span className="font-mono text-emerald-400 font-bold">{trailingPercent}%</span>
              </div>
              <input
                type="number"
                min={1}
                max={50}
                step={0.5}
                value={trailingPercent}
                onChange={(e) => setTrailingPercent(parseFloat(e.target.value) || 5)}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2 font-mono text-sm text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
          )}

          {/* TP & SL Configuration (Advanced & Pro) */}
          {(tier === 'ADVANCED' || (tier === 'PRO' && (orderType === 'BRACKET' || orderType === 'OCO' || enableTP || enableSL))) && orderType !== 'TRAILING_STOP' && (
            <div className="p-3 bg-neutral-950/80 rounded-xl border border-neutral-800 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-neutral-300 flex items-center gap-1.5">
                  <Target className="w-3.5 h-3.5 text-emerald-400" />
                  {orderType === 'BRACKET'
                    ? 'Chốt lời & Cắt lỗ tự động (Bracket)'
                    : orderType === 'OCO'
                    ? 'Cặp lệnh điều kiện OCO (One-Cancels-Other)'
                    : 'Cài đặt Chốt lời & Cắt lỗ (TP / SL)'}
                </span>
                <span className="text-[10px] text-neutral-500 font-mono">Conditional Engine</span>
              </div>

              {/* TP Toggle & Field */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-1.5">
                <div className="flex items-center gap-2 shrink-0">
                  {orderType !== 'BRACKET' && orderType !== 'OCO' ? (
                    <input
                      type="checkbox"
                      id="enableTP"
                      checked={enableTP}
                      onChange={(e) => setEnableTP(e.target.checked)}
                      className="rounded bg-neutral-800 border-neutral-700 text-emerald-500 focus:ring-0 cursor-pointer"
                    />
                  ) : (
                    <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
                  )}
                  <label htmlFor="enableTP" className="text-xs text-neutral-300 cursor-pointer shrink-0">
                    TP (Chốt lời):
                  </label>
                </div>
                {(enableTP || orderType === 'BRACKET' || orderType === 'OCO') && (
                  <div className="flex-1 flex items-center gap-1.5 min-w-0">
                    <input
                      type="number"
                      step={marketConfig.rules.minPriceIncrement}
                      value={tpPrice}
                      onChange={(e) => setTpPrice(parseFloat(e.target.value) || 0)}
                      className="flex-1 min-w-0 bg-neutral-900 border border-neutral-800 rounded-lg px-2.5 py-1 text-xs font-mono text-white"
                    />
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => setTpPrice(Math.round(instrument.currentPrice * 1.05))}
                        className="px-2 py-1 bg-neutral-800 hover:bg-neutral-700 text-[10px] font-mono text-neutral-300 rounded"
                      >
                        +5%
                      </button>
                      <button
                        type="button"
                        onClick={() => setTpPrice(Math.round(instrument.currentPrice * 1.1))}
                        className="px-2 py-1 bg-neutral-800 hover:bg-neutral-700 text-[10px] font-mono text-neutral-300 rounded"
                      >
                        +10%
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* SL Toggle & Field */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-1.5">
                <div className="flex items-center gap-2 shrink-0">
                  {orderType !== 'BRACKET' && orderType !== 'OCO' ? (
                    <input
                      type="checkbox"
                      id="enableSL"
                      checked={enableSL}
                      onChange={(e) => setEnableSL(e.target.checked)}
                      className="rounded bg-neutral-800 border-neutral-700 text-rose-500 focus:ring-0 cursor-pointer"
                    />
                  ) : (
                    <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0"></span>
                  )}
                  <label htmlFor="enableSL" className="text-xs text-neutral-300 cursor-pointer shrink-0">
                    SL (Cắt lỗ):
                  </label>
                </div>
                {(enableSL || orderType === 'BRACKET' || orderType === 'OCO') && (
                  <div className="flex-1 flex items-center gap-1.5 min-w-0">
                    <input
                      type="number"
                      step={marketConfig.rules.minPriceIncrement}
                      value={slPrice}
                      onChange={(e) => setSlPrice(parseFloat(e.target.value) || 0)}
                      className="flex-1 min-w-0 bg-neutral-900 border border-neutral-800 rounded-lg px-2.5 py-1 text-xs font-mono text-white"
                    />
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => setSlPrice(Math.round(instrument.currentPrice * 0.95))}
                        className="px-2 py-1 bg-neutral-800 hover:bg-neutral-700 text-[10px] font-mono text-neutral-300 rounded"
                      >
                        -5%
                      </button>
                      <button
                        type="button"
                        onClick={() => setSlPrice(Math.round(instrument.currentPrice * 0.92))}
                        className="px-2 py-1 bg-neutral-800 hover:bg-neutral-700 text-[10px] font-mono text-neutral-300 rounded"
                      >
                        -8%
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Pro Tier: Margin / Leverage Selector */}
          {tier === 'PRO' && maxMarketLeverage > 1 && (
            <div className="p-3 bg-neutral-950/80 rounded-xl border border-neutral-800 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-neutral-300 flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-amber-400" />
                  Đòn bẩy ký quỹ (Margin Leverage)
                </span>
                <span className="font-mono text-amber-400 font-bold">{leverage}x</span>
              </div>

              <div className="grid grid-cols-5 gap-1.5">
                {[1, 2, 3, 5, 10]
                  .filter((lvl) => lvl <= maxMarketLeverage)
                  .map((lvl) => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => setLeverage(lvl)}
                      className={`py-1.5 text-xs font-mono rounded font-semibold transition-colors cursor-pointer text-center min-w-0 truncate ${
                        leverage === lvl
                          ? 'bg-amber-500/20 border border-amber-500 text-amber-300 font-bold'
                          : 'bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-white'
                      }`}
                    >
                      {lvl}x
                    </button>
                  ))}
              </div>
            </div>
          )}

          {/* Pro Tier: Dedicated Risk & Exposure Breakdown */}
          {tier === 'PRO' && (
            <div className="p-3 bg-neutral-950/90 rounded-xl border border-neutral-800 space-y-2 text-xs font-mono">
              <div className="flex items-center justify-between pb-1.5 border-b border-neutral-800/80">
                <span className="font-bold text-neutral-200 flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-rose-400" />
                  ĐÁNH GIÁ RỦI RO (RISK METRICS)
                </span>
                <span className="text-[10px] text-neutral-500 uppercase">
                  Quy tắc: {marketConfig.rules.settlementPeriod}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div>
                  <span className="text-neutral-500 block">Ký quỹ duy trì (MM):</span>
                  <span className="text-neutral-200 font-semibold">
                    {(marketConfig.rules.maintenanceMarginRatio * 100).toFixed(0)}%
                  </span>
                </div>
                <div>
                  <span className="text-neutral-500 block">Giá thanh lý ước tính:</span>
                  <span className="text-rose-400 font-bold">
                    {preview.estimatedLiquidationPrice
                      ? formatStockPrice(preview.estimatedLiquidationPrice, instrument.currency)
                      : 'An toàn (Spot)'}
                  </span>
                </div>
              </div>

              {liquidationDistancePct !== null && (
                <div className="text-[10px] text-neutral-400">
                  Biên độ an toàn tới thanh lý:{' '}
                  <span className={liquidationDistancePct < 0 ? 'text-amber-400' : 'text-emerald-400'}>
                    {liquidationDistancePct.toFixed(1)}% từ giá hiện tại
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Order Preview Breakdown */}
          <div className="bg-neutral-950 p-3.5 rounded-xl border border-neutral-800/80 space-y-1.5 text-xs font-mono">
            <div className="flex justify-between text-neutral-400">
              <span>Giá trị lệnh:</span>
              <span className="text-neutral-200">
                {formatCurrency(preview.orderValue, instrument.currency)}
              </span>
            </div>

            {preview.marginRequired > 0 && (
              <div className="flex justify-between text-amber-400/90">
                <span>Ký quỹ ban đầu ({leverage}x):</span>
                <span>{formatCurrency(preview.marginRequired, instrument.currency)}</span>
              </div>
            )}

            <div className="flex justify-between text-neutral-400">
              <span>Phí môi giới:</span>
              <span>{formatCurrency(preview.fee, instrument.currency)}</span>
            </div>

            {preview.estimatedSlippage > 0 && (
              <div className="flex justify-between text-neutral-400">
                <span>Trượt giá ước tính (Slippage):</span>
                <span>{formatStockPrice(preview.estimatedSlippage, instrument.currency)}</span>
              </div>
            )}

            <div className="pt-2 border-t border-neutral-800 flex justify-between font-bold text-sm">
              <span className="text-neutral-300">Tổng thanh toán / Ký quỹ:</span>
              <span className={side === 'BUY' ? 'text-emerald-400' : 'text-rose-400'}>
                {formatCurrency(preview.totalCost, instrument.currency)}
              </span>
            </div>
          </div>

          {/* Error / Warning Feedback */}
          {feedback && (
            <div
              className={`p-3 rounded-xl flex items-start gap-2 text-xs ${
                feedback.type === 'error'
                  ? 'bg-rose-950/60 border border-rose-800 text-rose-300'
                  : 'bg-emerald-950/60 border border-emerald-800 text-emerald-300'
              }`}
            >
              {feedback.type === 'error' ? (
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
              ) : (
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
              )}
              <span>{feedback.message}</span>
            </div>
          )}

          {!feedback && !preview.isValid && preview.errorMessage && (
            <div className="p-2.5 rounded-lg bg-rose-950/40 border border-rose-900/50 flex items-center gap-2 text-xs text-rose-300">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{preview.errorMessage}</span>
            </div>
          )}

          {/* High risk warning confirmation prompt */}
          {confirmingHighRisk && (
            <div className="p-3 bg-amber-950/80 border border-amber-700/80 rounded-xl space-y-2 text-xs text-amber-200 animate-in fade-in">
              <div className="flex items-center gap-1.5 font-bold text-amber-300">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <span>XÁC NHẬN RỦI RO ĐÒN BẨY / SHORT</span>
              </div>
              <p className="text-[11px] leading-relaxed">
                Lệnh này sử dụng đòn bẩy {leverage}x. Nếu thị trường biến động ngược chiều, tài khoản của bạn có thể bị giải chấp tự động (Liquidation) tại mức giá{' '}
                <span className="font-mono font-bold text-white">
                  {formatStockPrice(preview.estimatedLiquidationPrice || 0, instrument.currency)}
                </span>
                . Bạn có chắc chắn muốn đặt lệnh?
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center gap-2 pt-2">
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-3 min-h-[44px] bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-xl text-xs font-semibold transition-colors cursor-pointer shrink-0"
              >
                Hủy / Đóng
              </button>
            )}

            <button
              type="submit"
              disabled={!preview.isValid}
              className={`flex-1 py-3 min-h-[44px] text-xs font-bold rounded-xl transition-all cursor-pointer shadow-lg ${
                !preview.isValid
                  ? 'bg-neutral-800 text-neutral-500 cursor-not-allowed'
                  : confirmingHighRisk
                  ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-950/50'
                  : positionEffect.startsWith('CLOSE')
                  ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-950/50'
                  : side === 'BUY'
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-950/50'
                  : 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-950/50'
              }`}
            >
              {confirmingHighRisk
                ? 'XÁC NHẬN ĐẶT LỆNH RỦI RO CAO'
                : positionEffect.startsWith('CLOSE')
                ? `XÁC NHẬN ĐÓNG VỊ THẾ (${quantity.toLocaleString()} CP)`
                : side === 'BUY'
                ? `XÁC NHẬN MUA (${orderType})`
                : `XÁC NHẬN BÁN (${orderType})`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
