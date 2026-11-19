'use strict';
const TRACKS = ['literary', 'science', 'math'];
const STATUSES = ['not_started', 'in_progress', 'done'];
const isDate = s => {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number); const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
};
const isInt = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;
const isEmail = e => typeof e === 'string' && e.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
module.exports = { TRACKS, STATUSES, isDate, isInt, isEmail };
