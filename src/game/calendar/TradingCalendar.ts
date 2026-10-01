/**
 * Authoritative Trading Calendar
 * Decoupled calendar abstraction for trading days, weekends, and holidays.
 */

export interface HolidayProvider {
  isHoliday(marketId: string, marketDate: string): boolean;
  getHolidayName(marketId: string, marketDate: string): string | null;
}

export class DefaultHolidayProvider implements HolidayProvider {
  // ISO date strings (YYYY-MM-DD) -> Holiday name
  private holidays: Map<string, string> = new Map();

  constructor() {
    this.seedDefaultHolidays();
  }

  private seedDefaultHolidays(): void {
    // Multi-market global new year
    this.addHoliday('vietnam', '2025-01-01', 'Tết Dương Lịch');
    this.addHoliday('vietnam', '2025-01-27', 'Nghỉ Tết Nguyên Đán');
    this.addHoliday('vietnam', '2025-01-28', 'Nghỉ Tết Nguyên Đán');
    this.addHoliday('vietnam', '2025-01-29', 'Nghỉ Tết Nguyên Đán');
    this.addHoliday('vietnam', '2025-01-30', 'Nghỉ Tết Nguyên Đán');
    this.addHoliday('vietnam', '2025-01-31', 'Nghỉ Tết Nguyên Đán');
    this.addHoliday('vietnam', '2025-04-07', 'Giỗ Tổ Hùng Vương');
    this.addHoliday('vietnam', '2025-04-30', 'Ngày Giải phóng Miền Nam');
    this.addHoliday('vietnam', '2025-05-01', 'Ngày Quốc tế Lao động');
    this.addHoliday('vietnam', '2025-09-02', 'Quốc khánh Việt Nam');

    this.addHoliday('vietnam', '2026-01-01', 'Tết Dương Lịch');
    this.addHoliday('vietnam', '2026-02-16', 'Nghỉ Tết Nguyên Đán');
    this.addHoliday('vietnam', '2026-02-17', 'Nghỉ Tết Nguyên Đán');
    this.addHoliday('vietnam', '2026-02-18', 'Nghỉ Tết Nguyên Đán');
    this.addHoliday('vietnam', '2026-02-19', 'Nghỉ Tết Nguyên Đán');
    this.addHoliday('vietnam', '2026-02-20', 'Nghỉ Tết Nguyên Đán');
    this.addHoliday('vietnam', '2026-04-30', 'Ngày Giải phóng Miền Nam');
    this.addHoliday('vietnam', '2026-05-01', 'Ngày Quốc tế Lao động');
    this.addHoliday('vietnam', '2026-09-02', 'Quốc khánh Việt Nam');

    // US Market Holidays
    this.addHoliday('us', '2025-01-01', "New Year's Day");
    this.addHoliday('us', '2025-01-20', 'Martin Luther King Jr. Day');
    this.addHoliday('us', '2025-02-17', "Washington's Birthday / Presidents Day");
    this.addHoliday('us', '2025-04-18', 'Good Friday');
    this.addHoliday('us', '2025-05-26', 'Memorial Day');
    this.addHoliday('us', '2025-06-19', 'Juneteenth National Independence Day');
    this.addHoliday('us', '2025-07-04', 'Independence Day');
    this.addHoliday('us', '2025-09-01', 'Labor Day');
    this.addHoliday('us', '2025-11-27', 'Thanksgiving Day');
    this.addHoliday('us', '2025-12-25', 'Christmas Day');

    this.addHoliday('us', '2026-01-01', "New Year's Day");
    this.addHoliday('us', '2026-01-19', 'Martin Luther King Jr. Day');
    this.addHoliday('us', '2026-07-03', 'Independence Day (Observed)');
    this.addHoliday('us', '2026-11-26', 'Thanksgiving Day');
    this.addHoliday('us', '2026-12-25', 'Christmas Day');

    // Japan TSE Holidays
    this.addHoliday('japan', '2025-01-01', "New Year's Day");
    this.addHoliday('japan', '2025-01-02', 'Market Bank Holiday');
    this.addHoliday('japan', '2025-01-03', 'Market Bank Holiday');
    this.addHoliday('japan', '2025-05-05', "Children's Day (Golden Week)");

    // Europe Holidays
    this.addHoliday('europe', '2025-01-01', "New Year's Day");
    this.addHoliday('europe', '2025-12-25', 'Christmas Day');
  }

  public addHoliday(marketId: string, marketDate: string, holidayName: string): void {
    this.holidays.set(`${marketId}:${marketDate}`, holidayName);
  }

  public isHoliday(marketId: string, marketDate: string): boolean {
    return this.holidays.has(`${marketId}:${marketDate}`);
  }

  public getHolidayName(marketId: string, marketDate: string): string | null {
    return this.holidays.get(`${marketId}:${marketDate}`) || null;
  }
}

export class TradingCalendar {
  private static holidayProvider: HolidayProvider = new DefaultHolidayProvider();

  public static setHolidayProvider(provider: HolidayProvider): void {
    this.holidayProvider = provider;
  }

  public static isWeekend(weekday: string): boolean {
    return weekday === 'Sat' || weekday === 'Sun';
  }

  public static isHoliday(marketId: string, marketDate: string): boolean {
    return this.holidayProvider.isHoliday(marketId, marketDate);
  }

  public static getHolidayName(marketId: string, marketDate: string): string | null {
    return this.holidayProvider.getHolidayName(marketId, marketDate);
  }

  public static isTradingDay(marketId: string, marketDate: string, weekday: string): boolean {
    if (this.isWeekend(weekday)) {
      return false;
    }
    if (this.isHoliday(marketId, marketDate)) {
      return false;
    }
    return true;
  }
}
