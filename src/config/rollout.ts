export const ROLLOUT_CONFIG = {
  // 当前灰度比例 (0.0 - 1.0)
  // 监控达标，自动升级至 30%
  PERCENTAGE: 0.30, 
  // 灰度版本号
  VERSION: 'v1.1.3-grey'
};

export function isUserInRollout(userId: string): boolean {
  if (!userId) return false;
  // Simple deterministic logic: use last char code
  const lastChar = userId.charCodeAt(userId.length - 1);
  // 0-99 range
  const bucket = lastChar % 100; 
  return bucket < (ROLLOUT_CONFIG.PERCENTAGE * 100);
}
