export type EmotionScore = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

// ============================================================
// 风险等级 L0-L4（五级干预体系）
// ============================================================

export type RiskLevel = 'L0' | 'L1' | 'L2' | 'L3' | 'L4';
// L0 正常 | L1 轻提醒 | L2 正式警告 | L3 强警告 | L4 强制干预

// ============================================================
// 模块一：清醒承诺 (Commitment)
// 模板: "当我___时，我先___，并在___前不___"
// ============================================================

export interface Commitment {
  id: string;
  // 结构化模板字段
  triggerWhen: string;       // "当我___时" — 触发条件
  actionFirst: string;       // "我先___" — 保护动作
  timeWindow: string;        // "___前" — 时间窗口
  avoidAction: string;       // "不___" — 避免做什么
  content: string;           // 全文/自由格式 (兼容旧数据)
  createdAt: string;
  triggerContext: string;
  isActive: boolean;
  isPinned: boolean;         // 最多3条置顶
  lastExecutedAt?: string;   // 上次执行时间
  consecutiveDays: number;   // 连续执行天数
  is72hProtection: boolean;  // 72小时保护承诺
  expiresAt?: string;        // 72h过期时间
  sourceMessageId?: string;
  confidence?: number;
}

// ============================================================
// 模块二：崩塌记录 (Collapse Record)
// 链路: 触发场景 → 念头 → 行为 → 结果 → 拦截点
// ============================================================

export interface CollapseRecord {
  id: string;
  date: string;
  // 时间线链路字段
  triggerScene: string;      // 触发场景
  thought: string;           // 念头
  behavior: string;          // 具体行为
  consequence: string;       // 后果/结果
  interceptionPoint: string; // 拦截点 — 本可插入的拦截时刻
  trigger: string;           // 兼容旧数据 (= triggerScene alias)
  // 热点标签
  hotTags: string[];         // ['深夜','争吵后','连输3手','借贷冲动',...]
  reusableAction?: string;   // 可复用拦截动作
  // 原有字段
  emotionBefore: EmotionScore;
  emotionAfter: EmotionScore;
  evidenceQuote: string;
  sourceMessageId?: string;
  confidence?: number;
  status?: 'confirmed' | 'needs_review' | 'dropped';
}

// ============================================================
// 模块三：关系档案 (Relationship)
// ============================================================

export type RelationshipTier = 'stable_support' | 'neutral' | 'high_risk';

// 新：以联系人为中心的关系卡片
export interface RelationshipContact {
  id: string;
  person: string;
  tier: RelationshipTier;
  contactPriority: number;           // 1-5
  messageTemplate?: string;          // 求助消息模板
  topicsToAvoid: string[];           // 应避开的话题
  isCrisisContact: boolean;          // 危机时优先展示
  trustScore: number;                // 综合信任分 (0-100)
  lastContactDate?: string;
  events: RelationshipEventEntry[];  // 嵌套事件
}

export interface RelationshipEventEntry {
  id: string;
  event: string;
  trustImpact: number;
  date: string;
  sourceMessageId?: string;
  confidence?: number;
}

// 旧：保留兼容
export interface RelationshipEvent {
  id: string;
  person: string;
  event: string;
  trustImpact: number;
  date: string;
  sourceMessageId?: string;
  confidence?: number;
}

// ============================================================
// 模块四：财务记录 (Financial Record)
// 核心逻辑：投入/回收 + 资金来源(闲钱/借贷/生活金)
// ============================================================

export type FundDirection = '投入' | '回收';
export type FundSource = '闲钱' | '借贷' | '生活金';

export interface FinancialRecord {
  id: string;
  amount: number;
  date: string;
  direction: FundDirection;          // 钱去哪了：投入赌博 or 回收
  fundSource?: FundSource;           // 钱从哪来（仅投入时填）
  currency: string;
  sourceMessageId: string;
  confidence: number;
  status: 'confirmed' | 'needs_review' | 'dropped';
  // 兼容旧字段（迁移用，后续可移除）
  category?: 'loss' | 'saved' | 'income';
  transactionType?: string;
  emotionContext?: EmotionScore;
  realHourlyWageConversion?: number;
}

// ============================================================
// 30秒快速记录输入
// ============================================================

export interface QuickCollapseInput {
  triggerScene: string;
  thought: string;
  behavior: string;
  consequence: string;
  hotTags: string[];
  freeNote: string;
}

// ============================================================
// 对话管理 (Conversation)
// ============================================================

export interface Conversation {
  id: string;
  title: string;           // 自动取第一条用户消息前20字
  createdAt: string;       // ISO
  lastActiveAt: string;    // ISO，每次消息更新
  messages: Array<{ id: string; role: 'user' | 'assistant'; text: string }>;
  role: 'b' | 's';  // 最后使用的角色
  preview: string;         // 最后一条消息前40字，列表展示用
}

// ============================================================
// 行为时间线 - 聚合数据点
// ============================================================

export interface TimelineDataPoint {
  date: string;
  financial: number;
  emotion: EmotionScore;
  trust: number;
  events: Array<{
    type: 'collapse' | 'commitment' | 'relationship' | 'financial';
    id: string;
    summary: string;
  }>;
}

// ============================================================
// 用户画像 (User Profile)
// ============================================================

export interface UserProfile {
  type: 'chaser' | 'cycler' | 'sober' | 'researcher';
  stage: 'crisis' | 'construction' | 'maintenance';
  riskLevel: RiskLevel;
  lastActive: string;
  triggers: string[];
}

// ============================================================
// 触发器配置 (Trigger Config)
// ============================================================

export interface TriggerConfig {
  id: string;
  type: 'time' | 'location' | 'calendar' | 'behavior';
  name: string;
  condition: string;
  isActive: boolean;
  lastTriggered?: string;
}

// ============================================================
// 用户设置
// ============================================================

export interface UserSettings {
  hourlyWage: number;
  dailyWage: number;              // 日薪，用于"这些钱等于X天工资"
  currency: string;
  opportunityYears: number;
  opportunityRate: number;
  shareScope: 'private' | 'anonymous';
  livingFundBudget: number;       // 生活金额度（声明的保护金额）
  soberStartDate: string;         // 戒赌起始日 ISO string，首次打开时自动设置
  lastCheckinDate: string;        // 最近一次签到日期 YYYY-MM-DD
  checkinStreak: number;          // 连续签到天数
}
