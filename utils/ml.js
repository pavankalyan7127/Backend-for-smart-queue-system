// backend/utils/ml.js

/**
 * classifyCount - rule-based classification
 * You can later replace with a trained DecisionTree or load a model.
 */
export function classifyCount(count) {
  // You can change thresholds as needed or compute adaptive thresholds
  if (count < 5) return "Low";
  if (count < 10) return "Moderate";
  return "High";
}

/**
 * predictNextLinear - simple linear regression on last N points
 * data: [{timestamp: Date, count: Number}, ...] ordered oldest -> newest
 * returns predicted count for next time point (assumes constant interval)
 */
export function predictNextLinear(data) {
  if (!data || data.length < 2) {
    return data && data.length === 1 ? data[0].count : 0;
  }
  // convert timestamps to relative x (seconds)
  const xs = [];
  const ys = [];
  const base = new Date(data[0].timestamp).getTime() / 1000;
  data.forEach((d) => {
    xs.push((new Date(d.timestamp).getTime() / 1000) - base);
    ys.push(d.count);
  });

  const n = xs.length;
  const sumX = xs.reduce((a,b) => a+b, 0);
  const sumY = ys.reduce((a,b) => a+b, 0);
  const sumXY = xs.reduce((a,b,i) => a + b * ys[i], 0);
  const sumXX = xs.reduce((a,b) => a + b*b, 0);

  const denom = n * sumXX - sumX * sumX;
  if (denom === 0) {
    // horizontal line
    return Math.round(sumY / n);
  }
  const a = (n * sumXY - sumX * sumY) / denom; // slope
  const b = (sumY - a * sumX) / n; // intercept

  // predict at next interval: take last x and add average interval
  const lastX = xs[xs.length - 1];
  const avgInterval = xs.length > 1 ? (xs[xs.length - 1] - xs[0]) / (xs.length - 1) : (60);
  const nextX = lastX + Math.max( avgInterval, 30 ); // at least 30s
  const pred = a * nextX + b;
  return Math.max(0, Math.round(pred));
}


