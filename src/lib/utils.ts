import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCompactNumber(number: number, currency?: string) {
  const formatter = Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1,
  });
  
  if (currency) {
    // If currency is provided, we can either use it as a prefix or use native currency formatting
    // But since the currency in this app is often a symbol string from context, let's just prefix it.
    return `${currency}${formatter.format(number)}`;
  }
  
  return formatter.format(number);
}

export function getSellThroughRate(product: { quantity?: number; unitsSold?: number; unitsReceived?: number }) {
  const sold = typeof product.unitsSold === 'number' ? product.unitsSold : 0;
  const received = typeof product.unitsReceived === 'number' && product.unitsReceived > 0
    ? product.unitsReceived 
    : (product.quantity || 0) + sold;
    
  if (received <= 0) return 0;
  return (sold / received) * 100;
}

export function getProductMovementSpeed(product: { quantity?: number; unitsSold?: number; unitsReceived?: number; movement?: string }): 'fast' | 'moderate' | 'slow' | 'obsolete' {
  if (product.movement === 'obsolete') return 'obsolete';
  const str = getSellThroughRate(product);
  if (str >= 70) return 'fast';
  if (str >= 40) return 'moderate';
  return 'slow';
}
