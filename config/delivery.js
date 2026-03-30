// Delivery fees in Naira — single source of truth used by both frontend & backend
// Admin can override these via Settings in DB; these are the defaults/fallbacks

export const DEFAULT_DELIVERY_FEES = {
  Lagos: 5000,
  Ibadan: 2000,
  Abuja: 7000,
  Ogun: 3000,
  'Port Harcourt': 8000,
  Kano: 10000,
  Enugu: 8000,
  Kaduna: 10000,
  Benin: 7000,
  Warri: 8000,
  Others: 10000,
};

export const FREE_DELIVERY_THRESHOLD = 200000; // ₦200,000

export const DELIVERY_LOCATIONS = Object.keys(DEFAULT_DELIVERY_FEES);

/**
 * Validate and return the correct delivery fee for a given location.
 * Uses DB settings if available, otherwise falls back to defaults.
 */
export const getDeliveryFee = (location, settingsFees = null) => {
  const fees = settingsFees || DEFAULT_DELIVERY_FEES;
  return fees[location] ?? fees['Others'] ?? 10000;
};
