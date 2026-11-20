import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cumulativeOdds } from '../js/lottery.js';
import { buildIcs } from '../js/ics.js';

test('cumulativeOdds', () => {
  assert.ok(Math.abs(cumulativeOdds(1, 1) - 0.1529) < 1e-9);
  assert.ok(Math.abs(cumulativeOdds(1, 3) - 0.3925) < 0.0005);
  assert.equal(cumulativeOdds(4, 0), 0);
  assert.equal(cumulativeOdds(9, 2), 0);
});

test('buildIcs', () => {
  const ics = buildIcs(
    [
      { key: 'ead-end', date: '2027-05-31', label: 'OPT 工卡到期', note: 'a, b; c' },
      { key: 'grace-end', date: '2027-07-30', label: '宽限期结束', note: '' },
    ],
    new Date('2026-11-20T00:00:00Z'),
  );
  assert.ok(ics.startsWith('BEGIN:VCALENDAR\r\n'));
  assert.ok(ics.endsWith('END:VCALENDAR\r\n'));
  assert.equal((ics.match(/BEGIN:VEVENT/g) || []).length, 2);
  assert.ok(ics.includes('DTSTART;VALUE=DATE:20270531'));
  assert.ok(ics.includes('a\\, b\\; c'));
  assert.ok(ics.includes('TRIGGER:-P7D'));
  assert.ok(!/[^\r]\n/.test(ics));
});
