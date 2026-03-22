import { SEED_SCENARIOS } from '../data/scenarios';
import type { ConflictScenario, TopicMajorCategory } from '../types/room';

// ============================================================
// 话题分类体系 v2 — 7大类 + 子分类 + 用户自建话题
// ============================================================

// 大分类定义（带emoji + 子分类）
export interface CategoryDef {
  key: TopicMajorCategory;
  emoji: string;
  label: string;
  subcategories: string[];
  keywords: string[];  // 用于自动归类旧场景
}

export const CATEGORY_DEFS: CategoryDef[] = [
  {
    key: '赌场游戏',
    emoji: '🎰',
    label: '赌场游戏',
    subcategories: ['百家乐', '老虎机', '21点', '轮盘', '德州扑克', '骰宝', '其他'],
    keywords: ['百家乐', '打缆', '看路', '对子', '庄', '闲', '老虎机', 'RTP', '吃分', '吐分', 'jackpot', '21点', '算牌', '轮盘', '红黑', '德州', '扑克', '骰宝', '大小', '庄家优势', '赔率', '凯利公式', '策略', '下注'],
  },
  {
    key: '体育博彩',
    emoji: '⚽',
    label: '体育博彩',
    subcategories: ['足球', '篮球', '赛马', '电竞', '综合'],
    keywords: ['赌球', '足球', '篮球', 'NBA', '体育博彩', '让球', '盘口', '串关', '世界杯', '欧洲杯', '电竞', 'LOL', '赛马'],
  },
  {
    key: '赌城风云',
    emoji: '🌏',
    label: '赌城风云',
    subcategories: ['澳门', '拉斯维加斯', '新加坡', '马尼拉', '柬埔寨', '越南', '赌船', '其他'],
    keywords: ['澳门', '拉斯维加斯', 'vegas', '新加坡', '金沙', '马尼拉', '菲律宾', '柬埔寨', '越南', '赌船', '邮轮', '赌场', 'VIP', '贵宾厅'],
  },
  {
    key: '网赌江湖',
    emoji: '💻',
    label: '网赌江湖',
    subcategories: ['平台套路', '灰控提款', '虚拟货币', '代理推广'],
    keywords: ['网赌', '平台', '客服', '充值', '提现', '出金', '灰控', '代理', '推广', '虚拟货币', '洗钱', '真人荷官', '网上', '线上'],
  },
  {
    key: '赌徒心理',
    emoji: '🧠',
    label: '赌徒心理',
    subcategories: ['成瘾机制', '赌徒谬误', '追损心理', '决策偏差', '心态', '情绪', '社交'],
    keywords: ['追损', '赌徒谬误', '成瘾', '运气', '迷信', '心理', '多巴胺', '时间', '筹码', '职业赌客', '经验', '数据', '孤僻', '失眠', '朋友'],
  },
  {
    key: '赌债人生',
    emoji: '💔',
    label: '赌债人生',
    subcategories: ['债务危机', '家庭关系', '戒赌故事', '情绪困境'],
    keywords: ['欠债', '负债', '借钱', '家人', '离婚', '孩子', '催收', '家庭', '戒赌', 'GA', '互助', '复赌', '冲动', '触发', '不想活', '抑郁'],
  },
  {
    key: '骗局揭秘',
    emoji: '🎭',
    label: '骗局揭秘',
    subcategories: ['带单诈骗', '杀猪盘', '预测软件', '假平台'],
    keywords: ['带单', '杀猪盘', '预测软件', '假冒', '骗局', '大师', '直播', '内幕', '包赢'],
  },
];

// 所有大类label列表（含"全部"用于UI）
export type TopicCategory = '全部' | TopicMajorCategory;
export const ALL_CATEGORIES: TopicCategory[] = ['全部', ...CATEGORY_DEFS.map(c => c.key)];

// ============================================================
// 场景分类（支持显式category + 关键词回退）
// ============================================================

export function categorizeScenario(scenario: ConflictScenario): TopicMajorCategory[] {
  // 优先使用显式分类
  if (scenario.category) return [scenario.category];

  // 回退：关键词匹配
  const categories: TopicMajorCategory[] = [];
  const text = (scenario.topic + ' ' + scenario.triggerKeywords.join(' ')).toLowerCase();

  for (const def of CATEGORY_DEFS) {
    if (def.keywords.some(kw => text.includes(kw))) {
      categories.push(def.key);
    }
  }

  return categories.length > 0 ? categories : ['赌徒心理'];
}

export function getScenarioSubcategory(scenario: ConflictScenario): string | undefined {
  return scenario.subcategory;
}

