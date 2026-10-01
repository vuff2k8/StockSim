/**
 * Authoritative Market Session Engine
 * Evaluates simulated market trading phases, order entry permissions, and session transitions
 * deterministically based on simulation timestamps and market timezones.
 * 
 * NEVER uses browser local time, device timezone, or non-deterministic Date.now().
 */

import { MarketConfig, MarketStatus } from '../../types/market';
import { OrderType } from '../../types/order';
import {
  MarketLocalTimeInfo,
  MarketSessionState,
  MarketSessionType,
  SessionBoundaryRule,
} from '../../types/session';
import { TradingCalendar } from '../calendar/TradingCalendar';
import { SUPPORTED_MARKETS } from '../../data/markets';

// Cached Intl.DateTimeFormat instances per IANA timezone to prevent GC allocation
const FORMATTER_CACHE = new Map<string, Intl.DateTimeFormat>();

function getFormatter(timezone: string): Intl.DateTimeFormat {
  let dtf = FORMATTER_CACHE.get(timezone);
  if (!dtf) {
    try {
      dtf = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hourCycle: 'h23',
        weekday: 'short',
      });
    } catch {
      // Fallback to UTC if timezone string is invalid
      dtf = new Intl.DateTimeFormat('en-US', {
        timeZone: 'UTC',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hourCycle: 'h23',
        weekday: 'short',
      });
    }
    FORMATTER_CACHE.set(timezone, dtf);
  }
  return dtf;
}

export class MarketSessionEngine {
  /**
   * Resolves precise date and time parts in market local timezone from epoch milliseconds
   */
  public static getLocalTimeInfo(epochMs: number, timezone: string): MarketLocalTimeInfo {
    const dtf = getFormatter(timezone);
    const parts = dtf.formatToParts(new Date(epochMs));

    let year = 2025;
    let month = 1;
    let day = 1;
    let hour = 0;
    let minute = 0;
    let second = 0;
    let weekday: MarketLocalTimeInfo['weekday'] = 'Mon';

    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      if (p.type === 'year') year = parseInt(p.value, 10);
      else if (p.type === 'month') month = parseInt(p.value, 10);
      else if (p.type === 'day') day = parseInt(p.value, 10);
      else if (p.type === 'hour') hour = parseInt(p.value, 10);
      else if (p.type === 'minute') minute = parseInt(p.value, 10);
      else if (p.type === 'second') second = parseInt(p.value, 10);
      else if (p.type === 'weekday') weekday = p.value as MarketLocalTimeInfo['weekday'];
    }

    // Guard hourCycle 24 edge case (midnight could be represented as 24)
    if (hour === 24) hour = 0;

    const minuteOfDay = hour * 60 + minute;
    const isWeekend = TradingCalendar.isWeekend(weekday);
    const monthStr = month < 10 ? `0${month}` : `${month}`;
    const dayStr = day < 10 ? `0${day}` : `${day}`;
    const hourStr = hour < 10 ? `0${hour}` : `${hour}`;
    const minStr = minute < 10 ? `0${minute}` : `${minute}`;
    const secStr = second < 10 ? `0${second}` : `${second}`;

