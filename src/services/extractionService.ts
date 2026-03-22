import { CollapseRecord, FinancialRecord, EmotionScore, TriggerConfig, Commitment, RelationshipEvent, RelationshipContact, UserSettings, UserProfile, QuickCollapseInput, FundDirection, FundSource, Conversation } from '../types/schema';

export type CrisisEvent = {
  event: 'crisis_handoff' | 'crisis_unlock';
  fromRole: string;
  toRole: string;
  sourceMessageId: string;
  timestamp: string;
  crisisLock: boolean;
};

export type PipelineEvent = {
  id: string;
  status: 'pending' | 'saved' | 'failed';
  event_type: string;
  sourceMessageId: string;
  savedAt?: string;
  error?: string;
};

// In-memory store for prototype purposes
// In a real app, this would be a database (SQLite/Postgres)

const STORAGE_KEY = 'realcost_store_v1';

// 待确认财务记录（从对话提取，等用户确认）
export interface PendingFinancial {
  id: string;
  amount: number;
  direction: FundDirection;
  fundSource?: FundSource;
  currency?: string;             // 货币单位（CNY/USD/HKD等），默认CNY
  date: string;
  sourceMessageId: string;
  isDuplicate: boolean;        // 是否为重复引用（静默处理）
  duplicateCount: number;      // 被引用次数（≥2时静默）
  existingRecordId?: string;   // 如果是重复，指向已有记录
  createdAtMsgCount?: number;  // 创建时的消息数，用于10轮后自动消失
}

export const store = {
  collapses: [] as CollapseRecord[],
  financials: [] as FinancialRecord[],
  pendingFinancials: [] as PendingFinancial[],
  emotions: [] as { id: string; intensity: number; labels: string[]; date: string; sourceMessageId?: string; confidence?: number }[],
  evidenceLinks: [] as { sourceMessageId: string; type: string; targetId: string }[],
  triggers: [] as TriggerConfig[],
  commitments: [] as Commitment[],
  relationships: [] as RelationshipEvent[],
  relationshipContacts: [] as RelationshipContact[],
  pushLog: [] as { id: string; title: string; body: string; date: string; type: 'alert' | 'insight' }[],
  needsReview: [] as any[], // Low confidence events
  crisisLog: [] as CrisisEvent[],
  pipelineLog: [] as PipelineEvent[],
  conversations: [] as Conversation[],
  activeConversationId: null as string | null,
  userProfile: null as UserProfile | null,
  userSettings: {
    hourlyWage: 0,
    dailyWage: 0,
    currency: 'CNY',
    opportunityYears: 0,
    opportunityRate: 0,
    shareScope: 'private' as const,
    livingFundBudget: 0,
    soberStartDate: new Date().toISOString(),
    lastCheckinDate: '',
    checkinStreak: 0,
  }
};

// Initialize store from localStorage
try {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    const parsed = JSON.parse(saved);
    store.collapses = parsed.collapses || [];
    store.financials = parsed.financials || [];
    store.pendingFinancials = parsed.pendingFinancials || [];
    store.emotions = parsed.emotions || [];
    store.evidenceLinks = parsed.evidenceLinks || [];
    store.triggers = parsed.triggers || [];
    store.commitments = parsed.commitments || [];
    store.relationships = parsed.relationships || [];
    store.relationshipContacts = parsed.relationshipContacts || [];
    store.pushLog = parsed.pushLog || [];
    store.needsReview = parsed.needsReview || [];
    store.crisisLog = parsed.crisisLog || [];
    store.pipelineLog = parsed.pipelineLog || [];
    store.conversations = parsed.conversations || [];
    store.activeConversationId = parsed.activeConversationId || null;
    store.userProfile = parsed.userProfile || null;
    store.userSettings = { ...store.userSettings, ...(parsed.userSettings || {}) };

    // --- V2 数据迁移 ---
    migrateToV2();
    // --- V3: 单对话 → 多对话迁移 ---
    migrateToV3();
  }
} catch (e) {
  console.error('Failed to load store from localStorage', e);
}

// 首次启动也需要检查迁移（store 为空但 chat_history 存在的情况）
if (store.conversations.length === 0) {
  migrateToV3();
}

