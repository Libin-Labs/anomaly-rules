export type AnomalyMethod = 'modified-z-score' | 'interquartile-range' | 'constant-baseline';

export interface AnomalyRuleOptions {
  threshold?: number;
  minimumBaselineSize?: number;
  maxBaselineSize?: number;
}

export interface AnomalyResult {
  value: number;
  median: number;
  score: number;
  threshold: number;
  anomalous: boolean;
  method: AnomalyMethod;
}

export interface AnomalyRules {
  evaluate(value: number, baseline: readonly number[]): AnomalyResult;
}

export class AnomalyRuleError extends Error {
  constructor(
    readonly code: 'invalid' | 'insufficient-baseline' | 'capacity',
    message: string,
  ) {
    super(message);
    this.name = 'AnomalyRuleError';
  }
}

function median(sorted: readonly number[]): number {
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? sorted[middle - 1]! / 2 + sorted[middle]! / 2 : sorted[middle]!;
}

function quantile(sorted: readonly number[], probability: number): number {
  const position = (sorted.length - 1) * probability;
  const lower = Math.floor(position);
  const fraction = position - lower;
  const upper = sorted[Math.min(lower + 1, sorted.length - 1)]!;
  return sorted[lower]! * (1 - fraction) + upper * fraction;
}

function finite(value: unknown, name: string): asserts value is number {
  if (typeof value !== 'number' || !Number.isFinite(value))
    throw new AnomalyRuleError('invalid', `${name} must be a finite number.`);
}

export function createAnomalyRules(options: AnomalyRuleOptions = {}): AnomalyRules {
  if (
    options === null ||
    typeof options !== 'object' ||
    Array.isArray(options) ||
    (Object.getPrototypeOf(options) !== Object.prototype && Object.getPrototypeOf(options) !== null)
  )
    throw new AnomalyRuleError('invalid', 'Options must be a plain object.');
  for (const key of Reflect.ownKeys(options)) {
    const descriptor =
      typeof key === 'string' ? Object.getOwnPropertyDescriptor(options, key) : undefined;
    if (
      typeof key !== 'string' ||
      !['threshold', 'minimumBaselineSize', 'maxBaselineSize'].includes(key) ||
      !descriptor?.enumerable ||
      !('value' in descriptor) ||
      typeof descriptor.value !== 'number'
    )
      throw new AnomalyRuleError('invalid', 'Options contain an unsupported field.');
  }
  const threshold = options.threshold ?? 3.5;
  const minimumBaselineSize = options.minimumBaselineSize ?? 5;
  const maxBaselineSize = options.maxBaselineSize ?? 100_000;
  if (!Number.isFinite(threshold) || threshold <= 0)
    throw new AnomalyRuleError('invalid', 'threshold must be finite and positive.');
  if (!Number.isSafeInteger(minimumBaselineSize) || minimumBaselineSize < 3)
    throw new AnomalyRuleError('invalid', 'minimumBaselineSize must be an integer of at least 3.');
  if (
    !Number.isSafeInteger(maxBaselineSize) ||
    maxBaselineSize < minimumBaselineSize ||
    maxBaselineSize > 1_000_000
  )
    throw new AnomalyRuleError(
      'invalid',
      'maxBaselineSize must be an integer between minimumBaselineSize and 1000000.',
    );

  return {
    evaluate(value, baseline) {
      finite(value, 'value');
      if (!Array.isArray(baseline))
        throw new AnomalyRuleError('invalid', 'baseline must be an array of finite numbers.');
      if (baseline.length < minimumBaselineSize)
        throw new AnomalyRuleError('insufficient-baseline', 'Baseline contains too few samples.');
      if (baseline.length > maxBaselineSize)
        throw new AnomalyRuleError('capacity', 'Baseline exceeds maxBaselineSize.');
      if (Reflect.ownKeys(baseline).length !== baseline.length + 1)
        throw new AnomalyRuleError(
          'invalid',
          'Baseline must be dense and contain no extra properties.',
        );
      const sorted: number[] = [];
      for (let index = 0; index < baseline.length; index++) {
        const descriptor = Object.getOwnPropertyDescriptor(baseline, String(index));
        if (!descriptor?.enumerable || !('value' in descriptor))
          throw new AnomalyRuleError('invalid', 'Baseline must contain enumerable data elements.');
        const sample = descriptor.value;
        finite(sample, `baseline[${index}]`);
        sorted.push(sample);
      }
      sorted.sort((a, b) => a - b);
      const center = median(sorted);
      const deviations = sorted.map((sample) => Math.abs(sample - center)).sort((a, b) => a - b);
      const mad = median(deviations);
      let score: number;
      let method: AnomalyMethod;
      if (mad > 0) {
        score = (0.6744897501960817 * Math.abs(value - center)) / mad;
        method = 'modified-z-score';
      } else {
        const spread = quantile(sorted, 0.75) - quantile(sorted, 0.25);
        if (spread > 0) {
          score = Math.abs(value - center) / (spread / 1.349);
          method = 'interquartile-range';
        } else {
          score = value === center ? 0 : Number.POSITIVE_INFINITY;
          method = 'constant-baseline';
        }
      }
      if (Number.isNaN(score)) score = value === center ? 0 : Number.POSITIVE_INFINITY;
      return {
        value,
        median: center,
        score,
        threshold,
        anomalous: score > threshold,
        method,
      };
    },
  };
}
