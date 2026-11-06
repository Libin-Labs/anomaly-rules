import test from 'node:test';
import assert from 'node:assert/strict';
import { AnomalyRuleError, createAnomalyRules } from '../dist/esm/index.js';

test('modified z-score flags an extreme point while returning its baseline center', () => {
  const result = createAnomalyRules().evaluate(20, [1, 2, 2, 3, 100]);
  assert.equal(result.median, 2);
  assert.equal(result.method, 'modified-z-score');
  assert.ok(result.score > 3.5);
  assert.equal(result.anomalous, true);
});

test('threshold comparison is strict and reports ordinary inliers', () => {
  const detector = createAnomalyRules({ threshold: 10 });
  const result = detector.evaluate(3, [1, 2, 2, 3, 100]);
  assert.equal(result.anomalous, false);
  assert.equal(result.value, 3);
});

test('zero MAD uses the IQR fallback when the baseline has a nonzero spread', () => {
  const result = createAnomalyRules().evaluate(100, [0, 0, 0, 0, 1, 2, 3]);
  assert.equal(result.method, 'interquartile-range');
  assert.equal(result.anomalous, true);
});

test('constant baselines classify exact values as normal and different values as anomalies', () => {
  const detector = createAnomalyRules();
  assert.equal(detector.evaluate(7, [7, 7, 7, 7, 7]).anomalous, false);
  const changed = detector.evaluate(8, [7, 7, 7, 7, 7]);
  assert.equal(changed.method, 'constant-baseline');
  assert.equal(changed.score, Infinity);
  assert.equal(changed.anomalous, true);
});

test('even-sized baselines use the midpoint median', () => {
  const result = createAnomalyRules({ minimumBaselineSize: 4 }).evaluate(2.5, [1, 2, 3, 4]);
  assert.equal(result.median, 2.5);
});

test('invalid samples, insufficient data, and oversized baselines are rejected', () => {
  const detector = createAnomalyRules({ maxBaselineSize: 5 });
  assert.throws(() => detector.evaluate(1, [1, 2, 3]), { code: 'insufficient-baseline' });
  assert.throws(() => detector.evaluate(NaN, [1, 2, 3, 4, 5]), AnomalyRuleError);
  assert.throws(() => detector.evaluate(1, [1, 2, 3, 4, 5, 6]), { code: 'capacity' });
  assert.throws(() => detector.evaluate(1, [1, 2, 3, Infinity, 5]), AnomalyRuleError);
});

test('options reject invalid thresholds and unknown fields', () => {
  assert.throws(() => createAnomalyRules({ threshold: 0 }), AnomalyRuleError);
  assert.throws(() => createAnomalyRules({ minimumBaselineSize: 2 }), AnomalyRuleError);
  assert.throws(() => createAnomalyRules({ unknown: true }), AnomalyRuleError);
});

test('sparse and accessor baselines are rejected without invoking accessors', () => {
  const sparse = [1, 2, 3, 4, 5];
  delete sparse[2];
  assert.throws(() => createAnomalyRules().evaluate(2, sparse), AnomalyRuleError);
  let invoked = false;
  const accessor = [1, 2, 3, 4, 5];
  Object.defineProperty(accessor, '2', {
    enumerable: true,
    get() {
      invoked = true;
      return 3;
    },
  });
  assert.throws(() => createAnomalyRules().evaluate(2, accessor), AnomalyRuleError);
  assert.equal(invoked, false);
});

test('finite inputs at extreme magnitudes never yield a NaN score', () => {
  const result = createAnomalyRules({ minimumBaselineSize: 3 }).evaluate(
    1e308,
    [-1e308, 1e308, 1e308],
  );
  assert.equal(Number.isNaN(result.score), false);
});
