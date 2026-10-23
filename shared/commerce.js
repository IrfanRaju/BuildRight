export const ORDER_STATUSES = ['Pending', 'Confirmed', 'Processing', 'Dispatched', 'Out for Delivery', 'Delivered', 'Cancelled'];

export const DEFAULT_COMMERCE = {
  deliveryBasePkr: 800,
  deliveryPerKmPkr: 25,
  defaultDistanceKm: 8,
  freeDeliveryOver: 75000,
  taxPercent: 18,
  taxLabel: 'GST (illustrative — confirm the rate that applies to your invoice)',
  contingencyPercent: 8,
  conditionFactors: { minor: 1, moderate: 1.35, major: 1.8 },
  cityDistancesKm: {
    Islamabad: 8,
    Rawalpindi: 12,
    Lahore: 18,
    Karachi: 22,
    Peshawar: 16,
    Multan: 20,
    Faisalabad: 18,
    'Gilgit-Baltistan': 30,
  },
  priceNotice: 'Prices are administrator-managed or supplier-verified. BuildRight does not claim that these prices are live.',
};

export const REPAIR_DISCLAIMER = 'This is a planning estimate. It depends on actual site conditions, access, and the measured area. It is not a contractor quotation or a certified bill of quantities. Labor rates are configurable planning rates. Material prices are catalog prices with a last-updated date, not a live market feed.';

export const SERVICE_REQUEST_NOTICE = 'This is a service request only. A painter, plumber, electrician, or repair contractor is not booked until the request is accepted by a provider and then confirmed.';

export const CANCELLATION_RULES = 'You can cancel while an order is Pending or Confirmed. After processing starts, ask an administrator. Stock is returned automatically when an order is cancelled before it is dispatched.';

export function moneyRound(value) {
  return Math.max(0, Math.round(Number(value) || 0));
}

export function deliveryCharge(subtotal, distanceKm, settings = DEFAULT_COMMERCE) {
  const goods = moneyRound(subtotal);
  const freeOver = Number(settings.freeDeliveryOver) || 0;
  if (freeOver > 0 && goods >= freeOver) return 0;
  const distance = Math.max(0, Number(distanceKm) || Number(settings.defaultDistanceKm) || 0);
  return moneyRound((Number(settings.deliveryBasePkr) || 0) + distance * (Number(settings.deliveryPerKmPkr) || 0));
}

export function distanceForCity(city, settings = DEFAULT_COMMERCE) {
  const table = settings.cityDistancesKm || DEFAULT_COMMERCE.cityDistancesKm;
  return table[city] || settings.defaultDistanceKm || DEFAULT_COMMERCE.defaultDistanceKm;
}

export function orderTotals({ subtotal, distanceKm, settings = DEFAULT_COMMERCE }) {
  const goods = moneyRound(subtotal);
  const delivery = deliveryCharge(goods, distanceKm, settings);
  const tax = moneyRound(goods * ((Number(settings.taxPercent) || 0) / 100));
  return {
    subtotal: goods,
    delivery,
    tax,
    taxLabel: settings.taxLabel || DEFAULT_COMMERCE.taxLabel,
    total: goods + delivery + tax,
  };
}

export function canCustomerCancel(status) {
  return status === 'Pending' || status === 'Confirmed';
}

export function restoresStock(status) {
  return status === 'Pending' || status === 'Confirmed' || status === 'Processing';
}

export function allowedStatusChange(current, next) {
  if (!ORDER_STATUSES.includes(next) || current === next) return false;
  if (current === 'Delivered' || current === 'Cancelled') return false;
  if (next === 'Cancelled') return true;
  const flow = ORDER_STATUSES.filter((status) => status !== 'Cancelled');
  return flow[flow.indexOf(current) + 1] === next;
}
