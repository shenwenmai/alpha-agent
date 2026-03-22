// ============================================================
// 博弈圆桌 — 房间 & 角色类型定义
// ============================================================

export type CharacterId =
  | 'junshi' | 'aqiang' | 'gailv' | 'ajie' | 'laoliu'
  | 'xiaofang' | 'dashiwang' | 'kellyprof' | 'xiaotian' | 'laozhang';

// 角色调温五维度
export interface TemperatureConfig {
  intensity: number;    // 强烈度 1-10
  rationality: number;  // 理性度 1-10
  verbosity: number;    // 话密度 1-10
  provocation: number;  // 挑逗度 1-10
  empathy: number;      // 共情度 1-10
}

// 角色完整定义
export interface CharacterDefinition {
  id: CharacterId;
  name: string;           // 显示名 e.g. "赌狗阿强"
  shortName: string;      // 短名 e.g. "阿强"
  emoji: string;          // 角色表情 e.g. "🎰"
  avatar: string;         // 真人头像 URL
  color: string;          // 主题色 hex (深色，用于文字/边框)
  bgColor: string;        // 浅色背景
  position: string;       // 立场一句话
  style: string;          // 说话风格一句话
  conflictTargets: CharacterId[];
  triggerKeywords: string[];
  defaultTemp: TemperatureConfig;
  systemPrompt: string;
  ragEnabled: boolean;
  typingSpeed: 'fast' | 'medium' | 'slow';

  // 结构化动机与禁忌（显式字段，用于路由评分 + 运行时注入）
  motivation: string;     // 角色核心动机/驱动力（一句话）
  innerConflict?: string; // 内心矛盾（可选，非所有角色都有）
  taboos: string[];       // 硬闸门：绝不能做的事（结构化列表）
}

// 房间氛围模式
export type AtmosphereMode = 'real' | 'rational' | 'mixed';

// 房间消息
export interface RoomMessage {
  id: string;
  role: 'user' | 'character' | 'system';
  characterId?: CharacterId;
  text: string;
  timestamp: string;
}

// 房间套餐类型
export type RoomPlanType = 'hourly' | 'half_day' | 'daily' | 'monthly' | 'yearly' | 'permanent' | 'free';

// 房间
export interface Room {
  id: string;
  name: string;
  createdAt: string;
  lastActiveAt: string;
  characters: CharacterId[];
  characterTemps: Partial<Record<CharacterId, TemperatureConfig>>;
  atmosphere: AtmosphereMode;
  topic: string;
  messages: RoomMessage[];
  isActive: boolean;
  plan?: RoomPlanType;
  expiresAt?: string;       // ISO string, null/undefined = 永久或免费
}

// 话题分类体系
export type TopicMajorCategory =
  | '赌场游戏' | '体育博彩' | '赌城风云'
  | '网赌江湖' | '赌徒心理' | '赌债人生' | '骗局揭秘';

// 冲突场景
export interface ConflictScenario {
  id: string;
  topic: string;
  characters: CharacterId[];
  type: '对峙' | '混战' | '圆桌';
  category?: TopicMajorCategory;   // 显式分类（新场景必填）
  subcategory?: string;            // 子分类标签
  triggerKeywords: string[];
  userEmotionMatch: string[];
  openingLines: Partial<Record<CharacterId, string>>;
  escalation: Array<{
    characterId: CharacterId;
    line: string;
    emotion: string;
  }>;
  resolution?: {
    junshiTrigger: boolean;
    junshiVerdict?: string;
    compromise?: string;
  };
  provocations?: Record<string, string>;
}

// 调温快捷预设
export type TempPreset = 'all_fire' | 'calm' | 'default' | 'max_conflict' | 'tea';

// 角色路由决策
export interface RouterDecision {
  respondingCharacters: CharacterId[];
  scenario: ConflictScenario | null;
  reason: string;
}

// API调用结果
export interface CharacterResponse {
  characterId: CharacterId;
  text: string;
  status: 'fulfilled' | 'rejected';
}

// ============================================================
// 角色评价系统
// ============================================================

// 快捷标签（15个预定义）
export type ReviewTag =
  | '犀利' | '有料' | '搞笑' | '真实' | '暴躁'
  | '话太多' | '话太少' | '接地气' | '毒舌' | '暖心'
  | '无聊' | '吵架王' | '骗子本色' | '理性' | '鸡汤';

