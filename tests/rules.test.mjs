import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseDate, addMonths, addDays, diffDays, fmt } from '../js/dates.js';
import { computeTimeline } from '../js/rules.js';

const T = (s) => parseDate(s);
const keys = (r) => r.milestones.map((m) => m.key);
const get = (r, k) => r.milestones.find((m) => m.key === k);

test('addMonths clamps month end', () => {
  assert.equal(fmt(addMonths(T('2026-01-31'), 1)), '2026-02-28');
  assert.equal(fmt(addMonths(T('2024-01-31'), 1)), '2024-02-29');
  assert.equal(fmt(addMonths(T('2026-01-31'), 12)), '2027-01-31');
});

test('diffDays and addDays', () => {
  assert.equal(diffDays(T('2026-01-01'), T('2026-03-01')), 59);
  assert.equal(fmt(addDays(T('2026-12-31'), 1)), '2027-01-01');
  assert.equal(parseDate('nope'), null);
  assert.equal(parseDate(''), null);
});

test('no EAD yet: only OPT window + grace, no crash', () => {
  const r = computeTimeline({ programEnd: '2027-05-15', isStem: true, unemployedDays: 0 }, T('2027-01-10'));
  assert.deepEqual(keys(r).filter((k) => k.startsWith('opt-')), ['opt-window-open', 'opt-window-close']);
  assert.equal(get(r, 'opt-window-open').date, '2027-02-14');
  assert.equal(get(r, 'opt-window-close').date, '2027-07-14');
  assert.equal(r.status.phase, 'pre-opt');
  assert.equal(r.status.authEnd, '2027-07-14');
  assert.equal(r.status.missedOptWindow, false);
});

test('missed OPT window without EAD', () => {
  const r = computeTimeline({ programEnd: '2026-05-15', isStem: false, unemployedDays: 0 }, T('2026-08-01'));
  assert.equal(r.status.missedOptWindow, true);
  assert.equal(r.status.phase, 'expired');
  assert.equal(r.status.daysLeft, 0);
});

test('non-STEM OPT: limit 90, EAD default 12 months, grace 60, no STEM window', () => {
  const r = computeTimeline({ programEnd: '2026-05-15', isStem: false, eadStart: '2026-06-01', unemployedDays: 30 }, T('2026-09-01'));
  assert.equal(r.status.unemployLimit, 90);
  assert.equal(r.status.unemployLeft, 60);
  assert.equal(get(r, 'ead-end').date, '2027-05-31');
  assert.equal(get(r, 'grace-end').date, '2027-07-30');
  assert.ok(!keys(r).includes('stem-window-open'));
  assert.equal(r.status.phase, 'opt');
  assert.equal(r.status.authEnd, '2027-05-31');
  assert.equal(r.status.daysLeft, diffDays(T('2026-09-01'), T('2027-05-31')));
});

test('STEM eligible on OPT: STEM window 90 days before EAD end, limit still 90 until on STEM', () => {
  const r = computeTimeline({ programEnd: '2026-05-15', isStem: true, eadStart: '2026-06-01', eadEnd: '2027-05-31', unemployedDays: 10 }, T('2026-09-01'));
  assert.equal(get(r, 'stem-window-open').date, '2027-03-02');
  assert.equal(get(r, 'stem-window-close').date, '2027-05-31');
  assert.equal(r.status.unemployLimit, 90);
});

test('on STEM OPT: limit 150, stemEnd default +24 months', () => {
  const r = computeTimeline({ programEnd: '2025-05-15', isStem: true, eadStart: '2025-06-01', eadEnd: '2026-05-31', onStem: true, unemployedDays: 100 }, T('2026-09-01'));
  assert.equal(r.status.unemployLimit, 150);
  assert.equal(r.status.unemployLeft, 50);
  assert.equal(get(r, 'stem-end').date, '2028-05-31');
  assert.equal(r.status.phase, 'stem');
  assert.equal(r.status.authEnd, '2028-05-31');
});

test('over unemployment limit', () => {
  const r = computeTimeline({ programEnd: '2026-05-15', isStem: false, eadStart: '2026-06-01', unemployedDays: 95 }, T('2026-09-01'));
  assert.equal(r.status.overLimit, true);
  assert.equal(r.status.unemployLeft, 0);
});

test('grace phase after EAD end', () => {
  const r = computeTimeline({ programEnd: '2025-05-15', isStem: false, eadStart: '2025-06-01', unemployedDays: 0 }, T('2026-06-10'));
  assert.equal(r.status.phase, 'grace');
});

test('H-1B filed adds cap-gap to April 1 next year and extends authEnd', () => {
  const r = computeTimeline({ programEnd: '2025-05-15', isStem: false, eadStart: '2025-06-01', unemployedDays: 0, h1bFiled: true }, T('2026-05-10'));
  assert.equal(get(r, 'cap-gap-end').date, '2027-04-01');
  assert.equal(r.status.authEnd, '2027-04-01');
});

test('h1bChances counts March registrations while authorized through April 1', () => {
  // STEM: authorized until 2029-05-31 → March 2027, 2028, 2029
  const r = computeTimeline({ programEnd: '2026-05-15', isStem: true, eadStart: '2026-06-01', eadEnd: '2027-05-31', onStem: true, unemployedDays: 0 }, T('2026-09-01'));
  assert.equal(r.status.h1bChances, 3);
  // non-STEM, authorized until 2027-05-31 → only March 2027
  const r2 = computeTimeline({ programEnd: '2026-05-15', isStem: false, eadStart: '2026-06-01', unemployedDays: 0 }, T('2026-09-01'));
  assert.equal(r2.status.h1bChances, 1);
  // STEM eligible but not yet on STEM → counts potential STEM period
  const r3 = computeTimeline({ programEnd: '2026-05-15', isStem: true, eadStart: '2026-06-01', unemployedDays: 0 }, T('2026-09-01'));
  assert.equal(r3.status.h1bChances, 3);
});

test('milestones sorted by date', () => {
  const r = computeTimeline({ programEnd: '2026-05-15', isStem: true, eadStart: '2026-06-01', unemployedDays: 0 }, T('2026-09-01'));
  const ds = r.milestones.map((m) => m.date);
  assert.deepEqual(ds, [...ds].sort());
});
