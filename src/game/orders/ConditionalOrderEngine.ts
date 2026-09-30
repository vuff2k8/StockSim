import { Instrument, MarketTradingRules } from '../../types/market';
import { Order, OrderStatus, Transaction } from '../../types/order';
import { Portfolio } from '../../types/portfolio';
import { SimulationEvent } from '../../types/simulation';

export interface ConditionalOrderEvaluationResult {
  updatedOpenOrders: Order[];
  filledOrders: Order[];
  cancelledOrders: Order[];
  transactions: Transaction[];
  events: SimulationEvent[];
}

export class ConditionalOrderEngine {
  /**
   * Evaluates all open conditional and pending limit/stop orders against current prices.
   * Completely decoupled and rule-driven via MarketTradingRules.
   */
  public static evaluateOrders(
    openOrders: Order[],
    instruments: Record<string, Instrument>,
    portfolio: Portfolio,
    tradingRules: MarketTradingRules,
    timestamp: string,
    isNewDay: boolean = false
  ): ConditionalOrderEvaluationResult {
    const updatedOpenOrders: Order[] = [];
    const filledOrders: Order[] = [];
    const cancelledOrders: Order[] = [];
    const transactions: Transaction[] = [];
    const events: SimulationEvent[] = [];

    // Map for OCO tracking within the same tick
    const ocoCancelQueue = new Set<string>();

    for (let order of openOrders) {
      const inst = instruments[order.symbol];
      if (!inst) {
        updatedOpenOrders.push(order);
        continue;
      }

      // Check if order was marked for OCO cancellation by a sibling that filled earlier in this tick
      if (ocoCancelQueue.has(order.id)) {
        const cancelled: Order = {
          ...order,
          status: 'CANCELLED',
          updatedAt: timestamp,
          cancellationReason: 'Đã hủy tự động do lệnh đối ứng OCO khớp thành công',
        };
        cancelledOrders.push(cancelled);
        continue;
      }

      // Time-in-force expiration (DAY orders expire on new day)
      if (isNewDay && order.timeInForce === 'DAY') {
        const expired: Order = {
          ...order,
          status: 'EXPIRED',
          updatedAt: timestamp,
          cancellationReason: 'Hết hạn phiên giao dịch trong ngày (DAY order expired)',
        };
        cancelledOrders.push(expired);
        continue;
      }

      const currentPrice = inst.currentPrice;
      let shouldFill = false;
      let fillPrice = currentPrice;
      let fillQty = order.remainingQuantity;

      switch (order.orderType) {
        case 'LIMIT': {
          const limit = order.limitPrice ?? order.price ?? currentPrice;
          if (order.side === 'BUY') {
            // Buy limit fills if market price reaches or drops below limit
            if (currentPrice <= limit) {
              shouldFill = true;
              fillPrice = Math.min(limit, currentPrice);
            }
          } else {
            // Sell limit fills if market price reaches or rises above limit
            if (currentPrice >= limit) {
              shouldFill = true;
              fillPrice = Math.max(limit, currentPrice);
            }
          }
          break;
        }

        case 'STOP_MARKET': {
          const stop = order.stopPrice ?? currentPrice;
          if (order.side === 'BUY') {
            // Buy stop triggers when price rallies up to stop
            if (currentPrice >= stop) {
              shouldFill = true;
              fillPrice = currentPrice;
              events.push({
                id: `ev-stop-${Date.now()}-${order.id}`,
                timestamp,
                title: `Lệnh STOP MUA kích hoạt: ${order.symbol}`,
                description: `Giá thị trường chạm ${stop.toLocaleString()} ${order.currency}. Lệnh đã chuyển thành Market và khớp tại ${fillPrice.toLocaleString()} ${order.currency}.`,
                severity: 'medium',
                impact: 0,
                duration: 5,
                remainingDuration: 5,
              });
            }
          } else {
            // Sell stop triggers when price drops down to stop
            if (currentPrice <= stop) {
              shouldFill = true;
              fillPrice = currentPrice;
              events.push({
                id: `ev-stop-${Date.now()}-${order.id}`,
                timestamp,
                title: `Lệnh STOP BÁN kích hoạt: ${order.symbol}`,
                description: `Giá thị trường chạm ${stop.toLocaleString()} ${order.currency}. Lệnh cắt lỗ / dừng bán đã khớp tại ${fillPrice.toLocaleString()} ${order.currency}.`,
                severity: 'medium',
                impact: 0,
                duration: 5,
                remainingDuration: 5,
              });
            }
          }
          break;
        }

        case 'STOP_LIMIT': {
          const stop = order.stopPrice ?? currentPrice;
          const limit = order.limitPrice ?? stop;

          if (order.status === 'PENDING') {
            const triggered =
              order.side === 'BUY' ? currentPrice >= stop : currentPrice <= stop;
            if (triggered) {
              // Convert to triggered limit
              order = {
                ...order,
                status: 'TRIGGERED',
                triggeredAt: timestamp,
                updatedAt: timestamp,
              };
              events.push({
                id: `ev-stoplimit-${Date.now()}-${order.id}`,
                timestamp,
                title: `Lệnh STOP LIMIT kích hoạt: ${order.symbol}`,
                description: `Mức kích hoạt ${stop.toLocaleString()} đã chạm. Đã gửi lệnh giới hạn tại ${limit.toLocaleString()} vào sổ lệnh.`,
                severity: 'low',
                impact: 0,
                duration: 4,
                remainingDuration: 4,
              });
            }
          }

          if (order.status === 'TRIGGERED') {
            // Now evaluate limit execution
            if (order.side === 'BUY' && currentPrice <= limit) {
              shouldFill = true;
              fillPrice = Math.min(limit, currentPrice);
            } else if (order.side === 'SELL' && currentPrice >= limit) {
              shouldFill = true;
              fillPrice = Math.max(limit, currentPrice);
            }
          }
          break;
        }

        case 'TAKE_PROFIT': {
          const tp = order.tpPrice ?? order.price ?? currentPrice;
          if (order.side === 'SELL' || order.positionEffect === 'CLOSE_LONG') {
            // Long position TP: price rises above target
            if (currentPrice >= tp) {
              shouldFill = true;
              fillPrice = currentPrice;
              events.push({
                id: `ev-tp-${Date.now()}-${order.id}`,
                timestamp,
                title: `TAKE PROFIT TRIGGERED: ${order.symbol}`,
                description: `Chạm mục tiêu chốt lời ${tp.toLocaleString()} ${order.currency}. Đã tự động đóng vị thế ${order.quantity.toLocaleString()} CP.`,
                severity: 'low',
                impact: 0,
                duration: 5,
                remainingDuration: 5,
              });
            }
          } else {
            // Short position TP: price falls below target
            if (currentPrice <= tp) {
              shouldFill = true;
              fillPrice = currentPrice;
              events.push({
                id: `ev-tp-short-${Date.now()}-${order.id}`,
                timestamp,
                title: `TAKE PROFIT SHORT: ${order.symbol}`,
                description: `Chạm mục tiêu chốt lời vị thế Short tại ${tp.toLocaleString()} ${order.currency}.`,
                severity: 'low',
                impact: 0,
                duration: 5,
                remainingDuration: 5,
              });
            }
          }
          break;
        }

        case 'STOP_LOSS': {
          const sl = order.slPrice ?? order.price ?? currentPrice;
          if (order.side === 'SELL' || order.positionEffect === 'CLOSE_LONG') {
            // Long position SL: price falls below stop loss
            if (currentPrice <= sl) {
              shouldFill = true;
              fillPrice = currentPrice;
              events.push({
                id: `ev-sl-${Date.now()}-${order.id}`,
                timestamp,
                title: `STOP LOSS TRIGGERED: ${order.symbol}`,
                description: `Chạm ngưỡng cắt lỗ ${sl.toLocaleString()} ${order.currency}. Đã tự động đóng vị thế bảo toàn vốn.`,
                severity: 'medium',
                impact: 0,
                duration: 5,
                remainingDuration: 5,
              });
            }
          } else {
            // Short position SL: price rises above stop loss
            if (currentPrice >= sl) {
              shouldFill = true;
              fillPrice = currentPrice;
              events.push({
                id: `ev-sl-short-${Date.now()}-${order.id}`,
                timestamp,
                title: `STOP LOSS SHORT: ${order.symbol}`,
                description: `Vị thế Short chạm ngưỡng cắt lỗ tại ${sl.toLocaleString()} ${order.currency}.`,
                severity: 'medium',
                impact: 0,
                duration: 5,
                remainingDuration: 5,
              });
            }
          }
          break;
        }

        case 'TRAILING_STOP': {
          // Update high/low watermark
          const pct = order.trailingPercent ?? 0.05;
          if (order.side === 'SELL' || order.positionEffect === 'CLOSE_LONG') {
            // Long Trailing Stop: follows price UP, locks in profit
            const prevHigh = order.watermarkPrice ?? order.price ?? currentPrice;
            const newHigh = Math.max(prevHigh, currentPrice);
            order = { ...order, watermarkPrice: newHigh };

            const dynamicStop = newHigh * (1 - pct);
            if (currentPrice <= dynamicStop) {
              shouldFill = true;
              fillPrice = currentPrice;
              events.push({
                id: `ev-trail-${Date.now()}-${order.id}`,
                timestamp,
                title: `TRAILING STOP TRIGGERED: ${order.symbol}`,
                description: `Giá hồi giảm vượt mức kéo dừng lỗ (${(pct * 100).toFixed(1)}% từ đỉnh ${newHigh.toLocaleString()}). Đã chốt tại ${fillPrice.toLocaleString()} ${order.currency}.`,
                severity: 'medium',
                impact: 0,
                duration: 5,
                remainingDuration: 5,
              });
            }
          } else {
            // Short Trailing Stop: follows price DOWN
            const prevLow = order.watermarkPrice ?? order.price ?? currentPrice;
            const newLow = Math.min(prevLow, currentPrice);
            order = { ...order, watermarkPrice: newLow };

            const dynamicStop = newLow * (1 + pct);
            if (currentPrice >= dynamicStop) {
              shouldFill = true;
              fillPrice = currentPrice;
              events.push({
                id: `ev-trail-short-${Date.now()}-${order.id}`,
                timestamp,
                title: `TRAILING STOP SHORT: ${order.symbol}`,
                description: `Giá hồi tăng vượt mức kéo dừng (${(pct * 100).toFixed(1)}% từ đáy ${newLow.toLocaleString()}). Đã đóng lệnh tại ${fillPrice.toLocaleString()} ${order.currency}.`,
                severity: 'medium',
                impact: 0,
                duration: 5,
                remainingDuration: 5,
              });
            }
          }
          break;
        }

        case 'OCO': {
          // OCO parent or children evaluate individually via their sub-conditions
          const tp = order.tpPrice;
          const sl = order.slPrice;
          if (tp && currentPrice >= tp) {
            shouldFill = true;
            fillPrice = currentPrice;
            if (order.linkedOcoOrderId) {
              ocoCancelQueue.add(order.linkedOcoOrderId);
            }
          } else if (sl && currentPrice <= sl) {
            shouldFill = true;
            fillPrice = currentPrice;
            if (order.linkedOcoOrderId) {
              ocoCancelQueue.add(order.linkedOcoOrderId);
            }
          }
          break;
        }

        default:
          break;
      }

      if (shouldFill) {
        // Handle IOC / FOK checks
        const orderValue = fillPrice * fillQty;
        const fee = orderValue * tradingRules.tradingFeeRate;

        const filledOrder: Order = {
          ...order,
          status: 'FILLED',
          filledQuantity: order.filledQuantity + fillQty,
          remainingQuantity: 0,
          filledAt: timestamp,
          updatedAt: timestamp,
          fee,
          totalCost: order.side === 'BUY' ? orderValue + fee : orderValue - fee,
        };

        filledOrders.push(filledOrder);

        // If this order is part of an OCO pair, cancel the other sibling!
        if (order.linkedOcoOrderId) {
          ocoCancelQueue.add(order.linkedOcoOrderId);
        }

        // Create transaction record
        transactions.push({
          id: `tx-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          orderId: order.id,
          timestamp,
          side: order.side,
          positionEffect: order.positionEffect,
          symbol: order.symbol,
          instrumentName: order.instrumentName,
          quantity: fillQty,
          price: fillPrice,
          fee,
          total: filledOrder.totalCost,
          currency: order.currency,
          leverage: order.leverage,
        });
      } else {
        // Order remains open
        updatedOpenOrders.push(order);
      }
    }

    // Secondary pass: cancel any orders in the cancel queue
    const finalOpenOrders: Order[] = [];
    for (const order of updatedOpenOrders) {
      if (ocoCancelQueue.has(order.id)) {
        cancelledOrders.push({
          ...order,
          status: 'CANCELLED',
          updatedAt: timestamp,
          cancellationReason: 'Đã hủy do lệnh liên kết OCO đã khớp trước (One Cancels Other)',
        });
      } else {
        finalOpenOrders.push(order);
      }
    }

    return {
      updatedOpenOrders: finalOpenOrders,
      filledOrders,
      cancelledOrders,
      transactions,
      events,
    };
  }
}