// 单条评价
export interface CharacterReview {
  id: string;
  characterId: CharacterId;
  rating: number;           // 1-5星
  text: string;             // 评价文字（可为空）
  tags: ReviewTag[];        // 0-3个标签
  createdAt: string;
  roomTopic?: string;       // 来自哪个话题
  helpfulCount: number;     // "有用"票数
  userMarkedHelpful: boolean;
  isSeed?: boolean;         // 种子评价标记
}

// 聚合评分
export interface CharacterRatingStats {
  averageRating: number;
  totalReviews: number;
  distribution: [number, number, number, number, number]; // 1-5星各几条
  topTags: Array<{ tag: ReviewTag; count: number }>;
}

// ============================================================
// 角色状态系统（实时心理状态）
// ============================================================

export interface CharacterMood {
  energy: number;          // 0-100 活跃度（持续发言会降低）
  irritability: number;    // 0-100 易怒度（被怼/被忽视会升高）
  engagement: number;      // 0-100 参与度（话题相关性驱动）
  confidence: number;      // 0-100 自信度（被支持升高，被反驳降低）
}

export interface CharacterState {
  mood: CharacterMood;
  lastSpokeAt: string | null;    // ISO timestamp
  silentTurns: number;           // 连续未发言轮数
  messageCount: number;          // 本房间总发言数
  currentFocus: string;          // 当前关注话题关键词
  recentTargets: CharacterId[];  // 最近互动的角色（用于关系演化）
}

// ============================================================
// 房间热度系统
// ============================================================

export type HeatLevel = 'cold' | 'warm' | 'hot' | 'boiling';

export interface RoomHeat {
  level: HeatLevel;
  score: number;             // 0-100
  recentMessageCount: number; // 最近5分钟消息数
  conflictScore: number;     // 0-100 冲突强度
  dominantCharacter: CharacterId | null;
  lastActivityAt: string;
}

// ============================================================
// 动态关系图谱
// ============================================================

export interface RelationEdge {
  affinity: number;          // -100 ~ 100 好感
  trust: number;             // 0 ~ 100 信任
  tension: number;           // 0 ~ 100 张力
  recentEvents: string[];    // 最近5条关系事件
  interactionCount: number;  // 互动次数
  lastUpdated: string;
}

// key格式: "aqiang->gailv" 或 "user->aqiang"
export type RelationshipGraph = Record<string, RelationEdge>;

// ============================================================
// 记忆系统
// ============================================================

export type MemoryType = 'impression' | 'conflict' | 'alliance' | 'milestone' | 'joke' | 'stance';

export interface MemoryEntry {
  id: string;
  type: MemoryType;
  content: string;
  importance: number;        // 1-10
  participants: string[];    // 涉及的角色/用户ID
  timestamp: string;
  roomId: string;
}

export interface CharacterMemoryStore {
  // 中期记忆：关系摘要（对每个目标的印象）
  impressions: Record<string, string[]>;  // key: 目标ID, value: 印象列表
  // 长期记忆：剧情节点
  milestones: MemoryEntry[];
  // 所有记忆条目（用于检索）
  entries: MemoryEntry[];
  lastSummarizedAt: string;
  totalMessagesSeen: number;
}

// ============================================================
// 用户意图 & 身份
// ============================================================

export type UserStanceType = 'support' | 'oppose' | 'provoke' | 'mediate' | 'curious' | 'neutral';

export interface UserStance {
  type: UserStanceType;
  targetCharacter?: CharacterId;
  confidence: number;        // 0-1
}

export interface UserIdentity {
  totalMessages: number;
  favoriteCharacter: CharacterId | null;
  identityTags: string[];    // "拱火王" "调停者" "梗王"
  stanceHistory: Array<{ stance: UserStanceType; target?: CharacterId; timestamp: string }>;
  characterRelations: Partial<Record<CharacterId, {
    affinity: number;
    interactionCount: number;
    supportCount: number;
    opposeCount: number;
  }>>;
}

// ============================================================
// 事件引擎
// ============================================================

export type GameEventType =
  | 'alliance'       // 站队结盟
  | 'taunt'          // 调侃嘲讽
  | 'callback'       // 翻旧账
  | 'reveal'         // 爆料
  | 'rescue'         // 冷场救场
  | 'mood_shift'     // 情绪波动
  | 'escalation'     // 争论升级
  | 'user_impact';   // 用户影响力事件

export interface GameEvent {
  id: string;
  type: GameEventType;
  description: string;
  participants: string[];
  effects: EventEffect[];
  triggeredAt: string;
  roomId: string;
}

export interface EventEffect {
  type: 'relation_change' | 'mood_change' | 'force_speak' | 'inject_topic' | 'prompt_inject';
  target: string;
  value: any;
}