    return {
      year,
      month,
      day,
      hour,
      minute,
      second,
      minuteOfDay,
      weekday,
      isWeekend,
      marketDate: `${year}-${monthStr}-${dayStr}`,
      localTime: `${hourStr}:${minStr}:${secStr}`,
    };
  }

  /**
   * Returns schedule rules for configured markets
   */
  public static getMarketRules(marketId: string): SessionBoundaryRule[] {
    switch (marketId) {
      case 'vietnam':
        return [
          {
            session: MarketSessionType.CLOSED,
            startMinute: 0,
            endMinute: 510, // 08:30
            displayNameVi: 'Đóng cửa ngoài giờ',
            isTradable: false,
            isOrderEntryAllowed: false,
            isContinuousTrading: false,
          },
          {
            session: MarketSessionType.PRE_MARKET,
            startMinute: 510, // 08:30
            endMinute: 540, // 09:00
            displayNameVi: 'Tiền thị trường / Chờ mở cửa',
            isTradable: false,
            isOrderEntryAllowed: true,
            isContinuousTrading: false,
          },
          {
            session: MarketSessionType.ATO,
            startMinute: 540, // 09:00
            endMinute: 555, // 09:15
            displayNameVi: 'Khớp lệnh Định kỳ Mở cửa (ATO)',
            isTradable: true,
            isOrderEntryAllowed: true,
            isContinuousTrading: false,
          },
          {
            session: MarketSessionType.OPEN,
            startMinute: 555, // 09:15
            endMinute: 690, // 11:30
            displayNameVi: 'Khớp lệnh Liên tục sáng',
            isTradable: true,
            isOrderEntryAllowed: true,
            isContinuousTrading: true,
          },
          {
            session: MarketSessionType.LUNCH_BREAK,
            startMinute: 690, // 11:30
            endMinute: 780, // 13:00
            displayNameVi: 'Nghỉ giữa phiên',
            isTradable: false,
            isOrderEntryAllowed: true,
            isContinuousTrading: false,
          },
          {
            session: MarketSessionType.OPEN,
            startMinute: 780, // 13:00
            endMinute: 870, // 14:30
            displayNameVi: 'Khớp lệnh Liên tục chiều',
            isTradable: true,
            isOrderEntryAllowed: true,
            isContinuousTrading: true,
          },
          {
            session: MarketSessionType.ATC,
            startMinute: 870, // 14:30
            endMinute: 885, // 14:45
            displayNameVi: 'Khớp lệnh Định kỳ Đóng cửa (ATC)',
            isTradable: true,
            isOrderEntryAllowed: true,
            isContinuousTrading: false,
          },
          {
            session: MarketSessionType.AFTER_HOURS,
            startMinute: 885, // 14:45
            endMinute: 900, // 15:00
            displayNameVi: 'Khớp lệnh Sau giờ (PLO)',
            isTradable: false,
            isOrderEntryAllowed: true,
            isContinuousTrading: false,
          },
          {
            session: MarketSessionType.CLOSED,
            startMinute: 900, // 15:00
            endMinute: 1440,
            displayNameVi: 'Đóng cửa thị trường',
            isTradable: false,
            isOrderEntryAllowed: false,
            isContinuousTrading: false,
          },
        ];

      case 'us':
        return [
          {
            session: MarketSessionType.CLOSED,
            startMinute: 0,
            endMinute: 240, // 04:00
            displayNameVi: 'Đóng cửa thị trường (US Overnight)',
            isTradable: false,
            isOrderEntryAllowed: false,
            isContinuousTrading: false,
          },
          {
            session: MarketSessionType.PRE_MARKET,
            startMinute: 240, // 04:00
            endMinute: 570, // 09:30
            displayNameVi: 'Tiền thị trường (Pre-Market)',
            isTradable: false,
            isOrderEntryAllowed: true,
            isContinuousTrading: false,
          },
          {
            session: MarketSessionType.OPEN,
            startMinute: 570, // 09:30
            endMinute: 960, // 16:00
            displayNameVi: 'Phiên chính thức (Regular Market)',
            isTradable: true,
            isOrderEntryAllowed: true,
            isContinuousTrading: true,
          },
          {
            session: MarketSessionType.AFTER_HOURS,
            startMinute: 960, // 16:00
            endMinute: 1200, // 20:00
            displayNameVi: 'Sau giờ giao dịch (After-Hours)',
            isTradable: false,
            isOrderEntryAllowed: true,
            isContinuousTrading: false,
          },
          {
            session: MarketSessionType.CLOSED,
            startMinute: 1200, // 20:00
            endMinute: 1440,
            displayNameVi: 'Đóng cửa thị trường',
            isTradable: false,
            isOrderEntryAllowed: false,
            isContinuousTrading: false,
          },
        ];

      case 'japan':
        return [
          {
            session: MarketSessionType.CLOSED,
            startMinute: 0,
            endMinute: 510, // 08:30
            displayNameVi: 'Đóng cửa thị trường Tokyo',
            isTradable: false,
            isOrderEntryAllowed: false,
            isContinuousTrading: false,
          },
          {
            session: MarketSessionType.PRE_MARKET,
            startMinute: 510, // 08:30
            endMinute: 540, // 09:00
            displayNameVi: 'Tiền thị trường TSE',
            isTradable: false,
            isOrderEntryAllowed: true,
            isContinuousTrading: false,
          },
          {
            session: MarketSessionType.OPEN,
            startMinute: 540, // 09:00
            endMinute: 690, // 11:30
            displayNameVi: 'Phiên sáng TSE (Morning Session)',
            isTradable: true,
            isOrderEntryAllowed: true,
            isContinuousTrading: true,
          },
          {
            session: MarketSessionType.LUNCH_BREAK,
            startMinute: 690, // 11:30
            endMinute: 750, // 12:30
            displayNameVi: 'Nghỉ trưa TSE (Lunch Break)',
            isTradable: false,
            isOrderEntryAllowed: true,
            isContinuousTrading: false,
          },
          {
            session: MarketSessionType.OPEN,
            startMinute: 750, // 12:30
            endMinute: 930, // 15:30
            displayNameVi: 'Phiên chiều TSE (Afternoon Session)',
            isTradable: true,
            isOrderEntryAllowed: true,
            isContinuousTrading: true,
          },
          {
            session: MarketSessionType.CLOSED,
            startMinute: 930, // 15:30
            endMinute: 1440,
            displayNameVi: 'Đóng cửa thị trường Tokyo',
            isTradable: false,
            isOrderEntryAllowed: false,
            isContinuousTrading: false,
          },
        ];

      case 'singapore':
        return [
          {
            session: MarketSessionType.CLOSED,
            startMinute: 0,
            endMinute: 510, // 08:30
            displayNameVi: 'Đóng cửa thị trường SGX',
            isTradable: false,
            isOrderEntryAllowed: false,
            isContinuousTrading: false,
          },
          {
            session: MarketSessionType.PRE_MARKET,
            startMinute: 510, // 08:30
            endMinute: 540, // 09:00
            displayNameVi: 'Tiền thị trường SGX',
            isTradable: false,
            isOrderEntryAllowed: true,
            isContinuousTrading: false,
          },
          {
            session: MarketSessionType.OPEN,
            startMinute: 540, // 09:00
            endMinute: 720, // 12:00
            displayNameVi: 'Phiên sáng SGX',
            isTradable: true,
            isOrderEntryAllowed: true,
            isContinuousTrading: true,
          },
          {
            session: MarketSessionType.LUNCH_BREAK,
            startMinute: 720, // 12:00
            endMinute: 780, // 13:00
            displayNameVi: 'Nghỉ trưa SGX',
            isTradable: false,
            isOrderEntryAllowed: true,
            isContinuousTrading: false,
          },
          {
            session: MarketSessionType.OPEN,
            startMinute: 780, // 13:00
            endMinute: 1020, // 17:00
            displayNameVi: 'Phiên chiều SGX',
            isTradable: true,
            isOrderEntryAllowed: true,
            isContinuousTrading: true,
          },
          {
            session: MarketSessionType.CLOSED,
            startMinute: 1020, // 17:00
            endMinute: 1440,
            displayNameVi: 'Đóng cửa thị trường SGX',
            isTradable: false,
            isOrderEntryAllowed: false,
            isContinuousTrading: false,
          },
        ];

      case 'europe':
        return [
          {
            session: MarketSessionType.CLOSED,
            startMinute: 0,
            endMinute: 480, // 08:00
            displayNameVi: 'Đóng cửa thị trường Châu Âu',
            isTradable: false,
            isOrderEntryAllowed: false,
            isContinuousTrading: false,
          },
          {
            session: MarketSessionType.PRE_MARKET,
            startMinute: 480, // 08:00
            endMinute: 540, // 09:00
            displayNameVi: 'Tiền thị trường Châu Âu',
            isTradable: false,
            isOrderEntryAllowed: true,
            isContinuousTrading: false,
          },
          {
            session: MarketSessionType.OPEN,
            startMinute: 540, // 09:00
            endMinute: 1050, // 17:30
            displayNameVi: 'Phiên khớp lệnh liên tục Châu Âu',
            isTradable: true,
            isOrderEntryAllowed: true,
            isContinuousTrading: true,
          },
          {
            session: MarketSessionType.CLOSED,
            startMinute: 1050, // 17:30
            endMinute: 1440,
            displayNameVi: 'Đóng cửa thị trường Châu Âu',
            isTradable: false,
            isOrderEntryAllowed: false,
            isContinuousTrading: false,
          },
        ];

      default: // 'global' or default continuous
        return [
          {
            session: MarketSessionType.OPEN,
            startMinute: 0,
            endMinute: 1440,
            displayNameVi: 'Khớp lệnh Liên tục Toàn cầu',
            isTradable: true,
            isOrderEntryAllowed: true,
            isContinuousTrading: true,
          },
        ];
    }
  }

  /**
   * Authoritative calculation of MarketSessionState for any simulation timestamp
   */
  public static getSessionState(
    marketConfigOrId: MarketConfig | string,
    simulationTimestamp: number | string
  ): MarketSessionState {
    const config = typeof marketConfigOrId === 'string'
      ? SUPPORTED_MARKETS[marketConfigOrId] || SUPPORTED_MARKETS.vietnam
      : marketConfigOrId;

    const epochMs = typeof simulationTimestamp === 'string'
      ? new Date(simulationTimestamp).getTime()
      : simulationTimestamp;

    const timezone = config.tradingHours?.timezone || 'Asia/Ho_Chi_Minh';
    const localTime = this.getLocalTimeInfo(epochMs, timezone);
    const marketId = config.id || 'vietnam';

    // 1. Weekend Check
    if (localTime.isWeekend) {
      // Find timestamp when Monday opens
      return {
        marketId,
        session: MarketSessionType.CLOSED,
        isTradable: false,
        isOrderEntryAllowed: true, // Allow queueing limit orders over weekend
        isContinuousTrading: false,
        marketDate: localTime.marketDate,
        localTime: localTime.localTime,
        timezone,
        nextSessionTimestamp: epochMs + 86400000, // Approximation for UI badge
        previousSessionTimestamp: epochMs - 86400000,
        displayNameVi: 'Đóng cửa (Cuối tuần)',
        reason: 'Cuối tuần (Thứ Bảy / Chủ Nhật)',
      };
    }

    // 2. Holiday Check
    if (TradingCalendar.isHoliday(marketId, localTime.marketDate)) {
      const holidayName = TradingCalendar.getHolidayName(marketId, localTime.marketDate);
      return {
        marketId,
        session: MarketSessionType.CLOSED,
        isTradable: false,
        isOrderEntryAllowed: true,
        isContinuousTrading: false,
        marketDate: localTime.marketDate,
        localTime: localTime.localTime,
        timezone,
        nextSessionTimestamp: epochMs + 86400000,
        previousSessionTimestamp: epochMs - 86400000,
        displayNameVi: `Đóng cửa (${holidayName || 'Nghỉ lễ'})`,
        reason: holidayName || 'Nghỉ lễ theo lịch thị trường',
      };
    }

    // 3. Intra-day Schedule Evaluation
    const rules = this.getMarketRules(marketId);
    const minuteOfDay = localTime.minuteOfDay;

    for (let i = 0; i < rules.length; i++) {
      const rule = rules[i];
      if (minuteOfDay >= rule.startMinute && minuteOfDay < rule.endMinute) {
        const deltaMinutesToEnd = rule.endMinute - minuteOfDay;
        const deltaMinutesFromStart = minuteOfDay - rule.startMinute;
        const nextTimestamp = epochMs + (deltaMinutesToEnd * 60 - localTime.second) * 1000;
        const prevTimestamp = epochMs - (deltaMinutesFromStart * 60 + localTime.second) * 1000;
        const nextRule = rules[(i + 1) % rules.length];

        return {
          marketId,
          session: rule.session,
          isTradable: rule.isTradable,
          isOrderEntryAllowed: rule.isOrderEntryAllowed,
          isContinuousTrading: rule.isContinuousTrading,
          marketDate: localTime.marketDate,
          localTime: localTime.localTime,
          timezone,
          nextSessionTimestamp: nextTimestamp,
          previousSessionTimestamp: prevTimestamp,
          nextSessionType: nextRule?.session,
          displayNameVi: rule.displayNameVi,
        };
      }
    }

    // Fallback closed
    return {
      marketId,
      session: MarketSessionType.CLOSED,
      isTradable: false,
      isOrderEntryAllowed: false,
      isContinuousTrading: false,
      marketDate: localTime.marketDate,
      localTime: localTime.localTime,
      timezone,
      nextSessionTimestamp: epochMs + 3600000,
      previousSessionTimestamp: epochMs - 3600000,
      displayNameVi: 'Đóng cửa thị trường',
    };
  }

  /**
   * Validates whether an order of given type can be submitted during active session
   */
  public static validateOrderForSession(
    orderType: OrderType,
    sessionState: MarketSessionState
  ): { allowed: boolean; errorMessage?: string } {
    // A. Market Orders require continuous active matching
    if (orderType === 'MARKET') {
      if (!sessionState.isContinuousTrading) {
        if (sessionState.session === MarketSessionType.ATO) {
          return {
            allowed: false,
            errorMessage: 'Lệnh thị trường (MP) không được chấp nhận trong phiên khớp lệnh định kỳ mở cửa (ATO). Vui lòng sử dụng lệnh Giới hạn (LO).',
          };
        }
        if (sessionState.session === MarketSessionType.ATC) {
          return {
            allowed: false,
            errorMessage: 'Lệnh thị trường (MP) không được chấp nhận trong phiên khớp lệnh định kỳ đóng cửa (ATC). Vui lòng sử dụng lệnh Giới hạn (LO).',
          };
        }
        if (sessionState.session === MarketSessionType.LUNCH_BREAK) {
          return {
            allowed: false,
            errorMessage: 'Thị trường đang nghỉ giữa phiên. Lệnh thị trường (Market Order) chỉ được chấp nhận trong phiên khớp lệnh liên tục.',
          };
        }
        if (sessionState.session === MarketSessionType.CLOSED) {
          return {
            allowed: false,
            errorMessage: `Thị trường hiện đang đóng cửa (${sessionState.displayNameVi}). Lệnh thị trường không thể thực hiện ngoài giờ giao dịch.`,
          };
        }
        return {
          allowed: false,
          errorMessage: `Lệnh thị trường (Market Order) chỉ hợp lệ trong phiên khớp lệnh liên tục (Hiện tại: ${sessionState.displayNameVi}).`,
        };
      }
      return { allowed: true };
    }

    // B. Limit Orders can be submitted during Open, ATO, ATC, Pre-market, and queued during Lunch Break / Closed
    if (orderType === 'LIMIT') {
      if (!sessionState.isOrderEntryAllowed && sessionState.session === MarketSessionType.CLOSED) {
        // Many markets allow placing limit orders overnight in queued state
        return { allowed: true };
      }
      return { allowed: true };
    }

    // C. Conditional Orders (Stop, Trailing, Bracket, OCO)
    // Order entry is permitted into the client/engine state at any time; execution will be guarded by ConditionalOrderEngine
    return { allowed: true };
  }

  /**
   * Adapts canonical MarketSessionState to MarketStatus interface for UI/API consumption
   */
  public static getSessionStatus(
    marketId: string,
    simulationTimestamp?: number
  ): MarketStatus {
    const config = SUPPORTED_MARKETS[marketId] || SUPPORTED_MARKETS.vietnam;
    const epochMs = simulationTimestamp !== undefined ? simulationTimestamp : Date.now();
    const sessionState = this.getSessionState(config, epochMs);

    const openHour = config.tradingHours.openHour.toString().padStart(2, '0');
    const openMinute = config.tradingHours.openMinute.toString().padStart(2, '0');
    const closeHour = config.tradingHours.closeHour.toString().padStart(2, '0');
    const closeMinute = config.tradingHours.closeMinute.toString().padStart(2, '0');

    return {
      market: config.name,
      isOpen: sessionState.isTradable,
      currentSession: sessionState.displayNameVi,
      timezone: sessionState.timezone,
      tradingHours: `${openHour}:${openMinute} - ${closeHour}:${closeMinute}`,
    };
  }
}