/** 迁移旧数据到 V2 schema */
function migrateToV2() {
  let dirty = false;

  // 1. Commitment: 添加新字段默认值
  store.commitments.forEach((c: any) => {
    if (c.triggerWhen === undefined) {
      c.triggerWhen = '';
      c.actionFirst = '';
      c.timeWindow = '';
      c.avoidAction = '';
      c.isPinned = false;
      c.consecutiveDays = 0;
      c.is72hProtection = false;
      dirty = true;
    }
  });

  // 2. CollapseRecord: 添加链路字段
  store.collapses.forEach((c: any) => {
    if (c.triggerScene === undefined) {
      c.triggerScene = c.trigger || '';
      c.thought = '';
      c.interceptionPoint = '';
      c.hotTags = [];
      dirty = true;
    }
  });

  // 3. FinancialRecord: 旧 category/transactionType → 新 direction/fundSource
  store.financials.forEach((f: any) => {
    if (f.direction === undefined) {
      if (f.category === 'saved' || f.transactionType === '提现') {
        f.direction = '回收';
      } else {
        f.direction = '投入';
        if (f.transactionType === '借贷') {
          f.fundSource = '借贷';
        } else {
          f.fundSource = '闲钱';
        }
      }
      dirty = true;
    }
  });

  // 4. UserSettings: 添加新字段默认值
  if ((store.userSettings as any).dailyWage === undefined) {
    (store.userSettings as any).dailyWage = 0;
    dirty = true;
  }
  if ((store.userSettings as any).livingFundBudget === undefined) {
    (store.userSettings as any).livingFundBudget = 0;
    dirty = true;
  }

  // 5. RiskLevel: high/medium/low → L1-L4
  if (store.userProfile) {
    const rl = store.userProfile.riskLevel as any;
    if (rl === 'high') { store.userProfile.riskLevel = 'L4'; dirty = true; }
    else if (rl === 'medium') { store.userProfile.riskLevel = 'L2'; dirty = true; }
    else if (rl === 'low') { store.userProfile.riskLevel = 'L1'; dirty = true; }
  }

  // 4. RelationshipEvent → RelationshipContact 迁移
  if (store.relationships.length > 0 && store.relationshipContacts.length === 0) {
    const contactMap = new Map<string, RelationshipContact>();
    store.relationships.forEach(r => {
      if (!contactMap.has(r.person)) {
        const trust = Math.max(0, Math.min(100, 50 + (r.trustImpact || 0)));
        contactMap.set(r.person, {
          id: generateId(),
          person: r.person,
          tier: trust >= 60 ? 'stable_support' : trust >= 30 ? 'neutral' : 'high_risk',
          contactPriority: 3,
          topicsToAvoid: [],
          isCrisisContact: false,
          trustScore: trust,
          events: [],
        });
      }
      const contact = contactMap.get(r.person)!;
      contact.events.push({
        id: r.id || generateId(),
        event: r.event,
        trustImpact: r.trustImpact,
        date: r.date,
        sourceMessageId: r.sourceMessageId,
        confidence: r.confidence,
      });
      // 重新算信任分
      const totalImpact = contact.events.reduce((s, e) => s + e.trustImpact, 0);
      contact.trustScore = Math.max(0, Math.min(100, 50 + totalImpact));
      contact.tier = contact.trustScore >= 60 ? 'stable_support' : contact.trustScore >= 30 ? 'neutral' : 'high_risk';
    });
    store.relationshipContacts = Array.from(contactMap.values());
    dirty = true;
  }

  if (dirty) saveStore();
}

/** 迁移旧单一对话到多对话系统 */
function migrateToV3() {
  if (store.conversations.length > 0) return; // 已迁移
  const savedChat = localStorage.getItem('chat_history');
  if (!savedChat) return;
  try {
    const messages = JSON.parse(savedChat);
    if (!Array.isArray(messages) || messages.length === 0) return;
    const firstUserMsg = messages.find((m: any) => m.role === 'user');
    const lastMsg = messages[messages.length - 1];
    const conv: Conversation = {
      id: generateId(),
      title: firstUserMsg
        ? firstUserMsg.text.slice(0, 20) + (firstUserMsg.text.length > 20 ? '...' : '')
        : '旧对话',
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
      messages,
      role: 'b',
      preview: lastMsg ? lastMsg.text.slice(0, 40) : '',
    };
    store.conversations.push(conv);
    store.activeConversationId = conv.id;
    saveStore();
    localStorage.removeItem('chat_history');
    console.log('[migrateToV3] Migrated chat_history → conversation', conv.id);
  } catch (e) {
    console.error('[migrateToV3] Failed', e);
  }
}

function saveStore() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch (e) {
    console.error('Failed to save store to localStorage', e);
  }
}

// --- Currency Helper ---
// CURRENCY_SYMBOLS removed — 不再显示货币符号

export function getCurrencySymbol(_currency?: string): string {
  // 不再返回货币符号，仅保留函数签名以兼容调用方
  return '';
}

// --- Helper Functions ---

function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

function resolveTime(raw: string, now = new Date()): string {
  if (!raw) return now.toISOString();
  
  const lowerRaw = raw.toLowerCase();
  const d = new Date(now);

  if (lowerRaw.includes('昨晚') || lowerRaw.includes('yesterday')) {
    d.setDate(d.getDate() - 1);
    d.setHours(22, 0, 0, 0);
    return d.toISOString();
  }
  if (lowerRaw.includes('今天') || lowerRaw.includes('today')) {
    return now.toISOString();
  }
  if (lowerRaw.includes('上周五')) {
    // Simple logic for "last Friday"
    const day = d.getDay();
    const diff = (day < 5) ? (7 - 5 + day) : (day - 5);
    d.setDate(d.getDate() - diff - 7); 
    d.setHours(20, 0, 0, 0);
    return d.toISOString();
  }
  
  // Default fallback
  return now.toISOString();
}

