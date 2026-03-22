// ============================================================
// rateLimiter — 客户端限流 (令牌桶)
//
// 限制策略 (不伤体验):
//   每分钟 15 次
//   每小时 180 次
//   每日   800 次
//   并发 = 1 (已有去重保证)
//
// 超限返回友好提示，不直接封禁
// ============================================================

interface Bucket {
  tokens: number;
  maxTokens: number;
  refillRate: number;   // tokens per ms
  lastRefill: number;
}

function createBucket(maxTokens: number, refillPeriodMs: number): Bucket {
  return {
    tokens: maxTokens,
    maxTokens,
    refillRate: maxTokens / refillPeriodMs,
    lastRefill: Date.now(),
  };
}

function tryConsume(bucket: Bucket): boolean {
  const now = Date.now();
  const elapsed = now - bucket.lastRefill;
  bucket.tokens = Math.min(bucket.maxTokens, bucket.tokens + elapsed * bucket.refillRate);
  bucket.lastRefill = now;

  if (bucket.tokens >= 1) {
    bucket.tokens -= 1;
    return true;
  }
  return false;
}

// --- 三层桶 ---
const minuteBucket = createBucket(15, 60_000);      // 15/min
const hourBucket = createBucket(180, 3_600_000);     // 180/hour
const dayBucket = createBucket(800, 86_400_000);     // 800/day

export interface RateLimitResult {
  allowed: boolean;
  reason?: string;
  retryAfterMs?: number;
  friendlyMessage?: string;
}

export function checkRateLimit(): RateLimitResult {
  // 日限优先检查
  if (!tryConsume(dayBucket)) {
    return {
      allowed: false,
      reason: 'daily_limit',
      retryAfterMs: 60_000,
      friendlyMessage: '今天聊了很多了，先休息一下。明天继续？',
    };
  }

  // 时限
  if (!tryConsume(hourBucket)) {
    return {
      allowed: false,
      reason: 'hourly_limit',
      retryAfterMs: 30_000,
      friendlyMessage: '这一小时聊了不少，暂停一下，等会继续。',
    };
  }

  // 分限
  if (!tryConsume(minuteBucket)) {
    return {
      allowed: false,
      reason: 'minute_limit',
      retryAfterMs: 5_000,
      friendlyMessage: '说慢一点，我跟上。稍等几秒。',
    };
  }

  return { allowed: true };
}

// --- 统计 ---
export function getRateLimitStats() {
  return {
    minute: { remaining: Math.floor(minuteBucket.tokens), max: minuteBucket.maxTokens },
    hour: { remaining: Math.floor(hourBucket.tokens), max: hourBucket.maxTokens },
    day: { remaining: Math.floor(dayBucket.tokens), max: dayBucket.maxTokens },
  };
}
