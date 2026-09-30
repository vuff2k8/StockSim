import { Instrument, MarketConfig } from '../../types/market';
import {
  FeeConfig,
  Order,
  OrderPreview,
  OrderSide,
  OrderStatus,
  OrderTier,
  OrderType,
  PositionEffect,
  TimeInForce,
  Transaction,
} from '../../types/order';
import { Portfolio, Position } from '../../types/portfolio';
import { MarketDepthEngine } from '../market/MarketDepthEngine';
import { MarginLiquidationEngine } from '../portfolio/MarginLiquidationEngine';

export interface SubmitOrderParams {
  instrument: Instrument;
  side: OrderSide;
  positionEffect?: PositionEffect;
  orderType: OrderType;
  tier: OrderTier;
  quantity: number;
  price?: number;
  limitPrice?: number;
  stopPrice?: number;
  tpPrice?: number;
  slPrice?: number;
  trailingPercent?: number;
  leverage?: number;
  timeInForce?: TimeInForce;
  slippageMultiplier?: number;
}

export interface SubmitOrderResult {
  success: boolean;
  errorMessage?: string;
  transaction?: Transaction;
  newOpenOrders?: Order[];
  updatedPortfolio?: Portfolio;
}

export class OrderEngine {
  /**
   * Calculates comprehensive order preview including fee, slippage, margin requirement,
   * liquidation price and risk checks across Basic, Advanced, and Pro tiers.
   */
  public static calculatePreview(
    params: SubmitOrderParams,
    portfolio: Portfolio,
    feeConfig: FeeConfig,
    marketConfig: MarketConfig
  ): OrderPreview {
    const {
      instrument,
      side,
      orderType,
      tier,
      quantity,
      limitPrice,
      stopPrice,
      tpPrice,
      slPrice,
      trailingPercent,
      slippageMultiplier = 1.0,
    } = params;

    const leverage = Math.max(1, Math.min(params.leverage || 1, marketConfig.rules.maxLeverage));
    const effectivePrice = limitPrice ?? params.price ?? instrument.currentPrice;

    // Derive position effect
    const existingPosition = portfolio.positions[instrument.symbol];
    let positionEffect: PositionEffect = params.positionEffect || (side === 'BUY' ? 'OPEN_LONG' : 'CLOSE_LONG');
    if (!params.positionEffect) {
      if (side === 'BUY') {
        positionEffect = existingPosition && existingPosition.side === 'SHORT' ? 'CLOSE_SHORT' : 'OPEN_LONG';
      } else {
        positionEffect = existingPosition && existingPosition.side === 'LONG' ? 'CLOSE_LONG' : 'OPEN_SHORT';
      }
    }

    const orderValue = effectivePrice * quantity;
    const feeRate = feeConfig.rate || marketConfig.rules.tradingFeeRate;
    const fee = Math.max(orderValue * feeRate, feeConfig.minFee || 0);

    // Slippage calculation for market orders
    const slippageInfo =
      orderType === 'MARKET'
        ? MarketDepthEngine.calculateSlippage(instrument, quantity, side, slippageMultiplier)
        : { slippagePercent: 0, slippageAmount: 0, effectivePrice };

    // Margin required = orderValue / leverage
    const marginRequired = positionEffect.startsWith('OPEN') ? orderValue / leverage : 0;
    const totalCost = side === 'BUY' ? orderValue + fee : orderValue - fee;

    const remainingCash = side === 'BUY' ? portfolio.cash - (marginRequired > 0 ? marginRequired + fee : totalCost) : portfolio.cash + totalCost;
    const remainingMargin = Math.max(0, portfolio.availableMargin - marginRequired);

    let isValid = true;
    let errorMessage: string | undefined;
    let warningMessage: string | undefined;

    // 1. Quantity checks
    const lotSize = marketConfig.rules.lotSize || 1;
    if (quantity <= 0 || !Number.isInteger(quantity)) {
      isValid = false;
      errorMessage = 'Khối lượng giao dịch phải là số nguyên dương lớn hơn 0.';
    } else if (lotSize > 1 && quantity % lotSize !== 0) {
      isValid = false;
      errorMessage = `Khối lượng phải là bội số của lô giao dịch (${lotSize} CP trên sàn ${instrument.exchange}).`;
    }

    // 2. Short selling permissions
    if (positionEffect === 'OPEN_SHORT' && !marketConfig.rules.allowShort) {
      isValid = false;
      errorMessage = `Thị trường ${marketConfig.country} không hỗ trợ bán khống (Short selling) đối với mã này.`;
    }

    // 3. Leverage limits
    if (leverage > marketConfig.rules.maxLeverage) {
      isValid = false;
      errorMessage = `Đòn bẩy tối đa cho phép trên thị trường này là ${marketConfig.rules.maxLeverage}x.`;
    }

    // 4. Daily price band limits (e.g. ±7% for HOSE)
    if (marketConfig.rules.priceBandPercent && effectivePrice > 0) {
      const ceiling = Math.floor(instrument.previousClose * (1 + marketConfig.rules.priceBandPercent));
      const floor = Math.ceil(instrument.previousClose * (1 - marketConfig.rules.priceBandPercent));
      if (effectivePrice > ceiling || effectivePrice < floor) {
        isValid = false;
        errorMessage = `Giá đặt (${effectivePrice.toLocaleString()}) vượt biên độ trần/sàn phiên nay (${floor.toLocaleString()} - ${ceiling.toLocaleString()}).`;
      }
    }

    // 5. Margin & Capital sufficiency
    if (positionEffect === 'OPEN_LONG') {
      const needed = marginRequired > 0 ? marginRequired + fee : totalCost;
      if (needed > portfolio.cash && needed > portfolio.availableMargin) {
        isValid = false;
        errorMessage = 'Không đủ tiền mặt hoặc sức mua ký quỹ để thực hiện lệnh mua.';
      }
    } else if (positionEffect === 'OPEN_SHORT') {
      const needed = marginRequired + fee;
      if (needed > portfolio.availableMargin) {
        isValid = false;
        errorMessage = 'Sức mua ký quỹ không đủ để mở vị thế Bán khống (Short).';
      }
    } else if (positionEffect === 'CLOSE_LONG') {
      const availableShares = existingPosition && existingPosition.side === 'LONG' ? existingPosition.quantity : 0;
      if (availableShares < quantity) {
        isValid = false;
        errorMessage = `Số lượng cổ phiếu trong danh mục không đủ để bán (Hiện có: ${availableShares.toLocaleString()}).`;
      }
    } else if (positionEffect === 'CLOSE_SHORT') {
      const shortShares = existingPosition && existingPosition.side === 'SHORT' ? existingPosition.quantity : 0;
      if (shortShares < quantity) {
        isValid = false;
        errorMessage = `Số lượng vị thế Short không đủ để đóng (Hiện có: ${shortShares.toLocaleString()}).`;
      }
    }

    // 6. Liquidation price estimation
    let estimatedLiquidationPrice: number | undefined;
    if (leverage > 1 || positionEffect === 'OPEN_SHORT') {
      const maint = marketConfig.rules.maintenanceMarginRatio;
      if (side === 'BUY' || positionEffect === 'OPEN_LONG') {
        estimatedLiquidationPrice = Math.max(0, effectivePrice * (1 - 1 / leverage + maint));
      } else {
        estimatedLiquidationPrice = effectivePrice * (1 + 1 / leverage - maint);
      }
    }

    // 7. Maximum loss & Potential profit
    let maximumLoss: number | undefined;
    let potentialProfit: number | undefined;

    if (slPrice) {
      maximumLoss = Math.abs(effectivePrice - slPrice) * quantity + fee;
    } else {
      maximumLoss = marginRequired > 0 ? marginRequired : orderValue;
    }

    if (tpPrice) {
      potentialProfit = Math.abs(tpPrice - effectivePrice) * quantity - fee;
    }

    // High risk warning flag
    const requiresHighRiskConfirmation = leverage > 1 || positionEffect === 'OPEN_SHORT';
    if (requiresHighRiskConfirmation) {
      warningMessage = `Lệnh này sử dụng đòn bẩy ${leverage}x ${
        positionEffect === 'OPEN_SHORT' ? 'và bán khống' : ''
      }. Giá thanh lý cưỡng chế ước tính: ${estimatedLiquidationPrice?.toLocaleString()} ${instrument.currency}.`;
    }

    return {
      symbol: instrument.symbol,
      side,
      positionEffect,
      orderType,
      tier,
      quantity,
      price: effectivePrice,
      limitPrice,
      stopPrice,
      tpPrice,
      slPrice,
      trailingPercent,
      leverage,
      orderValue,
      fee,
      estimatedSlippage: slippageInfo.slippageAmount,
      marginRequired,
      totalCost,
      remainingCash,
      remainingMargin,
      maximumLoss,
      potentialProfit,
      estimatedLiquidationPrice,
      isValid,
      errorMessage,
      warningMessage,
      requiresHighRiskConfirmation,
    };
  }