// --- Subscription System ---

type Listener = () => void;
const listeners: Listener[] = [];

export function subscribe(listener: Listener): () => void {
  listeners.push(listener);
  return () => {
    const index = listeners.indexOf(listener);
    if (index > -1) listeners.splice(index, 1);
  };
}

function notifyListeners() {
  listeners.forEach(l => l());
}

// --- Conversation Management ---

export function createConversation(role: 'b' | 's' = 'b'): Conversation {
  const hasData = store.emotions.length > 0 || store.collapses.length > 0 || store.financials.length > 0;
  const greeting = hasData
    ? '嗯。我在。上次聊的那些我都记着。'
    : '嗯。我在。今天想从哪句开始？';
  const conv: Conversation = {
    id: generateId(),
    title: '新对话',
    createdAt: new Date().toISOString(),
    lastActiveAt: new Date().toISOString(),
    messages: [{ id: '1', role: 'assistant', text: greeting }],
    role,
    preview: greeting.slice(0, 40),
  };
  store.conversations.unshift(conv);
  store.activeConversationId = conv.id;
  saveStore();
  notifyListeners();
  return conv;
}

export function getActiveConversation(): Conversation | null {
  if (!store.activeConversationId) return null;
  return store.conversations.find(c => c.id === store.activeConversationId) || null;
}

export function setActiveConversation(id: string) {
  store.activeConversationId = id;
  saveStore();
  notifyListeners();
}

export function updateConversationMessages(id: string, messages: Array<{ id: string; role: 'user' | 'assistant'; text: string }>) {
  const conv = store.conversations.find(c => c.id === id);
  if (!conv) return;
  // 避免无变化时重复保存
  if (conv.messages.length === messages.length && conv.messages[conv.messages.length - 1]?.id === messages[messages.length - 1]?.id) return;
  conv.messages = messages;
  conv.lastActiveAt = new Date().toISOString();
  // 自动标题：取第一条用户消息
  const firstUserMsg = messages.find(m => m.role === 'user');
  if (firstUserMsg && conv.title === '新对话') {
    conv.title = firstUserMsg.text.slice(0, 20) + (firstUserMsg.text.length > 20 ? '...' : '');
  }
  // 更新预览
  const lastMsg = messages[messages.length - 1];
  if (lastMsg) {
    conv.preview = lastMsg.text.slice(0, 40) + (lastMsg.text.length > 40 ? '...' : '');
  }
  saveStore();
  // 不触发 notifyListeners 避免循环（ChatScreen 自己管理 messages state）
}

export function updateConversationRole(id: string, role: 'b' | 's') {
  const conv = store.conversations.find(c => c.id === id);
  if (!conv) return;
  conv.role = role;
  saveStore();
}

export function deleteConversation(id: string) {
  const idx = store.conversations.findIndex(c => c.id === id);
  if (idx === -1) return;
  store.conversations.splice(idx, 1);
  if (store.activeConversationId === id) {
    store.activeConversationId = store.conversations[0]?.id || null;
  }
  saveStore();
  notifyListeners();
}

export function getConversationsByDate(): { today: Conversation[]; yesterday: Conversation[]; earlier: Conversation[] } {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterdayStart = todayStart - 86400000;
  const sorted = [...store.conversations].sort(
    (a, b) => new Date(b.lastActiveAt).getTime() - new Date(a.lastActiveAt).getTime()
  );
  return {
    today: sorted.filter(c => new Date(c.lastActiveAt).getTime() >= todayStart),
    yesterday: sorted.filter(c => {
      const t = new Date(c.lastActiveAt).getTime();
      return t >= yesterdayStart && t < todayStart;
    }),
    earlier: sorted.filter(c => new Date(c.lastActiveAt).getTime() < yesterdayStart),
  };
}

// --- Metrics Getters ---

