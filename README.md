# @lp-labs/anomaly-rules

Bounded, explainable numeric anomaly rules based on median/MAD with an interquartile-range fallback. No runtime or peer dependencies.

## Install

```sh
npm install @lp-labs/anomaly-rules
```

Node 18+ or ES2022 browsers. ESM, CommonJS, and declarations are included.

## Quick start

```js
import { createAnomalyRules } from '@lp-labs/anomaly-rules';

const rules = createAnomalyRules({ threshold: 3.5 });
const result = rules.evaluate(20, [1, 2, 2, 3, 100]);
console.log(result.anomalous, result.method); // true, "modified-z-score"
```

CommonJS: `const { createAnomalyRules } = require('@lp-labs/anomaly-rules');`.

## API reference

Runtime exports: `createAnomalyRules`, `AnomalyRuleError`.

Types: `AnomalyMethod`, `AnomalyRuleOptions`, `AnomalyResult`, `AnomalyRules`.

### `createAnomalyRules(options?): AnomalyRules`

| Option                |  Default | Meaning                                                                                                     |
| --------------------- | -------: | ----------------------------------------------------------------------------------------------------------- |
| `threshold`           |    `3.5` | Positive finite score threshold; an observation is anomalous only when its score is greater than this value |
| `minimumBaselineSize` |      `5` | Minimum baseline sample count (at least 3)                                                                  |
| `maxBaselineSize`     | `100000` | Per-evaluation input bound; at most 1,000,000                                                               |

`evaluate(value, baseline)` validates every value as finite, sorts a copy of the baseline, and returns `value`, `median`, `score`, `threshold`, `anomalous`, and the selected `method`.

- A nonzero median absolute deviation uses `0.6744897501960817 * abs(value - median) / MAD`, a normalized modified z-score.
- If MAD is zero but the interquartile range is not, the score uses `abs(value - median) / (IQR / 1.349)`.
- A constant baseline gives score 0 for an equal observation and positive infinity otherwise.
- The caller's baseline array is not sorted or mutated.

### Errors

`AnomalyRuleError.code` is `invalid`, `insufficient-baseline`, or `capacity`. Options and samples are rejected rather than silently coerced.

## Customization and limitations

```js
import { createAnomalyRules } from '@lp-labs/anomaly-rules';

const conservative = createAnomalyRules({ threshold: 4, minimumBaselineSize: 20 });
const result = conservative.evaluate(
  31,
  [10, 11, 12, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28],
);
console.log(result.score, result.anomalous);
```

Provide a representative baseline for the same metric and population. These are deterministic descriptive rules, not a learned model: they do not detect seasonality, trends, change points, correlated features, or causal anomalies. Scores are not probabilities; calibrate thresholds against domain-specific costs and inspect drift. The baseline is recomputed for each call and limited to 1,000,000 numeric samples.

## Support

If this library is useful to you, consider supporting its maintenance with a [donation via PayPal](https://www.paypal.me/LibinPrasanth).

## Author

Created by [Libin Prasanth](https://www.linkedin.com/in/libinprasanth/). Connect on LinkedIn for updates and discussion.