  /**
   * Submits order into the simulated engine.
   * If Market order -> fills immediately with slippage.
   * If Limit, Stop, Trailing, Bracket, OCO -> adds to openOrders.
   */
  public static submitOrder(
    params: SubmitOrderParams,
    portfolio: Portfolio,
    feeConfig: FeeConfig,
    marketConfig: MarketConfig,
    timestamp: string
  ): SubmitOrderResult {
    const preview = this.calculatePreview(params, portfolio, feeConfig, marketConfig);
    if (!preview.isValid) {
      return { success: false, errorMessage: preview.errorMessage || 'Lệnh không hợp lệ.' };
    }

    const { instrument, side, orderType, tier, quantity, leverage = 1 } = params;
    const positionEffect = preview.positionEffect;
    const orderId = `ord-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

    // A. MARKET ORDER: Execute immediately with simulated slippage
    if (orderType === 'MARKET') {
      const slippageInfo = MarketDepthEngine.calculateSlippage(
        instrument,
        quantity,
        side,
        params.slippageMultiplier || 1.0
      );
      const executionPrice = slippageInfo.effectivePrice;
      const executedValue = executionPrice * quantity;
      const fee = preview.fee;

      const transaction: Transaction = {
        id: `tx-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        orderId,
        timestamp,
        side,
        positionEffect,
        symbol: instrument.symbol,
        instrumentName: instrument.name,
        quantity,
        price: executionPrice,
        fee,
        slippage: slippageInfo.slippageAmount,
        total: side === 'BUY' ? executedValue + fee : executedValue - fee,
        currency: instrument.currency,
        leverage,
      };

