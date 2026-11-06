import { createAnomalyRules, type AnomalyResult } from '@lp-labs/anomaly-rules';

const detector = createAnomalyRules({ threshold: 3.5 });
const result: AnomalyResult = detector.evaluate(10, [8, 9, 10, 11, 12]);
console.log(result.anomalous);
