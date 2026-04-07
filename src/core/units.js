/**
 * units.js
 * Centralized utility for converting between KG (internal) and LBS (UI).
 * All database operations MUST store values in KG.
 * UI should call these methods safely.
 */

const LBS_PER_KG = 2.20462;

export function getUnit() {
  try {
    const s = JSON.parse(localStorage.getItem('fit_elite_settings') || '{}');
    return s.unit === 'lbs' ? 'lbs' : 'kg';
  } catch(e) {
    return 'kg';
  }
}

export function isLbs() {
  return getUnit() === 'lbs';
}

/** Convert DB KG to UI Display value */
export function displayWeight(kg) {
  if (typeof kg !== 'number' || isNaN(kg)) return kg;
  if (isLbs()) return Math.round(kg * LBS_PER_KG);
  return kg;
}

/** Convert UI Input value to DB KG */
export function parseWeight(inputVal) {
  const val = parseFloat(inputVal);
  if (isNaN(val)) return 0;
  if (isLbs()) {
    // Reverse conversion, round to 1 decimal place ideally or nearest sensible interval
    return Math.round((val / LBS_PER_KG) * 10) / 10;
  }
  return val;
}

export function formatWeightStr(kg) {
  if (typeof kg !== 'number' || isNaN(kg)) return '--';
  return `${displayWeight(kg)} ${getUnit()}`;
}

export default { getUnit, isLbs, displayWeight, parseWeight, formatWeightStr };