export function getAccountMetrics() {
  const now = new Date();
  const currency = store.userSettings.currency || 'CNY';
  const dashboard = getFinancialDashboard();

  // Clean Days — 距最近一次崩塌，或从戒赌起始日算起
  const sortedCollapses = [...store.collapses]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const lastCollapse = sortedCollapses[0];

  let cleanDays = 0;
  if (lastCollapse) {
    const diffTime = Math.abs(now.getTime() - new Date(lastCollapse.date).getTime());
    cleanDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  } else if (store.userSettings.soberStartDate) {
    const diffTime = Math.abs(now.getTime() - new Date(store.userSettings.soberStartDate).getTime());
    cleanDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  // Life Hours Lost
  const hourlyWage = store.userSettings.hourlyWage || 1;
  const lifeHoursLost = parseFloat((dashboard.netLoss / hourlyWage).toFixed(1));

  // Opportunity Cost
  const { opportunityYears: years, opportunityRate: rate } = store.userSettings;
  const opportunityCostEstimate = Math.round(dashboard.netLoss * (Math.pow(1 + rate, years) - 1));

  return {
    totalLoss: dashboard.netLoss,
    cleanDays,
    lifeHoursLost,
    opportunityCostEstimate,
    currency,
  };
}

// --- 每日签到 ---
export function dailyCheckin(): { streak: number; isNew: boolean } {
  const today = new Date().toISOString().slice(0, 10);
  const last = store.userSettings.lastCheckinDate;

  if (last === today) {
    return { streak: store.userSettings.checkinStreak, isNew: false };
  }

  // 判断是否连续（昨天签过）
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const isConsecutive = last === yesterday;

  store.userSettings.lastCheckinDate = today;
  store.userSettings.checkinStreak = isConsecutive ? store.userSettings.checkinStreak + 1 : 1;
  saveStore();

  return { streak: store.userSettings.checkinStreak, isNew: true };
}

// --- Trigger Management ---

export function addTrigger(trigger: Omit<TriggerConfig, 'id'>) {
  const newTrigger: TriggerConfig = {
    ...trigger,
    id: generateId(),
  };
  store.triggers.push(newTrigger);
  saveStore();
  notifyListeners();
  return newTrigger;
}

export function toggleTrigger(id: string) {
  const trigger = store.triggers.find(t => t.id === id);
  if (trigger) {
    trigger.isActive = !trigger.isActive;
    saveStore();
    notifyListeners();
  }
}

export function deleteTrigger(id: string) {
  const index = store.triggers.findIndex(t => t.id === id);
  if (index > -1) {
    store.triggers.splice(index, 1);
    saveStore();
    notifyListeners();
  }
}

// --- Push Notification Simulation ---

export function logPush(title: string, body: string, type: 'alert' | 'insight' = 'alert') {
  store.pushLog.unshift({
    id: generateId(),
    title,
    body,
    date: new Date().toISOString(),
    type
  });
  // Keep log size manageable
  if (store.pushLog.length > 50) store.pushLog.pop();
  
  saveStore();
  notifyListeners();
}

// --- Crisis Event Logging ---

export function logCrisisEvent(entry: CrisisEvent) {
  store.crisisLog.push(entry);
  if (store.crisisLog.length > 100) store.crisisLog.shift();
  saveStore();
  notifyListeners();
}

export function updateSettings(settings: Partial<typeof store.userSettings>) {
  store.userSettings = { ...store.userSettings, ...settings };
  saveStore();
  notifyListeners();
}

// --- Trigger Monitoring ---

export function checkTriggers(text: string) {
  const activeTriggers = store.triggers.filter(t => t.isActive);
  
  activeTriggers.forEach(trigger => {
    // Simple keyword matching for prototype
    if (trigger.type === 'location' && text.includes(trigger.condition)) {
      logPush(
        `[地点围栏] ${trigger.name}`,
        `检测到你可能在 ${trigger.condition} 附近。请立即离开。`,
        'alert'
      );
    }
    
    // Time trigger simulation (if text mentions time)
    if (trigger.type === 'time' && (text.includes('深夜') || text.includes('现在'))) {
       // This is a loose simulation
       // In real app, we check current time vs trigger.condition
       
       // Parse condition "22:00-04:00"
       // For prototype, just assume it matches if user says "late night"
       if (text.includes('深夜')) {
         logPush(
          `[时间围栏] ${trigger.name}`,
          `现在是高危时段 (${trigger.condition})。系统已提高防护等级。`,
          'alert'
         );
       }
    }
  });
}

// ============================================================
// 承诺管理
// ============================================================

export function addCommitment(c: {
  triggerWhen: string; actionFirst: string; timeWindow: string; avoidAction: string;
  triggerContext?: string; is72hProtection?: boolean;
}): Commitment {
  const commitment: Commitment = {
    id: generateId(),
    triggerWhen: c.triggerWhen,
    actionFirst: c.actionFirst,
    timeWindow: c.timeWindow,
    avoidAction: c.avoidAction,
    content: `当我${c.triggerWhen}时，我先${c.actionFirst}，并在${c.timeWindow}前不${c.avoidAction}`,
    createdAt: new Date().toISOString(),
    triggerContext: c.triggerContext || '',
    isActive: true,
    isPinned: false,
    consecutiveDays: 0,
    is72hProtection: c.is72hProtection || false,
    expiresAt: c.is72hProtection ? new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString() : undefined,
  };
  store.commitments.unshift(commitment);
  saveStore();
  notifyListeners();
  return commitment;
}

export function togglePinCommitment(id: string) {
  const c = store.commitments.find(x => x.id === id);
  if (!c) return;
  if (!c.isPinned) {
    const pinnedCount = store.commitments.filter(x => x.isPinned).length;
    if (pinnedCount >= 3) return; // 最多3条
  }
  c.isPinned = !c.isPinned;
  saveStore();
  notifyListeners();
}

export function executeCommitment(id: string) {
  const c = store.commitments.find(x => x.id === id);
  if (!c) return;
  const now = new Date();
  const lastDate = c.lastExecutedAt ? new Date(c.lastExecutedAt).toDateString() : null;
  const today = now.toDateString();
  if (lastDate === today) return; // 今天已执行
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000).toDateString();
  c.consecutiveDays = lastDate === yesterday ? c.consecutiveDays + 1 : 1;
  c.lastExecutedAt = now.toISOString();
  saveStore();
  notifyListeners();
}

