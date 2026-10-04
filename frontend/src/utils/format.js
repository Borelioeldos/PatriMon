/**
 * Centralized formatting utilities for PatriMon (currency, percentage, dates)
 */

export function formatCurrency(amount, currency = 'EUR', decimals = 2) {
  const num = typeof amount === 'number' ? amount : parseFloat(amount) || 0;
  try {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: currency || 'EUR',
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(num);
  } catch (_) {
    // Fallback if currency code is unusual
    return `${num.toFixed(decimals)} ${currency}`;
  }
}

export function formatEUR(amount, decimals = 2) {
  return formatCurrency(amount, 'EUR', decimals);
}

export function formatEURPrecise(amount) {
  return formatCurrency(amount, 'EUR', 2);
}

export function formatEURCompact(amount) {
  return formatCurrency(amount, 'EUR', 0);
}

export function formatPercent(val, decimals = 2, showSign = true) {
  const num = typeof val === 'number' ? val : parseFloat(val) || 0;
  const sign = showSign && num > 0 ? '+' : '';
  return `${sign}${num.toFixed(decimals)}%`;
}

export function formatDate(dateStr) {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  } catch (_) {
    return dateStr;
  }
}

export function formatDateTime(dateStr) {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  } catch (_) {
    return dateStr;
  }
}

export function formatNumber(val, decimals = 2) {
  const num = typeof val === 'number' ? val : parseFloat(val) || 0;
  return new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num);
}
