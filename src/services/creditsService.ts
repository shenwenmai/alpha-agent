// ============================================================
// 积分系统 — localStorage 实现
// ============================================================

const CREDITS_KEY = 'roundtable_credits_v1';
const CHECKIN_KEY = 'roundtable_checkin_v1';

// ============================================================
// 类型定义
// ============================================================

export type TransactionType =
  | 'new_user_bonus'    // 新用户注册赠送
  | 'daily_checkin'     // 每日签到
  | 'vote_reward'       // 投票奖励
  | 'create_room'       // 创建房间消费
  | 'invite_human'      // 邀请真人
  | 'junshi_analysis'   // 军师深度分析
  | 'review_reward'     // 评价角色奖励
  | 'purchase';         // 充值购买

export type RoomPlan = 'hourly' | 'half_day' | 'daily' | 'monthly' | 'yearly' | 'permanent';

export interface CreditTransaction {
  id: string;
  amount: number;          // 正数=收入，负数=支出
  type: TransactionType;
  description: string;
  timestamp: string;
}

export interface CreditsData {
  balance: number;
  totalEarned: number;
  totalSpent: number;
  transactions: CreditTransaction[];
  isNewUser: boolean;
}

// ============================================================
// 房间套餐定义
// ============================================================

export const ROOM_PLANS: Record<RoomPlan, { label: string; duration: string; credits: number; perHour: string; desc: string }> = {
  hourly:    { label: '单次',   duration: '1小时',  credits: 20,    perHour: '20',   desc: '试一试' },
  half_day:  { label: '半日卡', duration: '12小时', credits: 150,   perHour: '12.5', desc: '半天泡着聊' },
  daily:     { label: '日卡',   duration: '24小时', credits: 240,   perHour: '10',   desc: '全天挂着聊' },
  monthly:   { label: '月卡',   duration: '30天',   credits: 3000,  perHour: '4.2',  desc: '核心用户' },
  yearly:    { label: '年卡',   duration: '365天',  credits: 20000, perHour: '2.3',  desc: '忠实用户' },
  permanent: { label: '永久',   duration: '无限',   credits: 50000, perHour: '—',    desc: '一次买断' },
};

// ============================================================
// 数据持久化
// ============================================================

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 6);
}

