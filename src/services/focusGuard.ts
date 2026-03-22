// ============================================================
// focusGuard — 出站语义拦截器
// 检查模型草稿是否踩红线，命中则返回 reason 触发固定模板/转弯
// 优先级: crisis > high_distress > gambling_strategy > fact_conflict > off_topic > resistance
// ============================================================

import type { GuardReason } from "./safeFallback";

export type GuardResult = {
  blocked: boolean;
  reason?: GuardReason;
  offTopicHint?: string;  // 跑到的话题名（用于 ACK 步骤）
};

// ---- 词表 ----

const CRISIS_TERMS = [
  "不想活", "想死", "自杀", "去死", "活不下去", "死了算了",
  "跳楼", "割腕", "吞药", "结束生命", "没有意义",
  "杀了", "弄死", "同归于尽",
];

const HIGH_DISTRESS_TERMS = [
  "硬扛", "扛不住", "受不了", "崩溃", "撑不下去", "绝望",
  "走投无路", "没有出路", "完了", "毁了", "废了",
  "打掉牙", "往肚子里吞", "天塌了", "喘不过气",
];

const GAMBLING_STRATEGY_TERMS = [
  "凯利", "kelly", "翻本", "梭哈", "加仓", "补仓", "盘口",
  "胜率", "赔率", "对冲", "马丁", "martingale", "套利",
  "止盈", "抄底", "追加", "倍投", "平注",
];

const DRAFT_STRATEGY_AMPLIFIERS =
  /(策略|方法|提高|优化|胜率|回本|盈利|概率|公式|计算|仓位|配置|比例)/i;

// 用户在问知识/原理（不是要策略），应放行到教育子轨
const KNOWLEDGE_INQUIRY_RE =
  /(是什么|什么意思|怎么回事|什么原理|为什么|真的吗|到底|是不是|机制|原理|道理|逻辑|怎么运作|真相|什么是|有什么区别|RTP|RNG|抽水|庄家优势|洗牌|灰控|赌场怎么)/i;

const OFF_TOPIC_MAP: Array<{ terms: string[]; label: string }> = [
  { terms: ["编程", "代码学习", "代码"], label: "编程" },
  { terms: ["健身计划", "健身", "减肥"], label: "健身" },
  { terms: ["旅游攻略", "旅游", "旅行"], label: "旅游" },
  { terms: ["美食推荐", "美食", "吃的"], label: "美食" },
  { terms: ["电影推荐", "电影", "电视剧"], label: "电影" },
  { terms: ["学英语", "英语"], label: "英语学习" },
  { terms: ["找工作", "求职"], label: "找工作" },
  { terms: ["职业规划", "转行"], label: "职业规划" },
  { terms: ["考研", "考试"], label: "考研" },
  { terms: ["护肤", "穿搭"], label: "护肤穿搭" },
];

// 用户抗拒信号
const RESISTANCE_TERMS = [
  "不想说", "不想聊", "别问了", "烦死了", "你管不着",
  "跟你说没用", "说了也没用", "你不懂", "闭嘴",
  "不关你事", "管好你自己", "少废话",
];

// 正面/负面矛盾信号词
const POSITIVE_TERMS = ["赚了", "赢了", "回本了", "翻倍了", "大赚"];
const NEGATIVE_TERMS = [
  "亏了", "输了", "赔了", "打掉牙", "往肚子里吞",
  "完蛋", "血本无归", "全没了",
];

// ---- 工具函数 ----

function hitAny(text: string, terms: string[]): boolean {
  const t = (text || "").toLowerCase();
  return terms.some(k => t.includes(k.toLowerCase()));
}

/** 检测跑到哪个话题，返回 label；无命中返回 undefined */
function detectOffTopicLabel(text: string): string | undefined {
  const t = (text || "").toLowerCase();
  for (const entry of OFF_TOPIC_MAP) {
    if (entry.terms.some(k => t.includes(k.toLowerCase()))) {
      return entry.label;
    }
  }
  return undefined;
}

/**
 * 主拦截函数
 * @param userText  用户最新输入
 * @param draft     模型草稿回复
 * @param history   最近对话历史（用于事实冲突检测）
 */
export function guardReply(
  userText: string,
  draft: string,
  history?: Array<{ role: string; text: string }>,
): GuardResult {
  // --- 1. 危机（最高优先级）：检测用户输入 ---
  if (hitAny(userText, CRISIS_TERMS)) {
    return { blocked: true, reason: "crisis" };
  }

  // --- 2. 高风险情绪（用户输入） ---
  if (hitAny(userText, HIGH_DISTRESS_TERMS)) {
    return { blocked: true, reason: "high_distress" };
  }

  // --- 3. 赌博策略拦截（排除知识询问）---
  const userHasGamble = hitAny(userText, GAMBLING_STRATEGY_TERMS);
  const draftHasGamble = hitAny(draft, GAMBLING_STRATEGY_TERMS);
  const isKnowledgeInquiry = KNOWLEDGE_INQUIRY_RE.test(userText);

  // 知识询问（"凯利是什么"、"胜率到底多少"）→ 放行到教育子轨
  // 策略请求（"怎么用凯利翻本"）→ 拦截
  if (userHasGamble && !isKnowledgeInquiry) {
    if (draftHasGamble && DRAFT_STRATEGY_AMPLIFIERS.test(draft)) {
      return { blocked: true, reason: "gambling_strategy" };
    }
    if (DRAFT_STRATEGY_AMPLIFIERS.test(draft)) {
      return { blocked: true, reason: "gambling_strategy" };
    }
  }

  // --- 4. 事实冲突 ---
  if (history && history.length > 0) {
    const recentUserTexts = history
      .filter(m => m.role === "user")
      .map(m => m.text)
      .join(" ") + " " + userText;

    const hasPositive = hitAny(recentUserTexts, POSITIVE_TERMS);
    const hasNegative = hitAny(recentUserTexts, NEGATIVE_TERMS);

    if (hasPositive && hasNegative) {
      const draftAssumesSide =
        /(损失让你|你亏了|你输了|你赚了|恭喜你)/.test(draft) &&
        !/(到底是|是净赚还是净亏|先确认)/.test(draft);
      if (draftAssumesSide) {
        return { blocked: true, reason: "fact_conflict" };
      }
    }
  }

  // --- 5. 跑题：模型草稿出现无关话题，且用户没提 ---
  const draftLabel = detectOffTopicLabel(draft);
  const userLabel = detectOffTopicLabel(userText);
  if (draftLabel && !userLabel) {
    return { blocked: true, reason: "off_topic", offTopicHint: draftLabel };
  }

  // --- 6. 用户抗拒（不想聊损失）---
  if (hitAny(userText, RESISTANCE_TERMS)) {
    return { blocked: true, reason: "resistance" as GuardReason };
  }

  return { blocked: false };
}