      // Update positions
      const newPositions = { ...portfolio.positions };
      let newCash = portfolio.cash;
      let realizedPnLDelta = 0;

      if (positionEffect === 'OPEN_LONG') {
        const marginUsed = executedValue / leverage;
        newCash -= (marginUsed + fee);

        const existing = newPositions[instrument.symbol];
        if (existing && existing.side === 'LONG') {
          const totalQty = existing.quantity + quantity;
          const totalCost = existing.totalCost + executedValue + fee;
          const avgPrice = (existing.averagePrice * existing.quantity + executionPrice * quantity) / totalQty;
          newPositions[instrument.symbol] = {
            ...existing,
            quantity: totalQty,
            averagePrice: avgPrice,
            currentPrice: executionPrice,
            totalCost,
            marginUsed: existing.marginUsed + marginUsed,
            leverage,
          };
        } else {
          newPositions[instrument.symbol] = {
            symbol: instrument.symbol,
            name: instrument.name,
            currency: instrument.currency,
            side: 'LONG',
            quantity,
            averagePrice: executionPrice,
            currentPrice: executionPrice,
            marketValue: executedValue,
            totalCost: executedValue + fee,
            unrealizedPnL: -fee,
            unrealizedPnLPercent: executedValue > 0 ? (-fee / executedValue) * 100 : 0,
            realizedPnL: 0,
            leverage,
            marginUsed,
            tpPrice: params.tpPrice,
            slPrice: params.slPrice,
            trailingPercent: params.trailingPercent,
          };
        }
      } else if (positionEffect === 'CLOSE_LONG') {
        const existing = newPositions[instrument.symbol];
        if (!existing) {
          return { success: false, errorMessage: 'Không tìm thấy vị thế Long để đóng.' };
        }

        const costBasisPerShare = existing.averagePrice;
        const soldCostBasis = costBasisPerShare * quantity;
        const netProceeds = executedValue - fee;
        const tradeRealizedPnL = netProceeds - soldCostBasis;
        realizedPnLDelta += tradeRealizedPnL;

        // Return original margin used proportionally
        const freedMargin = (existing.marginUsed * quantity) / existing.quantity;
        newCash += freedMargin + tradeRealizedPnL;

        const remainingQty = existing.quantity - quantity;
        if (remainingQty <= 0) {
          delete newPositions[instrument.symbol];
        } else {
          newPositions[instrument.symbol] = {
            ...existing,
            quantity: remainingQty,
            totalCost: existing.totalCost - soldCostBasis,
            marginUsed: existing.marginUsed - freedMargin,
            realizedPnL: existing.realizedPnL + tradeRealizedPnL,
          };
        }
      } else if (positionEffect === 'OPEN_SHORT') {
        const marginUsed = executedValue / leverage;
        newCash -= (marginUsed + fee);

        newPositions[instrument.symbol] = {
          symbol: instrument.symbol,
          name: instrument.name,
          currency: instrument.currency,
          side: 'SHORT',
          quantity,
          averagePrice: executionPrice,
          currentPrice: executionPrice,
          marketValue: executedValue,
          totalCost: marginUsed,
          unrealizedPnL: -fee,
          unrealizedPnLPercent: 0,
          realizedPnL: 0,
          leverage,
          marginUsed,
          tpPrice: params.tpPrice,
          slPrice: params.slPrice,
          trailingPercent: params.trailingPercent,
        };
      } else if (positionEffect === 'CLOSE_SHORT') {
        const existing = newPositions[instrument.symbol];
        if (!existing) {
          return { success: false, errorMessage: 'Không tìm thấy vị thế Short để đóng.' };
        }

        const notionalEntry = existing.averagePrice * quantity;
        const tradeRealizedPnL = notionalEntry - executedValue - fee;
        realizedPnLDelta += tradeRealizedPnL;

        const freedMargin = (existing.marginUsed * quantity) / existing.quantity;
        newCash += freedMargin + tradeRealizedPnL;

        const remainingQty = existing.quantity - quantity;
        if (remainingQty <= 0) {
          delete newPositions[instrument.symbol];
        } else {
          newPositions[instrument.symbol] = {
            ...existing,
            quantity: remainingQty,
            marginUsed: existing.marginUsed - freedMargin,
            realizedPnL: existing.realizedPnL + tradeRealizedPnL,
          };
        }
      }