export function create72hProtection(): Commitment {
  return addCommitment({
    triggerWhen: '想打开赌博应用',
    actionFirst: '关闭手机离开当前环境',
    timeWindow: '72小时',
    avoidAction: '接触任何赌博相关内容',
    triggerContext: '72小时保护模式',
    is72hProtection: true,
  });
}

export function deleteCommitment(id: string) {
  const idx = store.commitments.findIndex(c => c.id === id);
  if (idx > -1) { store.commitments.splice(idx, 1); saveStore(); notifyListeners(); }
}

// ============================================================
// 崩塌快速记录
// ============================================================

export function quickRecordCollapse(input: QuickCollapseInput): CollapseRecord {
  const record: CollapseRecord = {
    id: generateId(),
    date: new Date().toISOString(),
    triggerScene: input.triggerScene,
    thought: input.thought,
    behavior: input.behavior,
    consequence: input.consequence,
    interceptionPoint: '',
    trigger: input.triggerScene,
    hotTags: input.hotTags,
    reusableAction: undefined,
    emotionBefore: 8 as EmotionScore,
    emotionAfter: 3 as EmotionScore,
    evidenceQuote: input.freeNote || '',
    status: 'confirmed',
  };
  store.collapses.push(record);
  saveStore();
  notifyListeners();
  return record;
}

export function getWeeklyCollapseAnalytics() {
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const recent = store.collapses.filter(c => new Date(c.date) > weekAgo);

  const tagCounts = new Map<string, number>();
  recent.forEach(c => {
    (c.hotTags || []).forEach(t => tagCounts.set(t, (tagCounts.get(t) || 0) + 1));
  });

  const highRiskPeriods: string[] = [];
  const lateNight = recent.filter(c => {
    const h = new Date(c.date).getHours();
    return h >= 22 || h < 4;
  });
  if (lateNight.length > 0) highRiskPeriods.push(`深夜(${lateNight.length})`);

  const triggerCounts = new Map<string, number>();
  recent.forEach(c => {
    const t = c.triggerScene || c.trigger || '未知';
    triggerCounts.set(t, (triggerCounts.get(t) || 0) + 1);
  });

  return {
    frequency: recent.length,
    highRiskPeriods,
    commonTriggers: Array.from(triggerCounts.entries())
      .sort((a, b) => b[1] - a[1]).slice(0, 3).map(([t]) => t),
  };
}

export function getReusableInterceptionActions(): string[] {
  const actions = store.collapses
    .map(c => c.reusableAction)
    .filter((a): a is string => !!a);
  const counts = new Map<string, number>();
  actions.forEach(a => counts.set(a, (counts.get(a) || 0) + 1));
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([a]) => a);
}

// ============================================================
// 关系档案管理
// ============================================================

export function upsertRelationshipContact(partial: Partial<RelationshipContact> & { person: string }): RelationshipContact {
  let contact = store.relationshipContacts.find(c => c.person === partial.person);
  if (contact) {
    Object.assign(contact, partial);
  } else {
    contact = {
      id: generateId(),
      person: partial.person,
      tier: partial.tier || 'neutral',
      contactPriority: partial.contactPriority || 3,
      topicsToAvoid: partial.topicsToAvoid || [],
      isCrisisContact: partial.isCrisisContact || false,
      trustScore: partial.trustScore || 50,
      events: partial.events || [],
      ...partial,
    } as RelationshipContact;
    store.relationshipContacts.push(contact);
  }
  saveStore();
  notifyListeners();
  return contact;
}

export function getCrisisContacts(): RelationshipContact[] {
  return store.relationshipContacts
    .filter(c => c.isCrisisContact)
    .sort((a, b) => a.contactPriority - b.contactPriority)
    .slice(0, 2);
}

export function deleteRelationshipContact(id: string) {
  const idx = store.relationshipContacts.findIndex(c => c.id === id);
  if (idx > -1) { store.relationshipContacts.splice(idx, 1); saveStore(); notifyListeners(); }
}

// ============================================================
// 财务仪表盘 — 会计逻辑
// 核心三问：亏了多少？钱从哪来？家底还剩多少？
// ============================================================

export interface FinancialDashboard {
  totalIn: number;           // 总投入
  totalOut: number;          // 总回收
  netLoss: number;           // 净亏损 = 总投入 - 总回收
  // 资金来源分布
  sourceIdle: number;        // 闲钱投入
  sourceBorrow: number;      // 借贷投入
  sourceLiving: number;      // 生活金投入
  // 家底
  livingFundBudget: number;  // 生活金额度
  livingFundUsed: number;    // 已动用生活金
  livingFundRemain: number;  // 生活金余额
  livingFundPercent: number; // 已动用百分比
  debtTotal: number;         // 未还欠债 = 借贷投入总额
  // 风险信号
  hasBorrowing: boolean;     // 有借贷投入
  hasLivingFundUsed: boolean;// 有生活金动用
  // 换算
  lossAsDays: number;        // 净亏损折合X天工资
  dailyWage: number;         // 日薪设置
}

