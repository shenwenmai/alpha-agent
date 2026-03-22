import type { CharacterId, CharacterReview, CharacterRatingStats, ReviewTag } from '../types/room';
import { addCredits } from './creditsService';

// ============================================================
// 角色评价系统 — localStorage 实现
// ============================================================

const REVIEWS_KEY = 'roundtable_reviews_v1';
const MAX_REVIEWS = 500;

// ============================================================
// Store 结构
// ============================================================

interface ReviewStore {
  reviews: CharacterReview[];
  seeded: boolean;                                  // 是否已填入种子
  reviewedCharacters: string[];                     // 用户已评价过的角色ID（用于积分奖励判断）
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

function loadStore(): ReviewStore {
  try {
    const raw = localStorage.getItem(REVIEWS_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { reviews: [], seeded: false, reviewedCharacters: [] };
}

function saveStore(store: ReviewStore) {
  localStorage.setItem(REVIEWS_KEY, JSON.stringify(store));
  notifyListeners();
}

// ============================================================
// 订阅模式（同 roomService）
// ============================================================

type Listener = () => void;
const listeners: Listener[] = [];

export function subscribeReviews(listener: Listener): () => void {
  listeners.push(listener);
  return () => {
    const idx = listeners.indexOf(listener);
    if (idx >= 0) listeners.splice(idx, 1);
  };
}

function notifyListeners() {
  listeners.forEach(l => l());
}

// ============================================================
// CRUD 操作
// ============================================================

export function submitReview(data: {
  characterId: CharacterId;
  rating: number;
  text: string;
  tags: ReviewTag[];
  roomTopic?: string;
}): CharacterReview {
  const store = loadStore();

  const review: CharacterReview = {
    id: generateId(),
    characterId: data.characterId,
    rating: Math.min(5, Math.max(1, Math.round(data.rating))),
    text: data.text.slice(0, 200),
    tags: data.tags.slice(0, 3),
    createdAt: new Date().toISOString(),
    roomTopic: data.roomTopic,
    helpfulCount: 0,
    userMarkedHelpful: false,
  };

  store.reviews.unshift(review);

  // 首次评价该角色 → 奖励3积分
  if (!store.reviewedCharacters.includes(data.characterId)) {
    store.reviewedCharacters.push(data.characterId);
    try {
      addCredits(3, 'review_reward' as any, `评价角色获得奖励`);
    } catch { /* credits service may not have review_reward yet */ }
  }

  // 容量限制
  if (store.reviews.length > MAX_REVIEWS) {
    store.reviews = store.reviews.slice(0, MAX_REVIEWS);
  }

  saveStore(store);
  return review;
}

export function getReviewsForCharacter(characterId: CharacterId): CharacterReview[] {
  const store = loadStore();
  return store.reviews.filter(r => r.characterId === characterId);
}

export function getAllReviews(): CharacterReview[] {
  return loadStore().reviews;
}

export function getMyReviews(): CharacterReview[] {
  const store = loadStore();
  return store.reviews.filter(r => !r.isSeed);
}

export function getRatingStats(characterId: CharacterId): CharacterRatingStats {
  const reviews = getReviewsForCharacter(characterId);

  if (reviews.length === 0) {
    return {
      averageRating: 0,
      totalReviews: 0,
      distribution: [0, 0, 0, 0, 0],
      topTags: [],
    };
  }

  // 分布统计
  const distribution: [number, number, number, number, number] = [0, 0, 0, 0, 0];
  let sum = 0;
  const tagCounts: Record<string, number> = {};

  for (const review of reviews) {
    distribution[review.rating - 1]++;
    sum += review.rating;
    for (const tag of review.tags) {
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    }
  }

  const topTags = Object.entries(tagCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([tag, count]) => ({ tag: tag as ReviewTag, count }));

  return {
    averageRating: Math.round((sum / reviews.length) * 10) / 10,
    totalReviews: reviews.length,
    distribution,
    topTags,
  };
}

export function toggleHelpful(reviewId: string) {
  const store = loadStore();
  const review = store.reviews.find(r => r.id === reviewId);
  if (!review) return;

  if (review.userMarkedHelpful) {
    review.helpfulCount = Math.max(0, review.helpfulCount - 1);
    review.userMarkedHelpful = false;
  } else {
    review.helpfulCount++;
    review.userMarkedHelpful = true;
  }

  saveStore(store);
}

export function hasReviewedCharacter(characterId: CharacterId): boolean {
  const store = loadStore();
  return store.reviewedCharacters.includes(characterId);
}

export function deleteReview(reviewId: string) {
  const store = loadStore();
  store.reviews = store.reviews.filter(r => r.id !== reviewId);
  saveStore(store);
}

// ============================================================
// 种子评价数据 — 首次加载填入，营造人气
// ============================================================

function daysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(Math.floor(Math.random() * 24), Math.floor(Math.random() * 60));
  return d.toISOString();
}

function seedId(idx: number): string {
  return `seed_${idx}_${Math.random().toString(36).substr(2, 6)}`;
}

const SEED_REVIEWS: Array<Omit<CharacterReview, 'id' | 'createdAt'>> = [
  // ===== 军师 (junshi) =====
  { characterId: 'junshi', rating: 5, text: '军师分析太专业了 凯利公式那段我一个赌棍居然听懂了', tags: ['有料', '犀利', '理性'], roomTopic: '百家乐打缆到底有没有用', helpfulCount: 23, userMarkedHelpful: false, isSeed: true },
  { characterId: 'junshi', rating: 4, text: '话不多但每句都是干货 就是平时太安静了 希望多说点', tags: ['话太少', '有料'], roomTopic: '老虎机RTP的真相', helpfulCount: 15, userMarkedHelpful: false, isSeed: true },
  { characterId: 'junshi', rating: 5, text: '跟军师聊完才知道以前输的钱有多冤 早该听他的', tags: ['犀利', '理性'], roomTopic: '职业赌客能不能赢', helpfulCount: 31, userMarkedHelpful: false, isSeed: true },
  { characterId: 'junshi', rating: 3, text: '道理都对但有时候太冷了 像个机器人', tags: ['理性', '话太少'], helpfulCount: 8, userMarkedHelpful: false, isSeed: true },

  // ===== 阿强 (aqiang) =====
  { characterId: 'aqiang', rating: 5, text: '阿强说话太真实了 每句都跟我赌友一模一样 笑死', tags: ['真实', '搞笑', '接地气'], roomTopic: '赌场灰控存不存在', helpfulCount: 28, userMarkedHelpful: false, isSeed: true },
  { characterId: 'aqiang', rating: 4, text: '虽然暴躁但说的都是大实话 起码不装', tags: ['暴躁', '真实'], roomTopic: '百家乐打缆到底有没有用', helpfulCount: 19, userMarkedHelpful: false, isSeed: true },
  { characterId: 'aqiang', rating: 3, text: '太暴躁了动不动就骂人 虽然有道理但听着累', tags: ['暴躁', '话太多'], helpfulCount: 12, userMarkedHelpful: false, isSeed: true },
  { characterId: 'aqiang', rating: 5, text: '阿强跟概率哥吵架那段太精彩了哈哈哈', tags: ['搞笑', '吵架王', '真实'], roomTopic: '经验vs数据谁更靠谱', helpfulCount: 35, userMarkedHelpful: false, isSeed: true },
  { characterId: 'aqiang', rating: 2, text: '就知道吹自己赢过多少 输的时候怎么不说', tags: ['无聊'], helpfulCount: 6, userMarkedHelpful: false, isSeed: true },

  // ===== 概率哥 (gailv) =====
  { characterId: 'gailv', rating: 5, text: '终于有人用数据说话了 概率哥yyds', tags: ['有料', '理性', '犀利'], roomTopic: '经验vs数据谁更靠谱', helpfulCount: 22, userMarkedHelpful: false, isSeed: true },
  { characterId: 'gailv', rating: 4, text: '数据分析很到位 但有时候太学术了 希望多说人话', tags: ['有料', '理性'], roomTopic: '老虎机RTP的真相', helpfulCount: 14, userMarkedHelpful: false, isSeed: true },
  { characterId: 'gailv', rating: 5, text: '概率哥一句话拆穿大师王 看得爽', tags: ['犀利', '有料'], roomTopic: '职业赌客能不能赢', helpfulCount: 26, userMarkedHelpful: false, isSeed: true },
  { characterId: 'gailv', rating: 3, text: '太理性了 有时候赌博不只是数学问题啊', tags: ['理性'], helpfulCount: 9, userMarkedHelpful: false, isSeed: true },

  // ===== 阿杰 (ajie) =====
  { characterId: 'ajie', rating: 5, text: '荷官视角真的不一样 说的那些内幕我在赌场都见过', tags: ['真实', '有料', '犀利'], roomTopic: '赌场灰控存不存在', helpfulCount: 30, userMarkedHelpful: false, isSeed: true },
  { characterId: 'ajie', rating: 4, text: '阿杰说的赌场套路确实是真的 以前不知道', tags: ['有料', '接地气'], helpfulCount: 18, userMarkedHelpful: false, isSeed: true },
  { characterId: 'ajie', rating: 4, text: '有种看纪录片的感觉 揭秘赌场内幕', tags: ['有料', '真实'], roomTopic: '澳门赌场VIP厅的秘密', helpfulCount: 16, userMarkedHelpful: false, isSeed: true },

  // ===== 老刘 (laoliu) =====
  { characterId: 'laoliu', rating: 5, text: '老刘的故事看哭了 太真实了 就是我的经历', tags: ['真实', '暖心'], roomTopic: '赌债人生的尽头', helpfulCount: 42, userMarkedHelpful: false, isSeed: true },
  { characterId: 'laoliu', rating: 4, text: '老刘每次说话都让人心酸 但至少在努力', tags: ['真实', '暖心'], helpfulCount: 20, userMarkedHelpful: false, isSeed: true },
  { characterId: 'laoliu', rating: 3, text: '太丧了 每次都在说自己多惨 能不能积极点', tags: ['无聊'], helpfulCount: 5, userMarkedHelpful: false, isSeed: true },

  // ===== 小芳 (xiaofang) =====
  { characterId: 'xiaofang', rating: 5, text: '小芳骂得好！说出了多少赌徒家属的心声', tags: ['犀利', '真实', '暖心'], roomTopic: '赌债人生的尽头', helpfulCount: 38, userMarkedHelpful: false, isSeed: true },
  { characterId: 'xiaofang', rating: 4, text: '家属视角确实不一样 听完感觉特别愧疚', tags: ['真实', '犀利'], helpfulCount: 25, userMarkedHelpful: false, isSeed: true },
  { characterId: 'xiaofang', rating: 3, text: '理解她的立场但有时候骂得太狠了 谁受得了', tags: ['暴躁', '毒舌'], helpfulCount: 7, userMarkedHelpful: false, isSeed: true },
  { characterId: 'xiaofang', rating: 5, text: '让我想起我老婆 她说过一模一样的话', tags: ['真实', '暖心'], helpfulCount: 33, userMarkedHelpful: false, isSeed: true },

  // ===== 大师王 (dashiwang) =====
  { characterId: 'dashiwang', rating: 5, text: '大师王演得太好了 差点信了 多亏军师拆穿 这种角色有教育意义', tags: ['搞笑', '骗子本色', '有料'], roomTopic: '职业赌客能不能赢', helpfulCount: 40, userMarkedHelpful: false, isSeed: true },
  { characterId: 'dashiwang', rating: 4, text: '身边真的有这种人 看大师王表演就像在照镜子', tags: ['骗子本色', '真实'], helpfulCount: 22, userMarkedHelpful: false, isSeed: true },
  { characterId: 'dashiwang', rating: 2, text: '每次都是那套 看多了就烦了 能不能换点新词', tags: ['无聊'], helpfulCount: 4, userMarkedHelpful: false, isSeed: true },
  { characterId: 'dashiwang', rating: 5, text: '概率哥vs大师王那场辩论绝了 教科书级别的打脸', tags: ['搞笑', '骗子本色'], roomTopic: '百家乐打缆到底有没有用', helpfulCount: 29, userMarkedHelpful: false, isSeed: true },

  // ===== Kelly教授 (kellyprof) =====
  { characterId: 'kellyprof', rating: 5, text: '教授水平就是不一样 学到了正经知识', tags: ['有料', '理性'], roomTopic: '老虎机RTP的真相', helpfulCount: 20, userMarkedHelpful: false, isSeed: true },
  { characterId: 'kellyprof', rating: 4, text: '讲得很专业 适合想认真了解赌博数学的人', tags: ['有料', '理性'], helpfulCount: 16, userMarkedHelpful: false, isSeed: true },
  { characterId: 'kellyprof', rating: 3, text: '太学术了 说的我完全听不懂 能不能接地气点', tags: ['话太多'], helpfulCount: 8, userMarkedHelpful: false, isSeed: true },

  // ===== 小甜 (xiaotian) =====
  { characterId: 'xiaotian', rating: 5, text: '客服小甜的话术太真实了 我在网赌平台听过一模一样的', tags: ['真实', '骗子本色', '搞笑'], roomTopic: '网赌平台客服的秘密', helpfulCount: 25, userMarkedHelpful: false, isSeed: true },
  { characterId: 'xiaotian', rating: 4, text: '很有警示作用 让你知道那些甜言蜜语背后都是套路', tags: ['有料', '骗子本色'], helpfulCount: 18, userMarkedHelpful: false, isSeed: true },
  { characterId: 'xiaotian', rating: 3, text: '说话太假了 虽然知道是演的但还是不舒服', tags: ['骗子本色'], helpfulCount: 6, userMarkedHelpful: false, isSeed: true },

  // ===== 戒赌老张 (laozhang) =====
  { characterId: 'laozhang', rating: 5, text: '老张是真正上岸的人 每句话都有分量', tags: ['真实', '暖心', '有料'], roomTopic: '赌债人生的尽头', helpfulCount: 36, userMarkedHelpful: false, isSeed: true },
  { characterId: 'laozhang', rating: 5, text: '老张的戒赌经验太实用了 比那些鸡汤强一百倍', tags: ['有料', '接地气', '真实'], helpfulCount: 28, userMarkedHelpful: false, isSeed: true },
  { characterId: 'laozhang', rating: 4, text: '讲得很好但有时候有点鸡汤 不过人家确实做到了', tags: ['鸡汤', '暖心'], helpfulCount: 14, userMarkedHelpful: false, isSeed: true },
  { characterId: 'laozhang', rating: 4, text: '戒赌三年不容易 尊重', tags: ['真实', '暖心'], helpfulCount: 21, userMarkedHelpful: false, isSeed: true },
];

export function seedReviewsIfEmpty() {
  const store = loadStore();
  if (store.seeded) return;

  const seededReviews: CharacterReview[] = SEED_REVIEWS.map((r, i) => ({
    ...r,
    id: seedId(i),
    createdAt: daysAgo(Math.floor(Math.random() * 28) + 1),
  }));

  store.reviews = seededReviews;
  store.seeded = true;
  saveStore(store);
}

// ============================================================
// 全局初始化（App启动时调用）
// ============================================================

export function initReviews() {
  seedReviewsIfEmpty();
}
