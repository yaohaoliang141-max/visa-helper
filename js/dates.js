// 日期工具：全部用 UTC 正午，避免时区和夏令时把日期挪一天。
const DAY = 86400000;

export function parseDate(str) {
  if (typeof str !== 'string') return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str.trim());
  if (!m) return null;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], 12));
  return d.getUTCMonth() === +m[2] - 1 ? d : null;
}

export function today() {
  const n = new Date();
  return new Date(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate(), 12));
}

export function addDays(d, n) {
  return new Date(d.getTime() + n * DAY);
}

// 按日历月相加，月末夹紧（1/31 + 1 月 = 2/28 或 2/29）
export function addMonths(d, n) {
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + n;
  const last = new Date(Date.UTC(y, m + 1, 0, 12)).getUTCDate();
  return new Date(Date.UTC(y, m, Math.min(d.getUTCDate(), last), 12));
}

export function diffDays(a, b) {
  return Math.round((b.getTime() - a.getTime()) / DAY);
}

export function fmt(d) {
  return d.toISOString().slice(0, 10);
}

export function ymd(y, m, day) {
  return new Date(Date.UTC(y, m - 1, day, 12));
}