export function getFinancialDashboard(): FinancialDashboard {
  const confirmed = store.financials.filter(f =>
    f.status === 'confirmed' || f.status === 'needs_review'
  );

  // 总投入 / 总回收
  const inRecords = confirmed.filter(f => f.direction === '投入');
  const outRecords = confirmed.filter(f => f.direction === '回收');
  const totalIn = inRecords.reduce((s, f) => s + f.amount, 0);
  const totalOut = outRecords.reduce((s, f) => s + f.amount, 0);
  const netLoss = totalIn - totalOut; // 正数=亏损

  // 资金来源分布
  const sourceIdle = inRecords.filter(f => f.fundSource === '闲钱' || !f.fundSource).reduce((s, f) => s + f.amount, 0);
  const sourceBorrow = inRecords.filter(f => f.fundSource === '借贷').reduce((s, f) => s + f.amount, 0);
  const sourceLiving = inRecords.filter(f => f.fundSource === '生活金').reduce((s, f) => s + f.amount, 0);

  // 生活金
  const budget = store.userSettings.livingFundBudget || 0;
  const remain = Math.max(0, budget - sourceLiving);
  const usedPercent = budget > 0 ? Math.round((sourceLiving / budget) * 100) : 0;

  // 换算
  const dailyWage = store.userSettings.dailyWage || 0;
  const lossAsDays = dailyWage > 0 ? Math.round(netLoss / dailyWage) : 0;

  return {
    totalIn,
    totalOut,
    netLoss,
    sourceIdle,
    sourceBorrow,
    sourceLiving,
    livingFundBudget: budget,
    livingFundUsed: sourceLiving,
    livingFundRemain: remain,
    livingFundPercent: usedPercent,
    debtTotal: sourceBorrow,
    hasBorrowing: sourceBorrow > 0,
    hasLivingFundUsed: sourceLiving > 0,
    lossAsDays,
    dailyWage,
  };
}

export function checkFinancialThresholds(): { shouldPause: boolean; reason: string } | null {
  const d = getFinancialDashboard();
  // L4: 借贷投入
  if (d.hasBorrowing) {
    return { shouldPause: true, reason: '检测到借贷资金投入赌博，建议立即停止' };
  }
  // L3: 动用生活金
  if (d.hasLivingFundUsed) {
    return { shouldPause: true, reason: '你正在动用生活金，这笔钱不该碰' };
  }
  // L3: 生活金动用超过50%
  if (d.livingFundPercent > 50) {
    return { shouldPause: true, reason: '生活金已动用超过一半，必须立即止损' };
  }
  return null;
}

export function quickRecordFinancial(
  amount: number,
  direction: FundDirection,
  fundSource?: FundSource
) {
  const record: FinancialRecord = {
    id: generateId(),
    amount: Math.abs(amount),
    date: new Date().toISOString(),
    direction,
    fundSource: direction === '投入' ? (fundSource || '闲钱') : undefined,
    currency: store.userSettings.currency || 'CNY',
    sourceMessageId: 'manual_entry',
    confidence: 1,
    status: 'confirmed',
  };
  store.financials.push(record);
  saveStore();
  notifyListeners();
  return record;
}

export function setLivingFundBudget(amount: number) {
  store.userSettings.livingFundBudget = Math.max(0, amount);
  saveStore();
  notifyListeners();
}

// ============================================================
// 防重 + 待确认队列 + 编辑/删除
// ============================================================

/**
 * 查找24h内的重复记录（同金额+同方向+同来源）
 */
export function findRecentDuplicate(
  amount: number, direction: FundDirection, fundSource?: FundSource, currency?: string
): FinancialRecord | null {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  const cur = currency || store.userSettings.currency || 'CNY';
  return store.financials.find(f =>
    f.amount === amount &&
    f.direction === direction &&
    (f.currency || 'CNY') === cur &&
    (direction === '回收' || f.fundSource === (fundSource || '闲钱')) &&
    new Date(f.date).getTime() > cutoff &&
    (f.status === 'confirmed' || f.status === 'needs_review')
  ) || null;
}

/**
 * AI提取金额后调用 — 先检查重复，再决定弹卡片还是静默
 * 返回: 'new_pending' | 'duplicate_silent' | 'duplicate_remind'
 */