function loadCredits(): CreditsData {
  try {
    const raw = localStorage.getItem(CREDITS_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch { /* ignore */ }

  // 新用户：赠送 100 积分
  const initial: CreditsData = {
    balance: 100,
    totalEarned: 100,
    totalSpent: 0,
    transactions: [{
      id: generateId(),
      amount: 100,
      type: 'new_user_bonus',
      description: '新用户注册赠送',
      timestamp: new Date().toISOString(),
    }],
    isNewUser: true,
  };

  saveCredits(initial);
  return initial;
}

function saveCredits(data: CreditsData): void {
  try {
    // 只保留最近200条交易记录
    if (data.transactions.length > 200) {
      data.transactions = data.transactions.slice(-200);
    }
    localStorage.setItem(CREDITS_KEY, JSON.stringify(data));
  } catch { /* ignore */ }
}

// ============================================================
// Subscribe 模式
// ============================================================

type Listener = () => void;
const listeners: Listener[] = [];

export function subscribeCredits(listener: Listener): () => void {
  listeners.push(listener);
  return () => {
    const idx = listeners.indexOf(listener);
    if (idx > -1) listeners.splice(idx, 1);
  };
}

function notify() {
  listeners.forEach(l => l());
}

// ============================================================
// 积分操作
// ============================================================

export function getCredits(): CreditsData {
  return loadCredits();
}

export function getBalance(): number {
  return loadCredits().balance;
}

export function addCredits(amount: number, type: TransactionType, description: string): CreditsData {
  const data = loadCredits();
  const tx: CreditTransaction = {
    id: generateId(),
    amount,
    type,
    description,
    timestamp: new Date().toISOString(),
  };

  data.balance += amount;
  if (amount > 0) {
    data.totalEarned += amount;
  } else {
    data.totalSpent += Math.abs(amount);
  }
  data.transactions.push(tx);
  data.isNewUser = false;

  saveCredits(data);
  notify();
  return data;
}

export function spendCredits(amount: number, type: TransactionType, description: string): { success: boolean; data: CreditsData } {
  const data = loadCredits();
  if (data.balance < amount) {
    return { success: false, data };
  }

  return {
    success: true,
    data: addCredits(-amount, type, description),
  };
}

// ============================================================
// 每日签到
// ============================================================

interface CheckinData {
  lastDate: string;      // YYYY-MM-DD
  streak: number;        // 连续签到天数
  totalDays: number;     // 累计签到天数
}

function getTodayStr(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function loadCheckin(): CheckinData {
  try {
    const raw = localStorage.getItem(CHECKIN_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { lastDate: '', streak: 0, totalDays: 0 };
}

function saveCheckin(data: CheckinData): void {
  localStorage.setItem(CHECKIN_KEY, JSON.stringify(data));
}

export function canCheckinToday(): boolean {
  const checkin = loadCheckin();
  return checkin.lastDate !== getTodayStr();
}

export function doCheckin(): { credits: number; streak: number; totalDays: number } | null {
  if (!canCheckinToday()) return null;

  const checkin = loadCheckin();
  const today = getTodayStr();

  // 检查连续签到
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;

  if (checkin.lastDate === yesterdayStr) {
    checkin.streak += 1;
  } else {
    checkin.streak = 1;
  }

  checkin.lastDate = today;
  checkin.totalDays += 1;

  // 连续签到奖励：基础5 + 连续天数加成（最高15）
  const bonus = Math.min(checkin.streak, 7);
  const reward = 5 + bonus;

  saveCheckin(checkin);
  addCredits(reward, 'daily_checkin', `每日签到 (连续${checkin.streak}天)`);

  return { credits: reward, streak: checkin.streak, totalDays: checkin.totalDays };
}

export function getCheckinInfo(): CheckinData & { canCheckin: boolean } {
  const checkin = loadCheckin();
  return { ...checkin, canCheckin: canCheckinToday() };
}

// ============================================================
// 投票奖励（每个话题只奖励一次）
// ============================================================

const VOTE_REWARD_KEY = 'roundtable_vote_rewards';

export function grantVoteReward(topicId: string): boolean {
  try {
    const raw = localStorage.getItem(VOTE_REWARD_KEY);
    const rewarded: string[] = raw ? JSON.parse(raw) : [];

    if (rewarded.includes(topicId)) return false;

    rewarded.push(topicId);
    // 只保留最近100个
    if (rewarded.length > 100) rewarded.splice(0, rewarded.length - 100);
    localStorage.setItem(VOTE_REWARD_KEY, JSON.stringify(rewarded));

    addCredits(2, 'vote_reward', '参与话题投票');
    return true;
  } catch {
    return false;
  }
}

// ============================================================
// 房间计费
// ============================================================

export function canAffordRoom(plan: RoomPlan): boolean {
  return getBalance() >= ROOM_PLANS[plan].credits;
}

export function payForRoom(plan: RoomPlan, roomName: string): { success: boolean; data: CreditsData } {
  const planInfo = ROOM_PLANS[plan];
  return spendCredits(
    planInfo.credits,
    'create_room',
    `创建房间「${roomName}」(${planInfo.label} ${planInfo.duration})`,
  );
}

// ============================================================
// 交易记录查询
// ============================================================

export function getRecentTransactions(limit: number = 20): CreditTransaction[] {
  const data = loadCredits();
  return data.transactions.slice(-limit).reverse();
}

export function getTransactionsByType(type: TransactionType): CreditTransaction[] {
  const data = loadCredits();
  return data.transactions.filter(t => t.type === type).reverse();
}