export function getScenariosByCategory(category: TopicCategory): ConflictScenario[] {
  if (category === '全部') return SEED_SCENARIOS;
  return SEED_SCENARIOS.filter(s => categorizeScenario(s).includes(category as TopicMajorCategory));
}

export function getScenariosBySubcategory(category: TopicMajorCategory, subcategory: string): ConflictScenario[] {
  return getScenariosByCategory(category).filter(s => {
    if (s.subcategory) return s.subcategory === subcategory;
    // 旧场景没有subcategory，用关键词模糊匹配
    return s.topic.includes(subcategory) || s.triggerKeywords.some(kw => kw.includes(subcategory));
  });
}

// ============================================================
// 用户自建话题
// ============================================================

export interface UserTopic {
  id: string;
  topic: string;          // 用户输入的话题
  category?: TopicMajorCategory;  // 用户选的分类（可选）
  createdAt: string;
  usedCount: number;       // 被使用的次数
}

const USER_TOPICS_KEY = 'roundtable_user_topics';

function loadUserTopics(): UserTopic[] {
  try {
    const raw = localStorage.getItem(USER_TOPICS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveUserTopics(topics: UserTopic[]) {
  localStorage.setItem(USER_TOPICS_KEY, JSON.stringify(topics));
}

export function getUserTopics(): UserTopic[] {
  return loadUserTopics();
}

export function createUserTopic(topic: string, category?: TopicMajorCategory): UserTopic {
  const topics = loadUserTopics();

  // 检查重复
  const existing = topics.find(t => t.topic === topic);
  if (existing) {
    existing.usedCount++;
    saveUserTopics(topics);
    return existing;
  }

  const newTopic: UserTopic = {
    id: `user_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    topic,
    category: category || autoDetectCategory(topic),
    createdAt: new Date().toISOString(),
    usedCount: 1,
  };

  topics.unshift(newTopic);
  // 最多保存100个用户话题
  if (topics.length > 100) topics.pop();
  saveUserTopics(topics);
  return newTopic;
}

export function deleteUserTopic(id: string) {
  const topics = loadUserTopics().filter(t => t.id !== id);
  saveUserTopics(topics);
}

export function incrementUserTopicUsage(id: string) {
  const topics = loadUserTopics();
  const topic = topics.find(t => t.id === id);
  if (topic) {
    topic.usedCount++;
    saveUserTopics(topics);
  }
}

// 自动检测话题分类
function autoDetectCategory(topic: string): TopicMajorCategory | undefined {
  const text = topic.toLowerCase();
  for (const def of CATEGORY_DEFS) {
    const matchCount = def.keywords.filter(kw => text.includes(kw)).length;
    if (matchCount >= 1) return def.key;
  }
  return undefined;
}

// 获取用户热门话题（按使用次数排序）
export function getPopularUserTopics(count: number = 10): UserTopic[] {
  return loadUserTopics()
    .sort((a, b) => b.usedCount - a.usedCount)
    .slice(0, count);
}

// ============================================================
// 智能话题推荐（种子 + 用户话题 混合）
// ============================================================

export function getRecommendedMix(count: number = 8): Array<ConflictScenario | UserTopic> {
  const hash = getDayHash();
  const userTopics = getPopularUserTopics(3);
  const seedTopics = getRecommendedTopics(count - userTopics.length);

  // 混合排序
  const mixed: Array<ConflictScenario | UserTopic> = [...userTopics, ...seedTopics];
  return mixed.sort(() => (hash % 3) - 1).slice(0, count);
}

export function isUserTopic(item: ConflictScenario | UserTopic): item is UserTopic {
  return 'usedCount' in item;
}

// ============================================================
// Feed排序 — Reddit风格
// ============================================================

export type FeedSort = 'hot' | 'new' | 'recommended';

// 为种子场景生成确定性的模拟热度（基于场景id哈希）
function scenarioHeat(scenario: ConflictScenario): number {
  let hash = 0;
  for (let i = 0; i < scenario.id.length; i++) {
    hash = ((hash << 5) - hash) + scenario.id.charCodeAt(i);
    hash |= 0;
  }
  // 生成50-999之间的"参与人数"
  return 50 + (Math.abs(hash) % 950);
}

function scenarioComments(scenario: ConflictScenario): number {
  let hash = 0;
  const str = scenario.id + '_comments';
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return 5 + (Math.abs(hash) % 195);
}

// 模拟"发布时间"（确定性，基于场景index在列表中的位置）
function scenarioAge(scenario: ConflictScenario): string {
  const idx = SEED_SCENARIOS.indexOf(scenario);
  const hoursAgo = idx < 10 ? (idx + 1) * 2 : (idx + 1) * 6;
  if (hoursAgo < 24) return `${hoursAgo}小时前`;
  const days = Math.floor(hoursAgo / 24);
  if (days < 7) return `${days}天前`;
  return `${Math.floor(days / 7)}周前`;
}

export interface TopicEngagement {
  heat: number;       // 参与人数
  comments: number;   // 讨论条数
  timeAgo: string;    // 发布时间
}

export function getTopicEngagement(scenario: ConflictScenario): TopicEngagement {
  return {
    heat: scenarioHeat(scenario),
    comments: scenarioComments(scenario),
    timeAgo: scenarioAge(scenario),
  };
}

export function getUserTopicEngagement(ut: UserTopic): TopicEngagement {
  const diff = Date.now() - new Date(ut.createdAt).getTime();
  const mins = Math.floor(diff / 60000);
  let timeAgo = '刚刚';
  if (mins >= 60) {
    const hours = Math.floor(mins / 60);
    if (hours >= 24) {
      timeAgo = `${Math.floor(hours / 24)}天前`;
    } else {
      timeAgo = `${hours}小时前`;
    }
  } else if (mins > 0) {
    timeAgo = `${mins}分钟前`;
  }
  return {
    heat: ut.usedCount * 12 + 3,
    comments: ut.usedCount * 4 + 1,
    timeAgo,
  };
}

// 排序Feed
export function sortFeed(scenarios: ConflictScenario[], sort: FeedSort): ConflictScenario[] {
  switch (sort) {
    case 'hot':
      return [...scenarios].sort((a, b) => scenarioHeat(b) - scenarioHeat(a));
    case 'new':
      // 新场景（expanded）在前，旧场景在后
      return [...scenarios].sort((a, b) => {
        const aNew = a.category ? 1 : 0;
        const bNew = b.category ? 1 : 0;
        if (aNew !== bNew) return bNew - aNew;
        return SEED_SCENARIOS.indexOf(a) - SEED_SCENARIOS.indexOf(b);
      });
    case 'recommended':
    default: {
      const hash = getDayHash();
      return [...scenarios].sort((a, b) => {
        const ha = (hash ^ a.id.length) + scenarioHeat(a);
        const hb = (hash ^ b.id.length) + scenarioHeat(b);
        return hb - ha;
      });
    }
  }
}

// ============================================================
// 今日热议（基于日期确定性选择）
// ============================================================

function getDayHash(): number {
  const now = new Date();
  const dateStr = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
  let hash = 0;
  for (let i = 0; i < dateStr.length; i++) {
    hash = ((hash << 5) - hash) + dateStr.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function getTodayHotTopic(): ConflictScenario {
  const idx = getDayHash() % SEED_SCENARIOS.length;
  return SEED_SCENARIOS[idx];
}

// 获取多个推荐话题（排除今日热议）
export function getRecommendedTopics(count: number): ConflictScenario[] {
  const todayId = getTodayHotTopic().id;
  const hash = getDayHash();
  const others = SEED_SCENARIOS.filter(s => s.id !== todayId);

  // 按日期确定性打乱
  const shuffled = [...others].sort((a, b) => {
    const ha = hash ^ a.id.length;
    const hb = hash ^ b.id.length;
    return ha - hb;
  });

  return shuffled.slice(0, count);
}

// ============================================================
// 投票系统（localStorage）
// ============================================================

interface VoteData {
  [scenarioId: string]: {
    agree: number;
    disagree: number;
    userVote?: 'agree' | 'disagree';
  };
}

const VOTE_KEY = 'roundtable_votes';

function loadVotes(): VoteData {
  try {
    const raw = localStorage.getItem(VOTE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveVotes(data: VoteData) {
  localStorage.setItem(VOTE_KEY, JSON.stringify(data));
}

export function getVotes(scenarioId: string): { agree: number; disagree: number; userVote?: 'agree' | 'disagree' } {
  const data = loadVotes();
  return data[scenarioId] || { agree: Math.floor(Math.random() * 30) + 10, disagree: Math.floor(Math.random() * 25) + 8 };
}

export function castVote(scenarioId: string, side: 'agree' | 'disagree'): { agree: number; disagree: number; userVote: 'agree' | 'disagree' } {
  const data = loadVotes();
  if (!data[scenarioId]) {
    data[scenarioId] = { agree: Math.floor(Math.random() * 30) + 10, disagree: Math.floor(Math.random() * 25) + 8 };
  }

  // 如果已经投过，先撤回
  if (data[scenarioId].userVote) {
    data[scenarioId][data[scenarioId].userVote!]--;
  }

  data[scenarioId][side]++;
  data[scenarioId].userVote = side;
  saveVotes(data);

  return data[scenarioId] as { agree: number; disagree: number; userVote: 'agree' | 'disagree' };
}
