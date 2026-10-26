import test from 'node:test';
import assert from 'node:assert/strict';
import { getDayProgress } from '../dailyGoal.js';

test('без профиля цель не показывается', () => {
  for (const value of [undefined, null, 0, -1, NaN]) assert.equal(getDayProgress(value, 100), null);
});
test('остаток, достижение и превышение цели', () => {
  assert.deepEqual(getDayProgress(2000, 1400), { target: 2000, eaten: 1400, remaining: 600, percent: 70 });
  assert.deepEqual(getDayProgress(2000, 2000), { target: 2000, eaten: 2000, remaining: 0, percent: 100 });
  assert.deepEqual(getDayProgress(2000, 2100), { target: 2000, eaten: 2100, remaining: -100, percent: 100 });
});
test('округление и пустой дневник', () => {
  assert.equal(getDayProgress(2000, 1999.9).remaining, 0.1);
  assert.equal(getDayProgress(2000, 0).percent, 0);
});