export function addPendingFinancial(
  amount: number, direction: FundDirection, sourceMessageId: string, currency?: string
): { action: 'new_pending' | 'duplicate_remind' | 'duplicate_silent'; pending?: PendingFinancial; existingRecord?: FinancialRecord } {
  const cur = currency || store.userSettings.currency || 'CNY';

  // 先检查是否已有同金额+同方向+同币种的待确认卡片（防止重复弹卡）
  const existingPending = store.pendingFinancials.find(p =>
    p.amount === amount &&
    p.direction === direction &&
    (p.currency || 'CNY') === cur &&
    !p.isDuplicate
  );
  if (existingPending) {
    console.log(`[ToolCall] addPendingFinancial → already pending (id=${existingPending.id})`);
    return { action: 'duplicate_silent' };
  }

  const existing = findRecentDuplicate(amount, direction, undefined, cur);

  if (existing) {
    // 查找是否已经有针对这条记录的pending（用于计数）
    const prevPending = store.pendingFinancials.find(p =>
      p.existingRecordId === existing.id
    );
    if (prevPending) {
      prevPending.duplicateCount++;
      saveStore();
      // 第3次及以后完全静默
      return { action: 'duplicate_silent', existingRecord: existing };
    }
    // 第2次引用 — 提示"早前已记录"
    const activeConv = store.conversations.find(c => c.id === store.activeConversationId);
    const pending: PendingFinancial = {
      id: generateId(),
      amount, direction, currency: cur, date: new Date().toISOString(),
      sourceMessageId, isDuplicate: true, duplicateCount: 1,
      existingRecordId: existing.id,
      createdAtMsgCount: activeConv?.messages.length || 0,
    };
    store.pendingFinancials.push(pending);
    saveStore();
    notifyListeners();
    return { action: 'duplicate_remind', pending, existingRecord: existing };
  }

  // 全新事件 — 弹完整确认卡
  const activeConv = store.conversations.find(c => c.id === store.activeConversationId);
  const pending: PendingFinancial = {
    id: generateId(),
    amount, direction, currency: cur, date: new Date().toISOString(),
    sourceMessageId, isDuplicate: false, duplicateCount: 0,
    createdAtMsgCount: activeConv?.messages.length || 0,
  };
  store.pendingFinancials.push(pending);
  saveStore();
  notifyListeners();
  return { action: 'new_pending', pending };
}

/**
 * 用户确认待确认记录 → 写入正式账本
 */
export function confirmPendingFinancial(pendingId: string, fundSource?: FundSource) {
  const idx = store.pendingFinancials.findIndex(p => p.id === pendingId);
  if (idx === -1) return;
  const pending = store.pendingFinancials[idx];

  const record: FinancialRecord = {
    id: generateId(),
    amount: pending.amount,
    date: pending.date,
    direction: pending.direction,
    fundSource: pending.direction === '投入' ? (fundSource || '闲钱') : undefined,
    currency: pending.currency || store.userSettings.currency || 'CNY',
    sourceMessageId: pending.sourceMessageId,
    confidence: 1,
    status: 'confirmed',
  };
  store.financials.push(record);
  store.pendingFinancials.splice(idx, 1);
  saveStore();
  notifyListeners();
  return record;
}

/**
 * 用户忽略待确认记录
 */
export function dismissPendingFinancial(pendingId: string) {
  const idx = store.pendingFinancials.findIndex(p => p.id === pendingId);
  if (idx > -1) {
    store.pendingFinancials.splice(idx, 1);
    saveStore();
    notifyListeners();
  }
}

/**
 * 删除已有财务记录
 */
export function deleteFinancialRecord(id: string) {
  const idx = store.financials.findIndex(f => f.id === id);
  if (idx > -1) {
    store.financials.splice(idx, 1);
    saveStore();
    notifyListeners();
  }
}

/**
 * 编辑已有财务记录
 */
export function editFinancialRecord(id: string, updates: {
  amount?: number; direction?: FundDirection; fundSource?: FundSource;
}) {
  const record = store.financials.find(f => f.id === id);
  if (!record) return;
  if (updates.amount !== undefined) record.amount = updates.amount;
  if (updates.direction !== undefined) record.direction = updates.direction;
  if (updates.fundSource !== undefined) record.fundSource = updates.fundSource;
  saveStore();
  notifyListeners();
}

/**
 * 获取未处理的待确认记录（非重复的）
 * 同时自动清理超过10轮对话（≈20条消息）的过期卡片
 */
export function getActivePendingFinancials(): PendingFinancial[] {
  const activeConv = store.conversations.find(c => c.id === store.activeConversationId);
  const currentMsgCount = activeConv?.messages.length || 0;
  const AUTO_DISMISS_THRESHOLD = 20; // 10轮对话 ≈ 20条消息（用户+AI各10条）

  // 静默清理过期的待确认卡片（包括重复提醒）
  const beforeLen = store.pendingFinancials.length;
  store.pendingFinancials = store.pendingFinancials.filter(p => {
    if (p.createdAtMsgCount === undefined) return false; // 旧数据无此字段，直接清理
    return currentMsgCount - p.createdAtMsgCount <= AUTO_DISMISS_THRESHOLD;
  });
  if (store.pendingFinancials.length < beforeLen) {
    console.log(`[AutoDismiss] Cleaned ${beforeLen - store.pendingFinancials.length} expired pending financial(s)`);
    saveStore(); // 静默保存，不触发 notifyListeners 避免循环
  }

  return store.pendingFinancials.filter(p => !p.isDuplicate);
}