      // Recompute full portfolio metrics via MarginLiquidationEngine
      const basePortfolio: Portfolio = {
        ...portfolio,
        cash: newCash,
        positions: newPositions,
        realizedPnL: portfolio.realizedPnL + realizedPnLDelta,
      };

      const updatedPortfolio = MarginLiquidationEngine.calculatePortfolioMetrics(
        basePortfolio,
        { [instrument.symbol]: instrument },
        marketConfig.rules
      );

      // Check if bracket order parameters were attached to this market execution!
      const newOpenOrders: Order[] = [];
      if (params.tpPrice || params.slPrice) {
        const tpSlSide: OrderSide = side === 'BUY' ? 'SELL' : 'BUY';
        const tpSlEffect: PositionEffect = side === 'BUY' ? 'CLOSE_LONG' : 'CLOSE_SHORT';
        const ocoAId = `ord-tp-${Date.now()}`;
        const ocoBId = `ord-sl-${Date.now()}`;

        if (params.tpPrice && params.slPrice) {
          // OCO pair
          newOpenOrders.push({
            id: ocoAId,
            symbol: instrument.symbol,
            instrumentName: instrument.name,
            currency: instrument.currency,
            side: tpSlSide,
            positionEffect: tpSlEffect,
            orderType: 'TAKE_PROFIT',
            tier: 'ADVANCED',
            status: 'PENDING',
            timeInForce: 'GTC',
            leverage,
            quantity,
            filledQuantity: 0,
            remainingQuantity: 0,
            tpPrice: params.tpPrice,
            marginRequired: 0,
            estimatedSlippage: 0,
            fee: 0,
            totalCost: 0,
            createdAt: timestamp,
            updatedAt: timestamp,
            parentOrderId: orderId,
            linkedOcoOrderId: ocoBId,
            bracketChildType: 'TP',
          });
          newOpenOrders.push({
            id: ocoBId,
            symbol: instrument.symbol,
            instrumentName: instrument.name,
            currency: instrument.currency,
            side: tpSlSide,
            positionEffect: tpSlEffect,
            orderType: 'STOP_LOSS',
            tier: 'ADVANCED',
            status: 'PENDING',
            timeInForce: 'GTC',
            leverage,
            quantity,
            filledQuantity: 0,
            remainingQuantity: 0,
            slPrice: params.slPrice,
            marginRequired: 0,
            estimatedSlippage: 0,
            fee: 0,
            totalCost: 0,
            createdAt: timestamp,
            updatedAt: timestamp,
            parentOrderId: orderId,
            linkedOcoOrderId: ocoAId,
            bracketChildType: 'SL',
          });
        } else if (params.tpPrice) {
          newOpenOrders.push({
            id: ocoAId,
            symbol: instrument.symbol,
            instrumentName: instrument.name,
            currency: instrument.currency,
            side: tpSlSide,
            positionEffect: tpSlEffect,
            orderType: 'TAKE_PROFIT',
            tier: 'ADVANCED',
            status: 'PENDING',
            timeInForce: 'GTC',
            leverage,
            quantity,
            filledQuantity: 0,
            remainingQuantity: 0,
            tpPrice: params.tpPrice,
            marginRequired: 0,
            estimatedSlippage: 0,
            fee: 0,
            totalCost: 0,
            createdAt: timestamp,
            updatedAt: timestamp,
            parentOrderId: orderId,
            bracketChildType: 'TP',
          });
        } else if (params.slPrice) {
          newOpenOrders.push({
            id: ocoBId,
            symbol: instrument.symbol,
            instrumentName: instrument.name,
            currency: instrument.currency,
            side: tpSlSide,
            positionEffect: tpSlEffect,
            orderType: 'STOP_LOSS',
            tier: 'ADVANCED',
            status: 'PENDING',
            timeInForce: 'GTC',
            leverage,
            quantity,
            filledQuantity: 0,
            remainingQuantity: 0,
            slPrice: params.slPrice,
            marginRequired: 0,
            estimatedSlippage: 0,
            fee: 0,
            totalCost: 0,
            createdAt: timestamp,
            updatedAt: timestamp,
            parentOrderId: orderId,
            bracketChildType: 'SL',
          });
        }
      }

      return {
        success: true,
        transaction,
        updatedPortfolio,
        newOpenOrders: newOpenOrders.length > 0 ? newOpenOrders : undefined,
      };
    }

    // B. CONDITIONAL / PENDING ORDERS (Limit, Stop, Trailing Stop, Bracket, OCO)
    const newOrder: Order = {
      id: orderId,
      symbol: instrument.symbol,
      instrumentName: instrument.name,
      currency: instrument.currency,
      side,
      positionEffect,
      orderType,
      tier,
      status: 'PENDING',
      timeInForce: params.timeInForce || 'GTC',
      leverage,
      quantity,
      filledQuantity: 0,
      remainingQuantity: quantity,
      price: params.price || preview.price,
      limitPrice: params.limitPrice,
      stopPrice: params.stopPrice,
      tpPrice: params.tpPrice,
      slPrice: params.slPrice,
      trailingPercent: params.trailingPercent,
      watermarkPrice: instrument.currentPrice,
      marginRequired: preview.marginRequired,
      estimatedSlippage: preview.estimatedSlippage,
      fee: preview.fee,
      totalCost: preview.totalCost,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    return {
      success: true,
      newOpenOrders: [newOrder],
    };
  }
}
