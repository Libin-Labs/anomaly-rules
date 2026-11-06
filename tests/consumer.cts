import rules = require('@lp-labs/anomaly-rules');

const result: rules.AnomalyResult = rules.createAnomalyRules().evaluate(8, [1, 2, 3, 4, 5]);
console.log(result.method);
