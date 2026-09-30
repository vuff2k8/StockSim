/**
 * Utilities for high-precision financial formatting across multiple markets
 */

export function formatCurrency(amount: number, currency: string = 'VND', options?: { compact?: boolean }): string {
  if (isNaN(amount) || amount === null || amount === undefined) {
    return '0 ' + currency;
  }

  const isVND = currency.toUpperCase() === 'VND';
  const isUSD = currency.toUpperCase() === 'USD';
  const isJPY = currency.toUpperCase() === 'JPY';
  const isEUR = currency.toUpperCase() === 'EUR';
  const isSGD = currency.toUpperCase() === 'SGD';

  if (options?.compact) {
    if (isVND) {
      if (Math.abs(amount) >= 1_000_000_000) {
        return (amount / 1_000_000_000).toFixed(2) + ' tỷ ₫';
      }
      if (Math.abs(amount) >= 1_000_000) {
        return (amount / 1_000_000).toFixed(1) + ' tr ₫';
      }
      if (Math.abs(amount) >= 1_000) {
        return (amount / 1_000).toFixed(0) + ' k ₫';
      }
    } else {
      if (Math.abs(amount) >= 1_000_000_000) {
        return (amount / 1_000_000_000).toFixed(2) + 'B ' + currency;
      }
      if (Math.abs(amount) >= 1_000_000) {
        return (amount / 1_000_000).toFixed(2) + 'M ' + currency;
      }
      if (Math.abs(amount) >= 1_000) {
        return (amount / 1_000).toFixed(1) + 'K ' + currency;
      }
    }
  }

  if (isVND) {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      maximumFractionDigits: 0,
    }).format(amount);
  }

  if (isUSD) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  }

  if (isJPY) {
    return new Intl.NumberFormat('ja-JP', {
      style: 'currency',
      currency: 'JPY',
      maximumFractionDigits: 0,
    }).format(amount);
  }

  if (isEUR) {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  }

  if (isSGD) {
    return new Intl.NumberFormat('en-SG', {
      style: 'currency',
      currency: 'SGD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  }

  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount) + ' ' + currency;
}

export function formatStockPrice(price: number, currency: string = 'VND'): string {
  if (isNaN(price)) return '0';
  if (currency.toUpperCase() === 'VND') {
    return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(price) + ' ₫';
  }
  if (currency.toUpperCase() === 'JPY') {
    return '¥' + new Intl.NumberFormat('ja-JP', { maximumFractionDigits: 0 }).format(price);
  }
  if (currency.toUpperCase() === 'EUR') {
    return '€' + price.toFixed(2);
  }
  if (currency.toUpperCase() === 'SGD') {
    return 'S$' + price.toFixed(2);
  }
  return '$' + price.toFixed(2);
}

export function formatPercent(value: number, showSign: boolean = true): string {
  if (isNaN(value)) return '0.00%';
  const sign = showSign && value > 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}

export function formatChange(value: number, currency: string = 'VND'): string {
  if (isNaN(value)) return '0';
  const sign = value > 0 ? '+' : '';
  return `${sign}${formatStockPrice(value, currency)}`;
}

export function formatVolume(volume: number): string {
  if (isNaN(volume)) return '0';
  if (volume >= 1_000_000_000) return (volume / 1_000_000_000).toFixed(2) + 'B';
  if (volume >= 1_000_000) return (volume / 1_000_000).toFixed(2) + 'M';
  if (volume >= 1_000) return (volume / 1_000).toFixed(1) + 'K';
  return volume.toLocaleString();
}

export function formatDateTime(isoStringOrTimestamp: string | number): string {
  const d = new Date(isoStringOrTimestamp);
  return d.toLocaleString('vi-VN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

export function formatDateOnly(isoStringOrTimestamp: string | number): string {
  const d = new Date(isoStringOrTimestamp);
  return d.toLocaleDateString('vi-VN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

export function formatTimeOnly(isoStringOrTimestamp: string | number): string {
  const d = new Date(isoStringOrTimestamp);
  return d.toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}
