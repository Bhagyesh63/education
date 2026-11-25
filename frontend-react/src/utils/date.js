// Local-calendar date helpers. `new Date().toISOString()` is UTC, which yields
// yesterday's date in timezones ahead of UTC (e.g. before 05:30 in IST).

export function toLocalISODate(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function todayISO() {
  return toLocalISODate(new Date());
}