// --- Action Handlers ---

import { logExtraction, updateBacklog } from './monitoring';

// ... (imports)

export async function handleToolCall(name: string, args: any): Promise<any> {
  console.log(`[ToolCall] ${name}`, args);

  // Confidence Check
  const confidence = args.confidence || 0;
  let status: 'confirmed' | 'needs_review' | 'dropped' = 'confirmed';

  if (confidence < 0.6) {
    status = 'dropped';
    console.log(`[ToolCall] Dropped due to low confidence: ${confidence}`);
    logExtraction(false); // Log failure (dropped)
    return { status: 'dropped', reason: 'low_confidence' };
  } else if (confidence < 0.8) {
    status = 'needs_review';
  }

  const needsReview = status === 'needs_review';
  
  // Update backlog metric if needs review
  if (needsReview) {
     updateBacklog(store.needsReview.length + 1);
  }
  
  // Log successful extraction (confirmed or needs_review are considered "extracted")
  logExtraction(true);

  const occurredAt = resolveTime(args.occurredAt);

  function persist(result: any, record?: any) {
    if (needsReview && record) {
      store.needsReview.push({ ...record, toolName: name, reviewedAt: null });
    }
    saveStore();
    notifyListeners();
    return result;
  }

  switch (name) {
    case 'recordCollapseEvent': {
      const record: CollapseRecord = {
        id: generateId(),
        date: occurredAt,
        trigger: args.trigger || 'unknown',
        triggerScene: args.triggerScene || args.trigger || 'unknown',
        thought: args.thought || '',
        behavior: args.behavior || 'unknown',
        consequence: args.consequence || 'unknown',
        interceptionPoint: args.interceptionPoint || '',
        hotTags: args.hotTags || [],
        emotionBefore: 5,
        emotionAfter: 1,
        evidenceQuote: `Source: ${args.sourceMessageId}`,
        sourceMessageId: args.sourceMessageId,
        confidence: confidence,
        status: status
      };
      store.collapses.push(record);

      // NOTE: 不再在 collapse 里自动创建 FinancialRecord
      // 由 AI 单独调用 recordFinancialRecord，避免重复计数

      return persist({ status: 'success', id: record.id, needsReview }, record);
    }

    case 'recordFinancialRecord': {
      const amt = Math.abs(args.amount);

      // 拦截 amount=0 — AI 在没有具体金额时不应调用此工具
      if (!amt || amt === 0) {
        console.warn(`[ToolCall] recordFinancialRecord → BLOCKED (amount=0)`);
        return { status: 'skipped', reason: 'amount_is_zero' };
      }

      const dir: FundDirection = args.direction || (args.category === 'saved' ? '回收' : '投入');
      const cur = args.currency || store.userSettings.currency || 'CNY';

      // 走待确认队列 — 用户在聊天中确认后才写入正式账本
      const result = addPendingFinancial(amt, dir, args.sourceMessageId, cur);
      console.log(`[ToolCall] recordFinancialRecord → ${result.action} (amt=${amt}, dir=${dir}, cur=${cur})`);

      return persist({
        status: 'success',
        action: result.action,
        pendingId: result.pending?.id,
        needsReview,
      }, null);
    }

    case 'upsertEmotionLog': {
      const labels: string[] = args.labels || [];
      const intensity: number = args.intensity;

      // 情绪去重：5分钟内相同标签+相似强度(±2)不重复记录
      const EMOTION_DEDUP_MS = 5 * 60 * 1000;
      const recentEmotion = [...store.emotions].reverse().find(e => {
        const elapsed = Date.now() - new Date(e.date).getTime();
        if (elapsed > EMOTION_DEDUP_MS) return false;
        const prevLabels: string[] = e.labels || [];
        const sameLabels = labels.length === prevLabels.length &&
          labels.every(l => prevLabels.includes(l));
        const similarIntensity = Math.abs((e.intensity || 0) - intensity) <= 2;
        return sameLabels && similarIntensity;
      });
      if (recentEmotion) {
        console.log(`[ToolCall] upsertEmotionLog → DEDUP (same labels+intensity within 5min)`);
        return persist({ status: 'skipped', reason: 'emotion_duplicate' }, null);
      }

      const record = {
        id: generateId(),
        intensity,
        labels,
        date: occurredAt,
        sourceMessageId: args.sourceMessageId,
        confidence: confidence
      };
      store.emotions.push(record);
      return persist({ status: 'success', id: record.id, needsReview }, record);
    }

    case 'linkEvidence': {
      store.evidenceLinks.push({
        sourceMessageId: args.sourceMessageId,
        type: args.type,
        targetId: args.targetId
      });
      return persist({ status: 'success' }, null);
    }

    default:
      return { status: 'error', message: 'Unknown tool' };
  }
}
