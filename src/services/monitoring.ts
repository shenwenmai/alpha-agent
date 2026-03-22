// 简单的内存监控指标 (Prototype)
export const metrics = {
  crisisFailures: 0,
  extractionSuccess: 0,
  extractionTotal: 0,
  needsReviewBacklog: 0,
  crashes: 0,
  syncLatencyMs: [] as number[]
};

export function logCrash() {
  metrics.crashes++;
}

export function logCrisisFailure() {
  metrics.crisisFailures++;
}

export function logExtraction(success: boolean) {
  metrics.extractionTotal++;
  if (success) metrics.extractionSuccess++;
}

export function updateBacklog(count: number) {
  metrics.needsReviewBacklog = count;
}

export function logLatency(ms: number) {
  metrics.syncLatencyMs.push(ms);
}

export function checkThresholds(): { passed: boolean; report: string } {
  const successRate = metrics.extractionTotal > 0 ? (metrics.extractionSuccess / metrics.extractionTotal) : 1;
  const avgLatency = metrics.syncLatencyMs.length > 0 
    ? metrics.syncLatencyMs.reduce((a,b)=>a+b,0) / metrics.syncLatencyMs.length 
    : 0;
  
  const passed = (
    metrics.crisisFailures === 0 &&
    metrics.crashes === 0 &&
    successRate >= 0.95 &&
    metrics.needsReviewBacklog < 20
  );

  const report = `
  监控报告 (24h Window):
  - 危机漏接: ${metrics.crisisFailures} (阈值: 0) [${metrics.crisisFailures === 0 ? 'PASS' : 'FAIL'}]
  - Crash-free: ${metrics.crashes === 0 ? '100%' : 'FAIL'} (阈值: 99.9%) [${metrics.crashes === 0 ? 'PASS' : 'FAIL'}]
  - 提取成功率: ${(successRate * 100).toFixed(1)}% (阈值: 95%) [${successRate >= 0.95 ? 'PASS' : 'FAIL'}]
  - 待审核积压: ${metrics.needsReviewBacklog} (阈值: <20) [${metrics.needsReviewBacklog < 20 ? 'PASS' : 'FAIL'}]
  - 平均同步延迟: ${avgLatency.toFixed(0)}ms
  `;

  return { passed, report };
}
