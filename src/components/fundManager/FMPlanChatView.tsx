import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  ArrowLeft, Send, Mic, MicOff, Plus, Shield, Loader,
  CheckCircle, AlertTriangle, FileText, Zap, X,
} from 'lucide-react';
import { useSpeechRecognition } from '../../hooks/useSpeechRecognition';
import {
  fillDefaults, validateParsedPlan, getRiskLevel,
  CUSTOM_RULE_META,
} from '../../services/fundManagerEngine';
import {
  createSession, startSession, getTemplates,
  saveAsPersonalTemplate, analyzeHistoryPatterns,
} from '../../services/fundManagerService';
import { FM_COLORS } from '../../theme';
import { GOLDEN_TEMPLATES } from '../../constants/goldenTemplates';
import type { SessionPlan, FMTemplate, CustomRule, CustomRuleCondition } from '../../types/fundManager';

// ============================================================
// 统一对话式建档 — AI 问诊定策 · 专属战约
// ============================================================

type PlayerProfileType = 'revenge_trader' | 'profit_giver_back' | 'hot_hand' | 'bored_bettor';

interface PsychAnswers {
  exit_pattern?: string;
  loss_streak_threshold?: number;
  win_tendency?: string;
  revenge_thought?: string;
  intervention_pref?: string;
}

function computePlayerProfile(answers: PsychAnswers): PlayerProfileType {
  if (answers.revenge_thought === '经常有' || answers.exit_pattern === '输了很多才走')
    return 'revenge_trader';
  if (answers.win_tendency === '继续打下去' || answers.win_tendency === '想收手但打了')
    return 'profit_giver_back';
  if (answers.loss_streak_threshold === 0)
    return 'bored_bettor';
  return 'hot_hand';
}

// ── 根据画像计算个性化场景触发阈值 ──
function computeCustomThresholds(profile: PlayerProfileType, plan: Partial<SessionPlan>) {
  const defaultStreak = plan.stop_loss_streak || 5;
  switch (profile) {
    case 'revenge_trader':
      return {
        loss_streak_alert: Math.min(3, defaultStreak),  // 比止损早触发，最多3手
        profit_lock_pct: 60,
        win_streak_alert: 5,
        grind_hands_alert: 0,
      };
    case 'profit_giver_back':
      return {
        loss_streak_alert: defaultStreak,
        profit_lock_pct: 50,   // 赢了50%开始锁盈警告
        win_streak_alert: 5,
        grind_hands_alert: 0,
      };
    case 'hot_hand':
      return {
        loss_streak_alert: defaultStreak,
        profit_lock_pct: 60,
        win_streak_alert: 3,   // 连赢3手就提醒别加大
        grind_hands_alert: 0,
      };
    case 'bored_bettor':
    default:
      return {
        loss_streak_alert: defaultStreak,
        profit_lock_pct: 60,
        win_streak_alert: 5,
        grind_hands_alert: 15, // 15手净盈亏<5%触发缠斗
      };
  }
}

// ── 根据画像生成个性化话术包（3-4句）──
function computeTalkScripts(profile: PlayerProfileType, templateName: string): string[] {
  const pact = templateName || '你的战约';
  switch (profile) {
    case 'revenge_trader':
      return [
        `你说好的，到连输就停，现在到了。「${pact}」是这么写的。`,
        '上次就是这个时候加码，后来怎么样了？',
        '现在的你，是在追回输的，还是在执行计划？',
        '「赢回来」这个念头出现了——这正是你让我提醒你的时候。',
      ];
    case 'profit_giver_back':
      return [
        '赢了不走，是回吐的开始。你上次也是这样。',
        `盈利已达目标，「${pact}」说到了就走。`,
        '现在不是判断行情的时候，是执行计划的时候。',
        '你上次就是在这个位置没走，记得吗？',
      ];
    case 'hot_hand':
      return [
        '赢的时候反而要小心——这是你自己说的。',
        '状态好时码量不变，这是铁律。感觉越好，越要小心。',
        '连赢之后加大，是很多人输钱的原因。你知道这个。',
        `「${pact}」已经帮你想好了：赢了，执行，不变。`,
      ];
    case 'bored_bettor':
    default:
      return [
        '没有明确手感的时候，观望也是一种选择。',
        `已经打了很多手，净盈亏接近零——「${pact}」建议你认真考虑是否继续。`,
        '跟注的成本是时间和筹码。如果你不确定为什么要打，就不要打。',
        '缠斗是悄无声息地输光的方式。你现在的状态需要注意。',
      ];
  }
}

const PROFILE_LABELS: Record<PlayerProfileType, string> = {
  revenge_trader: '追损倾向明显',
  profit_giver_back: '容易回吐盈利',
  hot_hand: '赢了容易加大',
  bored_bettor: '对输赢不太敏感',
};

const PSYCH_QUESTIONS: { q: string; field: keyof PsychAnswers; chips: string[]; numValues?: number[] }[] = [
  {
    q: '上次离场时，是哪种情况？',
    field: 'exit_pattern',
    chips: ['赢着走的', '输着走的', '输了很多才走', '不太记得了'],
  },
  {
    q: '连输几手之后你会开始感到不安？',
    field: 'loss_streak_threshold',
    chips: ['2手', '3手', '5手', '不太在意'],
    numValues: [2, 3, 5, 0],
  },
  {
    q: '赢了之后，你更容易……',
    field: 'win_tendency',
    chips: ['继续打下去', '想收手但还是打了', '会收手走人'],
  },
  {
    q: '有没有过「今天必须赢回来」的想法？',
    field: 'revenge_thought',
    chips: ['经常有', '偶尔有', '几乎没有'],
  },
  {
    q: '你希望我在什么时候强提醒你？',
    field: 'intervention_pref',
    chips: ['连输后立刻提醒', '赢了不走时提醒', '两种都要', '让我自己判断'],
  },
];

interface FMPlanChatViewProps {
  onBack: () => void;
  onPlanConfirmed: () => void;
  onGoTemplates?: () => void;
}

// CURRENCY_SYMBOLS removed — 不再显示货币符号

// ── 聊天消息类型 ──

interface ChatMessage {
  id: string;
  role: 'ai' | 'user';
  text: string;
  timestamp: string;
  cardType?: 'plan_summary' | 'quick_form' | 'template_picker' | 'warning' | 'advanced_form' | 'psych_question' | 'naming';
  cardData?: any;
}

// ── 追问状态机 ──

type PlanField = 'session_budget' | 'stop_loss_amount' | 'base_unit' | 'take_profit_amount' | 'max_duration_minutes';

const FOLLOW_UP_QUESTIONS: { field: PlanField; question: string }[] = [
  { field: 'session_budget', question: '今天带了多少？' },
  { field: 'stop_loss_amount', question: '最多能亏多少？到了这个数我帮你拦。' },
  { field: 'base_unit', question: '每手下多少？' },
  { field: 'take_profit_amount', question: '赢多少就走？定个目标。' },
  { field: 'max_duration_minutes', question: '打算玩多久？' },
];

// ── 快捷模式 ──

type QuickMode = 'form' | 'template' | 'express';

function genId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

export default function FMPlanChatView({ onBack, onPlanConfirmed, onGoTemplates }: FMPlanChatViewProps) {
  // 消息列表
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: genId(),
      role: 'ai',
      text: '上桌前，先把规矩定好。\n\n直接告诉我你的计划——带多少、输多少停、赢多少走。\n比如："带5000，输1500停，赢2000走，玩1小时"\n\n说不清楚也没事，一项一项来。今天带了多少？',
      timestamp: new Date().toISOString(),
    },
  ]);
  // 是否显示初始快捷选项（用户发消息后消失）
  const [showInitialQuickOptions, setShowInitialQuickOptions] = useState(true);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // 方案构建状态
  const [plan, setPlan] = useState<Partial<SessionPlan>>({ input_method: 'text' });
  const [planConfirmed, setPlanConfirmed] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | undefined>();
  const [followUpIndex, setFollowUpIndex] = useState(0); // 追问进度
  const planRef = useRef(plan);
  planRef.current = plan; // 始终保持最新

  // 心理画像问诊阶段
  const [psychPhase, setPsychPhase] = useState<'idle' | 'asking' | 'done'>('idle');
  const [psychIndex, setPsychIndex] = useState(0);
  const [psychAnswers, setPsychAnswers] = useState<PsychAnswers>({});
  const [namingPhase, setNamingPhase] = useState<'idle' | 'asking' | 'done'>('idle');
  const [pendingNumericPlan, setPendingNumericPlan] = useState<Partial<SessionPlan> | null>(null);
  const [pendingPlayerProfile, setPendingPlayerProfile] = useState<PlayerProfileType | null>(null);
  const [namingInput, setNamingInput] = useState('');

  // 快捷菜单
  const [showQuickMenu, setShowQuickMenu] = useState(false);
  const [showQuickForm, setShowQuickForm] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);

  // 进阶指标表单
  const [advancedFormPlan, setAdvancedFormPlan] = useState<SessionPlan | null>(null);

  // 快捷表单临时值
  const [qfBudget, setQfBudget] = useState('');
  const [qfStopLoss, setQfStopLoss] = useState('');
  const [qfBaseUnit, setQfBaseUnit] = useState('');
  const [qfTakeProfit, setQfTakeProfit] = useState('');
  const [qfDuration, setQfDuration] = useState('');

  // 语音
  const {
    transcript, interimTranscript, isListening, isSupported,
    startListening, stopListening, resetTranscript,
    error: speechError,
  } = useSpeechRecognition('zh-CN');

  // Refs
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // 自动滚动到底部
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 语音停止后自动提交 — 使用 ref 避免 stale closure
  const handleUserInputRef = useRef<((text: string) => Promise<void>) | null>(null);
  useEffect(() => {
    if (!isListening && transcript.trim() && handleUserInputRef.current) {
      handleUserInputRef.current(transcript.trim());
      resetTranscript();
    }
  }, [isListening, transcript, resetTranscript]);

  // ── 辅助函数 ──

  const addMessage = useCallback((msg: Omit<ChatMessage, 'id' | 'timestamp'>) => {
    setMessages(prev => [...prev, {
      ...msg,
      id: genId(),
      timestamp: new Date().toISOString(),
    }]);
  }, []);

  const addAIMessage = useCallback((text: string, cardType?: ChatMessage['cardType'], cardData?: any) => {
    addMessage({ role: 'ai', text, cardType, cardData });
  }, [addMessage]);

  // ── 确认方案 ──

  const handleConfirmPlan = useCallback((p: Partial<SessionPlan>) => {
    const filled = fillDefaults(p);
    const session = createSession(filled, selectedTemplateId);
    startSession(session.id);
    setPlanConfirmed(true);
    addAIMessage('方案锁定，我盯着。');
    setTimeout(() => {
      if (mountedRef.current) onPlanConfirmed();
    }, 800);
  }, [onPlanConfirmed, addAIMessage, selectedTemplateId]);

  // ── 对话意图处理（非参数输入）──

  const handleConversation = (text: string, currentPlan: Partial<SessionPlan>): boolean => {
    const lower = text.toLowerCase();
    const missing = getNextMissingField(currentPlan);
    const filledCount = ['session_budget', 'stop_loss_amount', 'base_unit', 'take_profit_amount', 'max_duration_minutes']
      .filter(f => currentPlan[f as keyof SessionPlan]).length;

    // 当前进度提示（如果已有部分参数）
    const progressHint = filledCount > 0
      ? `\n\n目前已设定 ${filledCount} 项，还差${5 - filledCount}项就完整了。`
      : '';

    // 要推荐/不知道怎么定
    if (/推荐|建议|好的方案|什么方案|怎么[定弄搞]|帮我[定弄]|你[来帮]定|不知道[怎该]/.test(lower)) {
      addAIMessage('下面有三个模板——保守、平衡、激进，选一个直接建档。\n或者告诉我你带了多少、能亏多少，我帮你配。' + progressHint);
      setShowInitialQuickOptions(true);
      return true;
    }

    // 拒绝回答当前问题
    if (/不想|不要|不告诉|不说|跳过|算了|过|略/.test(lower)) {
      if (missing === 'session_budget') {
        addAIMessage('行，预算先跳过。那今天最多能亏多少？有个底线就行。');
      } else {
        addAIMessage(`跳过。${getNextQuestion(currentPlan, missing)}`);
      }
      return true;
    }

    // 问这是什么/怎么用
    if (/什么意思|怎么用|干[嘛什]|是什么|有啥用|怎么回事/.test(lower)) {
      addAIMessage('上桌前定好规矩——带多少、亏多少停、赢多少走。我全程帮你盯着，到线就提醒你。\n\n今天打算带多少？');
      return true;
    }

    // 随便/都行
    if (/随便|无所谓|都行|你说了算|看着办|懒得/.test(lower)) {
      addAIMessage('选个模板吧。保守适合控制风险，平衡适合大多数人，激进适合短线冲击。');
      setShowInitialQuickOptions(true);
      return true;
    }

    // 打招呼
    if (/你好|嗨|hi|hello|在吗|哈喽/.test(lower)) {
      addAIMessage('准备上桌？告诉我今天的计划。');
      return true;
    }

    // 担心/犹豫
    if (/怕|担心|紧张|不敢|犹豫|心里没底|没信心/.test(lower)) {
      addAIMessage('定好规矩再上桌，心里就有底了。先说最重要的——最多能亏多少？');
      return true;
    }

    // 能不能改/中途调整
    if (/[能可]不[能以]改|之?后[能可以再]调|中途.*改/.test(lower)) {
      addAIMessage('随时能改。先定一个，上桌后不合适再调。今天什么计划？');
      return true;
    }

    // 抱怨/质疑系统
    if (/没用|不准|不靠谱|垃圾|不好用|太麻烦/.test(lower)) {
      addAIMessage('规矩越简单越好执行。说个数就行——今天带多少，亏多少就停？');
      return true;
    }

    // 问之前战绩/历史
    if (/上次|之前|历史|战绩|记录/.test(lower)) {
      addAIMessage('历史记录在"管家"首页可以查。现在先把今天的方案定好。带了多少？');
      return true;
    }

    // 没匹配到 → 交给后续逻辑
    return false;
  };

  const getNextQuestion = (plan: Partial<SessionPlan>, skipField?: string | null): string => {
    const fields = ['session_budget', 'stop_loss_amount', 'base_unit', 'take_profit_amount', 'max_duration_minutes'];
    for (const f of fields) {
      if (f === skipField) continue;
      if (!plan[f as keyof SessionPlan]) {
        const q = FOLLOW_UP_QUESTIONS.find(fq => fq.field === f);
        return q ? q.question : '';
      }
    }
    return '';
  };

  // ── 核心：处理用户输入 ──

  const handleUserInput = useCallback(async (text: string) => {
    if (!text.trim() || isLoading || planConfirmed) return;
    const currentPlan = planRef.current; // 始终取最新 plan

    addMessage({ role: 'user', text: text.trim() });
    setShowInitialQuickOptions(false);

    // 检查是否用户在说"确认"
    const confirmWords = ['确认', '好了', '可以了', '开始', '没问题', '就这样', '上桌'];
    if (confirmWords.some(w => text.includes(w)) && isPlanComplete(currentPlan)) {
      handleConfirmPlan(currentPlan);
      return;
    }

    // 检查是否用户在说"调整"
    const adjustWords = ['调整', '修改', '改一下', '不对', '重来'];
    if (adjustWords.some(w => text.includes(w))) {
      addAIMessage('好的，哪里需要调整？直接告诉我就行。');
      return;
    }

    // 检查是否用户在问问题或表达非参数意图
    const hasNumbers = /\d/.test(text);
    if (!hasNumbers) {
      const handled = handleConversation(text, currentPlan);
      if (handled) return;
    }

    // 尝试解析
    const isLongText = text.length >= 10;

    if (isLongText && hasNumbers) {
      // 长文本 → 调用 AI API 解析
      setIsLoading(true);
      try {
        const res = await fetch('/api/fm-parse-plan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text }),
        });
        if (!mountedRef.current) return;

        if (res.ok) {
          const data = await res.json();
          const parsed = data.plan || {};
          const confidence = data.confidence || 0;
          const missing = data.missing_fields || [];

          // 合并到现有 plan（用 ref 取最新）
          const merged = mergePlan(planRef.current, parsed);
          // API 常常漏掉布尔字段，用本地正则补充覆盖
          if (/可以加|允许加码?|我允许|可以调|看情况加/.test(text)) merged.allow_raise_bet = true;
          else if (/不加|不追|不许加|禁止加/.test(text)) merged.allow_raise_bet = false;
          setPlan(merged);

          if (confidence >= 0.7 && missing.length <= 2) {
            addAIMessage(formatParsedSummary(merged, confidence));
            startPsychPhase(merged);
          } else {
            addAIMessage(formatPartialParse(merged, missing));
            askNextMissing(merged);
          }
        } else {
          const lp = planRef.current;
          const localPlan = localExtract(text, lp);
          setPlan(localPlan);
          respondToInput(text, localPlan, lp);
        }
      } catch {
        if (!mountedRef.current) return;
        // 网络失败时明确提示用户，降级到本地解析
        addMessage({
          role: 'assistant',
          content: '⚠️ 网络连接异常，我用本地方式理解了你的输入。如果结果不准确，请再说一次或换个表述。',
        });
        const lp = planRef.current;
        const localPlan = localExtract(text, lp);
        setPlan(localPlan);
        respondToInput(text, localPlan, lp);
      } finally {
        if (mountedRef.current) setIsLoading(false);
      }
    } else {
      // 短文本 → 本地解析
      const previousPlan = currentPlan;
      const updated = localExtract(text, currentPlan);
      setPlan(updated);
      respondToInput(text, updated, previousPlan);
    }
  }, [isLoading, planConfirmed, addMessage, addAIMessage, handleConfirmPlan]);
  handleUserInputRef.current = handleUserInput; // ref 赋值必须在声明之后

  // ── 中文数字/单位解析 ──

  const parseChineseNumber = (s: string): number => {
    if (!s) return 0;
    let n = s.replace(/,/g, '');
    if (/万/.test(n)) return parseFloat(n.replace(/万/, '')) * 10000;
    if (/千/.test(n)) return parseFloat(n.replace(/千/, '')) * 1000;
    if (/[kK]/.test(n)) return parseFloat(n.replace(/[kK]/, '')) * 1000;
    return parseFloat(n) || 0;
  };

  // ── 本地解析（多参数并行提取 + 顺序兜底）──

  const localExtract = (text: string, current: Partial<SessionPlan>): Partial<SessionPlan> => {
    const updated = { ...current };
    const currency = detectCurrency(text);
    if (currency) updated.currency = currency;

    // 预处理：去除货币符号，让正则更容易匹配数字
    const clean = text.replace(/[¥￥$＄€£₩₫]/g, '');

    // 时间提取
    const dur = parseDuration(clean);
    if (dur) updated.max_duration_minutes = dur;

    // 连输手数
    const streak = parseStreak(clean);
    if (streak) updated.stop_loss_streak = streak;

    // 加码意图（正向 > 负向，防止误匹配）
    if (/可以加|允许加码?|我允许|可以调|看情况加|可以上调/.test(clean)) updated.allow_raise_bet = true;
    else if (/不加|不追|不许加|禁止加|不能加/.test(clean)) updated.allow_raise_bet = false;

    // 净输手数
    const netHandsMatch = clean.match(/净[输亏](\d+)[手次把]|净[输亏].*?(\d+)/);
    if (netHandsMatch) {
      updated.stop_loss_net_hands = parseInt(netHandsMatch[1] || netHandsMatch[2]);
    }

    // 数字模式（可带万/千/k后缀）
    const N = '(\\d[\\d,.]*(?:万|千|[kK])?)';

    // ── 多参数金额提取 ──
    // 预算：我有X / 带了X / 本金X / 准备了X / 拿X来 / X本钱
    const budgetMatch = clean.match(new RegExp(`(?:我有|带了?|本金|预算|资金|总共|准备了?|拿|手上有)[\\s]*${N}`))
      || clean.match(new RegExp(`${N}(?:本钱|本金|的本)`));
    if (budgetMatch) updated.session_budget = parseChineseNumber(budgetMatch[1]);

    // 止损：输X就走 / 最多输X / 亏X停 / 实在不行输X
    const lossMatch = clean.match(new RegExp(`(?:最多|实在不行|顶多)?(?:输|亏)(?:到|了|掉)?[\\s]*(?:\\d[\\d,.]*(?:万|千|[kK])?(?:到|至|-|~))?${N}`))
      || clean.match(new RegExp(`最多(?:输|亏)[\\s]*${N}`));
    if (lossMatch) updated.stop_loss_amount = parseChineseNumber(lossMatch[1]);

    // 止盈：赢X就走 / 赚X走 / 赚到X / 赢了X就走 / 打算赚X
    const profitMatch = clean.match(new RegExp(`(?:赢|赚|盈利)(?:到|了)?[\\s]*${N}(?:就走|就收|就好|走人|收工|停)?`))
      || clean.match(new RegExp(`(?:打算|目标|想)(?:赢|赚)[\\s]*(?:了|到)?[\\s]*${N}`));
    if (profitMatch) updated.take_profit_amount = parseChineseNumber(profitMatch[1]);

    // 基码：每手X / 基码X / 一手X / 每把X / X一手
    const unitMatch = clean.match(new RegExp(`(?:每手|基码|码量|每把|每次|一手|每局)[\\s]*${N}`))
      || clean.match(new RegExp(`${N}(?:一手|一把)`));
    if (unitMatch) updated.base_unit = parseChineseNumber(unitMatch[1]);

    // ── 如果上面什么都没匹配到，降级到顺序兜底 ──
    const nothingNew = !budgetMatch && !lossMatch && !profitMatch && !unitMatch && !dur && !streak;
    if (nothingNew) {
      const num = parseNumber(clean);
      if (num) {
        const field = getNextMissingField(updated);
        if (field === 'session_budget') updated.session_budget = num;
        else if (field === 'stop_loss_amount') updated.stop_loss_amount = num;
        else if (field === 'base_unit') updated.base_unit = num;
        else if (field === 'take_profit_amount') updated.take_profit_amount = num;
        else if (field === 'max_duration_minutes') updated.max_duration_minutes = num;
      }
    }

    return updated;
  };

  // ── 回复逻辑（基于 diff 检测变化字段，不依赖顺序）──

  const respondToInput = (_text: string, updated: Partial<SessionPlan>, previousPlan: Partial<SessionPlan>) => {
    const confirmParts: string[] = [];

    // 检测哪些字段刚被填充或修改
    if (updated.session_budget && updated.session_budget !== previousPlan.session_budget) {
      confirmParts.push(`操盘资金 ${updated.session_budget.toLocaleString()}`);
    }
    if (updated.stop_loss_amount && updated.stop_loss_amount !== previousPlan.stop_loss_amount) {
      const pctText = updated.stop_loss_pct ? `（${updated.stop_loss_pct}%）` : '';
      confirmParts.push(`最大亏损 ${updated.stop_loss_amount.toLocaleString()}${pctText}`);
    }
    if (updated.base_unit && updated.base_unit !== previousPlan.base_unit) {
      confirmParts.push(`基础码量 ${updated.base_unit.toLocaleString()}`);
    }
    if (updated.take_profit_amount && updated.take_profit_amount !== previousPlan.take_profit_amount) {
      confirmParts.push(`盈利目标 ${updated.take_profit_amount.toLocaleString()}`);
    }
    if (updated.max_duration_minutes && updated.max_duration_minutes !== previousPlan.max_duration_minutes) {
      confirmParts.push(`时间上限 ${updated.max_duration_minutes} 分钟`);
    }
    if (updated.stop_loss_net_hands && updated.stop_loss_net_hands !== previousPlan.stop_loss_net_hands) {
      confirmParts.push(`净输 ${updated.stop_loss_net_hands} 手止损`);
    }

    if (confirmParts.length > 0) {
      addAIMessage(`记下了——${confirmParts.join('，')}。`);
      // 检查是否完整
      if (isPlanComplete(updated)) {
        startPsychPhase(updated);
      } else {
        askNextMissing(updated);
      }
    } else {
      // 什么都没提取到 → 引导回方案
      addAIMessage('没听清金额。直接说数字就行，比如"带5000"、"输2000停"、"赢3000走"。\n或者点 [+] 用表单填写。');
    }
  };

  const askNextMissing = (current: Partial<SessionPlan>) => {
    const field = getNextMissingField(current);
    if (!field) return;
    const q = FOLLOW_UP_QUESTIONS.find(fq => fq.field === field);
    if (q) {
      setTimeout(() => addAIMessage(q.question), 400);
    }
  };

  // 数字方案完成 → 进入心理画像问诊阶段
  const startPsychPhase = (p: Partial<SessionPlan>) => {
    setPendingNumericPlan(p);
    setPsychPhase('asking');
    setPsychIndex(0);
    setPsychAnswers({});
    setTimeout(() => {
      addAIMessage(
        '数字方案定好了 ✅\n\n再问你几个习惯问题，帮我在实战中更准确地提醒你。',
        'psych_question',
        { index: 0 },
      );
    }, 600);
  };

  // 用户选择心理画像答案
  const handlePsychAnswer = (qIndex: number, chip: string) => {
    const q = PSYCH_QUESTIONS[qIndex];
    const numIdx = q.chips.indexOf(chip);
    const fieldValue = q.numValues !== undefined ? q.numValues[numIdx] : chip;
    const newAnswers: PsychAnswers = { ...psychAnswers, [q.field]: fieldValue };
    setPsychAnswers(newAnswers);
    addMessage({ role: 'user', text: chip });

    if (qIndex + 1 < PSYCH_QUESTIONS.length) {
      setPsychIndex(qIndex + 1);
      setTimeout(() => {
        addAIMessage(PSYCH_QUESTIONS[qIndex + 1].q, 'psych_question', { index: qIndex + 1 });
      }, 400);
    } else {
      // 5问完成 → 计算画像 → 进入命名
      setPsychPhase('done');
      const profile = computePlayerProfile(newAnswers);
      setPendingPlayerProfile(profile);
      setTimeout(() => {
        addAIMessage(
          `了解了，你的特征：${PROFILE_LABELS[profile]}。\n\n最后一步——给这份战约起个名字？\n默认叫「我的战约」，也可以输入你想要的。`,
          'naming',
          {},
        );
        setNamingPhase('asking');
      }, 500);
    }
  };

  // 用户提交战约名称
  const handleNamingSubmit = (rawName: string) => {
    const finalName = rawName.trim() || '我的战约';
    setNamingPhase('done');
    addMessage({ role: 'user', text: `命名：${finalName}` });
    addAIMessage(`「${finalName}」已保存 🎯  下次选方案时直接找它。`);

    if (pendingNumericPlan) {
      // 计算个性化阈值 + 话术
      const profile = pendingPlayerProfile ?? 'hot_hand';
      let customThresholds = computeCustomThresholds(profile, pendingNumericPlan);
      const talkScripts = computeTalkScripts(profile, finalName);

      // AR方向1-P2: 根据历史行为节点自动微调阈值
      const historyResult = analyzeHistoryPatterns(customThresholds, pendingNumericPlan);
      let historyMsg: string | null = null;
      let basePlan = pendingNumericPlan;

      if (historyResult.adjustments.length > 0) {
        // 应用调整
        const applied: string[] = [];
        for (const adj of historyResult.adjustments) {
          if (adj.field === 'loss_streak_alert') {
            customThresholds = { ...customThresholds, loss_streak_alert: adj.to };
            applied.push(`连损预警：${adj.from} 手 → ${adj.to} 手`);
          } else if (adj.field === 'profit_lock_pct') {
            customThresholds = { ...customThresholds, profit_lock_pct: adj.to };
            applied.push(`盈利保护触发：${adj.from}% → ${adj.to}%`);
          }
        }
        // max_duration_minutes 单独处理（写入局部变量）
        const durationAdj = historyResult.adjustments.find(a => a.field === 'max_duration_minutes');
        if (durationAdj) {
          basePlan = { ...basePlan, max_duration_minutes: durationAdj.to };
          applied.push(`建议时长：${durationAdj.from} 分钟 → ${durationAdj.to} 分钟`);
        }

        historyMsg = `📊 根据你过去 ${historyResult.sessions_analyzed} 场数据，我做了 ${applied.length} 处调整：\n${applied.map(s => `• ${s}`).join('\n')}\n\n原因：${historyResult.adjustments.map(a => a.reason).join('；')}`;
      }

      const planWithMeta = {
        ...basePlan,
        template_name: finalName,
        player_profile: profile,
        custom_scene_thresholds: customThresholds,
        talk_scripts: talkScripts,
      };
      setPlan(planWithMeta);
      // 保存为个人战约模板
      const filled = fillDefaults(planWithMeta);
      saveAsPersonalTemplate(filled, finalName, profile);

      // 先展示历史数据调整说明（如有），再展示方案卡
      const delay = historyMsg ? 1200 : 800;
      if (historyMsg) {
        setTimeout(() => addAIMessage(historyMsg!), 500);
      }
      setTimeout(() => {
        addAIMessage('方案出来了，确认没问题就上桌：', 'plan_summary', filled);
      }, delay);
    }
  };

  const showPlanCard = (p: Partial<SessionPlan>) => {
    const filled = fillDefaults(p);
    setTimeout(() => {
      addAIMessage('方案出来了，确认没问题就上桌：', 'plan_summary', filled);
    }, 600);
  };

  // ── 快捷功能 ──

  const handleQuickForm = () => {
    setShowQuickMenu(false);
    setShowQuickForm(true);
    setShowTemplates(false);
  };

  const handleQuickFormSubmit = () => {
    const budget = parseNumber(qfBudget);
    const stopLoss = parseNumber(qfStopLoss);
    const baseUnit = parseNumber(qfBaseUnit);
    const takeProfit = parseNumber(qfTakeProfit);
    const duration = parseNumber(qfDuration);

    if (!budget) return;

    const parts: string[] = [];
    if (budget) parts.push(`操盘资金${budget}`);
    if (stopLoss) parts.push(`止损${stopLoss}`);
    if (baseUnit) parts.push(`基码${baseUnit}`);
    if (takeProfit) parts.push(`止盈${takeProfit}`);
    if (duration) parts.push(`${duration}分钟`);

    const merged: Partial<SessionPlan> = { ...plan };
    if (budget) merged.session_budget = budget;
    if (stopLoss) merged.stop_loss_amount = stopLoss;
    if (baseUnit) merged.base_unit = baseUnit;
    if (takeProfit) merged.take_profit_amount = takeProfit;
    if (duration) merged.max_duration_minutes = duration;

    setPlan(merged);
    setShowQuickForm(false);
    addMessage({ role: 'user', text: `🪄 ${parts.join('，')}` });

    addAIMessage(`收到！${parts.filter(p => p.includes('操盘资金') || p.includes('止') || p.includes('基码')).map(p => p.replace(/^(操盘资金|止损|止盈|基码)/, '')).join('，')}${duration ? `，${duration}分钟` : ''}。`);

    if (isPlanComplete(merged)) {
      startPsychPhase(merged);
    } else {
      askNextMissing(merged);
    }

    // 清空表单
    setQfBudget(''); setQfStopLoss(''); setQfBaseUnit(''); setQfTakeProfit(''); setQfDuration('');
  };

  // 旧 builtin 模板ID → goldenTemplate ID 映射
  const BUILTIN_TO_GOLDEN: Record<string, string> = {
    fm_tpl_builtin_conservative: 'A',
    fm_tpl_builtin_balanced: 'B',
    fm_tpl_builtin_aggressive: 'C',
  };

  const handleTemplateSelect = (tpl: FMTemplate) => {
    setShowTemplates(false);
    setShowQuickMenu(false);
    setSelectedTemplateId(tpl.id);

    // 优先使用 goldenTemplates 动态计算（基于进场资金调整基码等参数）
    const goldenId = BUILTIN_TO_GOLDEN[tpl.id];
    const golden = goldenId ? GOLDEN_TEMPLATES[goldenId as keyof typeof GOLDEN_TEMPLATES] : null;
    const entryBank = plan.session_budget || plan.total_bankroll || 5000;

    let templatePlan: Partial<SessionPlan>;
    if (golden) {
      // v1.2: 用 goldenTemplate 动态生成（基码=进场资金×baseUnitPct）
      templatePlan = { ...golden.toPlanPartial(entryBank), template_id: goldenId } as Partial<SessionPlan>;
    } else {
      templatePlan = tpl.plan;
    }

    const merged: Partial<SessionPlan> = { ...plan, ...templatePlan, input_method: 'template' };
    setPlan(merged);

    addMessage({ role: 'user', text: `🧩 使用模板: ${tpl.name}` });
    addAIMessage(`已套用「${tpl.name}」模板。`);
    showPlanCard(merged);
  };

  const handleExpressMode = () => {
    setShowQuickMenu(false);
    // 极速模式：从第一个缺失字段开始追问
    addAIMessage('好的，极速建档！我挨个问你关键参数。\n\n今天带了多少钱？');
  };

  // ── 发送按钮 ──

  const handleSend = () => {
    const text = inputText.trim();
    if (!text) return;
    setInputText('');
    handleUserInput(text);
  };

  // 语音切换
  const handleMicToggle = () => {
    if (isListening) {
      stopListening();
    } else {
      resetTranscript();
      startListening();
    }
  };

  // ── 显示进阶指标表单 ──
  const handleShowAdvancedForm = (filled: SessionPlan) => {
    setAdvancedFormPlan(filled);
    addAIMessage('基础方案已确认！现在你可以设置进阶风控指标（可选），也可以直接跳过上桌。', 'advanced_form', filled);
  };

  // ── 进阶表单完成 ──
  const handleAdvancedFormSubmit = (updatedPlan: SessionPlan, hasAdvanced: boolean) => {
    setAdvancedFormPlan(null);
    if (hasAdvanced) {
      // 有进阶设置 → 自动保存为个人模板
      saveAsPersonalTemplate(updatedPlan);
      addAIMessage('进阶指标已设置，并已保存为你的个人模板！');
    }
    handleConfirmPlan(updatedPlan);
  };

  // ── 渲染方案确认卡片 ──

  const renderPlanCard = (filled: SessionPlan) => {
    const risk = getRiskLevel(filled);
    const riskColor = risk === '保守' ? FM_COLORS.accent : risk === '平衡' ? '#3B82F6' : FM_COLORS.danger;
    const validation = validateParsedPlan(filled);

    return (
      <div style={{
        background: '#1F1F1F', borderRadius: 16, padding: 16,
        border: `1px solid ${FM_COLORS.border}`, marginTop: 8,
      }}>
        {/* 风险等级 */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 12,
        }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: FM_COLORS.textPrimary }}>
            你的风控方案
          </span>
          <span style={{
            padding: '3px 10px', borderRadius: 10,
            background: riskColor + '18', color: riskColor,
            fontSize: 12, fontWeight: 600,
          }}>
            {risk === '保守' ? '◈' : risk === '平衡' ? '◆' : '▲'} {risk}
          </span>
        </div>

        {/* 参数网格 */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
          <ParamCell label="操盘资金" value={`${filled.session_budget.toLocaleString()}`} />
          <ParamCell label="基码" value={`${filled.base_unit.toLocaleString()}`} />
          <ParamCell label="止损" value={`${filled.stop_loss_amount.toLocaleString()}`} color={FM_COLORS.danger} />
          <ParamCell label="止盈" value={`${filled.take_profit_amount.toLocaleString()}`} color={FM_COLORS.accent} />
          <ParamCell label="时间" value={`${filled.max_duration_minutes}分钟`} />
          <ParamCell label="净输手数止损" value={filled.stop_loss_net_hands > 0 ? `${filled.stop_loss_net_hands}手` : '未设置'} color={filled.stop_loss_net_hands > 0 ? '#D97706' : undefined} />
          <ParamCell label="加码" value={filled.allow_raise_bet ? '允许' : '禁止'} />
        </div>

        {/* 校验警告 */}
        {validation.errors.length > 0 && (
          <div style={{
            background: 'rgba(230,184,0,0.12)', borderRadius: 10, padding: '8px 12px',
            marginBottom: 12, fontSize: 12, color: '#FBBF24',
          }}>
            {validation.errors.map((e, i) => (
              <div key={i}>⚠️ {e}</div>
            ))}
          </div>
        )}

        {/* 操作按钮 */}
        <button
          className="clickable"
          onClick={() => handleShowAdvancedForm(filled)}
          style={{
            width: '100%', padding: '13px', borderRadius: 14,
            border: 'none',
            background: `linear-gradient(135deg, ${FM_COLORS.primary}, ${FM_COLORS.secondary})`,
            color: '#fff', fontSize: 15, fontWeight: 700,
            cursor: 'pointer', marginBottom: 8,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}
        >
          <CheckCircle size={18} /> 确认基础方案
        </button>
        <button
          className="clickable"
          onClick={() => addAIMessage('好的，哪里需要调整？直接告诉我就行。')}
          style={{
            width: '100%', padding: '11px', borderRadius: 14,
            border: `2px solid ${FM_COLORS.primary}50`,
            background: `${FM_COLORS.primary}0A`,
            color: FM_COLORS.primary, fontSize: 14, fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          我要调整
        </button>
      </div>
    );
  };

  // ── 渲染 ──

  const templates = getTemplates();

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      height: '100vh', maxWidth: 640, margin: '0 auto',
      background: FM_COLORS.inputBg,
    }}>
      {/* ═══ 顶部 ═══ */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '14px 16px', flexShrink: 0,
        background: FM_COLORS.cardBg,
        borderBottom: `1px solid ${FM_COLORS.border}`,
      }}>
        <button className="clickable" onClick={onBack}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6 }}>
          <ArrowLeft size={20} color={FM_COLORS.textPrimary} />
        </button>
        <div style={{ flex: 1 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: FM_COLORS.textPrimary }}>
            AI 问诊定策
          </h2>
        </div>
        <Shield size={20} color={FM_COLORS.accent} />
      </div>

      {/* ═══ 聊天区域 ═══ */}
      <div style={{
        flex: 1, overflowY: 'auto', padding: '20px 20px',
        display: 'flex', flexDirection: 'column', gap: 18,
      }}>
        {messages.map(msg => (
          <div key={msg.id}>
            {msg.role === 'ai' ? (
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                {/* AI 头像 */}
                <div style={{
                  width: 32, height: 32, borderRadius: 16, flexShrink: 0,
                  background: `linear-gradient(135deg, ${FM_COLORS.primary}, ${FM_COLORS.secondary})`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  marginTop: 2,
                }}>
                  <Shield size={15} color="#fff" />
                </div>
                <div style={{ flex: 1, minWidth: 0, marginRight: 16 }}>
                  <div style={{
                    padding: '14px 18px',
                    borderRadius: '4px 18px 18px 18px',
                    background: FM_COLORS.cardBg,
                    fontSize: 15, color: FM_COLORS.textPrimary,
                    lineHeight: 1.85, whiteSpace: 'pre-wrap',
                    letterSpacing: '0.01em',
                  }}>
                    {renderRichText(msg.text)}
                  </div>
                  {/* 卡片渲染 */}
                  {msg.cardType === 'plan_summary' && msg.cardData && renderPlanCard(msg.cardData)}
                  {msg.cardType === 'advanced_form' && msg.cardData && (
                    <AdvancedIndicatorForm
                      basePlan={msg.cardData}
                      onSubmit={handleAdvancedFormSubmit}
                      onSkip={() => handleAdvancedFormSubmit(msg.cardData, false)}
                    />
                  )}
                  {/* 心理画像选项卡 */}
                  {msg.cardType === 'psych_question' && msg.cardData && psychPhase === 'asking' && psychIndex === msg.cardData.index && (
                    <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {PSYCH_QUESTIONS[msg.cardData.index].chips.map(chip => (
                        <button
                          key={chip}
                          onClick={() => handlePsychAnswer(msg.cardData.index, chip)}
                          style={{
                            padding: '8px 16px', borderRadius: 20, cursor: 'pointer',
                            background: FM_COLORS.inputBg,
                            border: `1.5px solid ${FM_COLORS.border}`,
                            color: FM_COLORS.textPrimary, fontSize: 13, fontWeight: 500,
                            transition: 'all 0.15s',
                          }}
                        >
                          {chip}
                        </button>
                      ))}
                    </div>
                  )}
                  {/* 战约命名卡 */}
                  {msg.cardType === 'naming' && namingPhase === 'asking' && (
                    <div style={{ marginTop: 10 }}>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <input
                          value={namingInput}
                          onChange={e => setNamingInput(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && handleNamingSubmit(namingInput)}
                          placeholder="我的战约"
                          autoFocus
                          style={{
                            flex: 1, padding: '10px 14px', borderRadius: 14,
                            background: FM_COLORS.inputBg,
                            border: `1.5px solid ${FM_COLORS.border}`,
                            color: FM_COLORS.textPrimary, fontSize: 14,
                            outline: 'none',
                          }}
                        />
                        <button
                          onClick={() => handleNamingSubmit(namingInput)}
                          style={{
                            padding: '10px 18px', borderRadius: 14, border: 'none',
                            background: `linear-gradient(135deg, ${FM_COLORS.primary}, ${FM_COLORS.secondary})`,
                            color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer',
                          }}
                        >
                          确定
                        </button>
                      </div>
                      <div style={{ marginTop: 6, fontSize: 12, color: FM_COLORS.textSecondary }}>
                        留空直接确定 → 默认「我的战约」
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <div style={{
                  maxWidth: '80%', padding: '12px 16px',
                  borderRadius: '18px 18px 4px 18px',
                  background: FM_COLORS.userBg, color: '#fff',
                  fontSize: 15, lineHeight: 1.7, whiteSpace: 'pre-wrap',
                  letterSpacing: '0.01em',
                }}>
                  {msg.text}
                </div>
              </div>
            )}
          </div>
        ))}

        {/* 加载指示器 */}
        {isLoading && (
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <div style={{
              width: 32, height: 32, borderRadius: 16, flexShrink: 0,
              background: `linear-gradient(135deg, ${FM_COLORS.primary}, ${FM_COLORS.secondary})`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Shield size={14} color="#fff" />
            </div>
            <div style={{
              padding: '12px 16px', borderRadius: '4px 18px 18px 18px',
              background: FM_COLORS.cardBg,
              fontSize: 14, color: FM_COLORS.textSecondary,
            }}>
              <Loader size={16} className="spin" style={{ animation: 'spin 1s linear infinite' }} /> 正在分析...
            </div>
          </div>
        )}

        {/* ═══ 初始快捷选项（用户发消息前可见） ═══ */}
        {showInitialQuickOptions && !planConfirmed && (
          <div style={{
            display: 'flex', gap: 12, padding: '12px 0 8px',
          }}>
            <QuickOptionCard
              icon="🪄" label="表单快填" desc="逐项填写关键参数"
              onClick={() => { setShowInitialQuickOptions(false); handleQuickForm(); }}
            />
            <QuickOptionCard
              icon="🧩" label="套用模板" desc="选择预设风控方案"
              onClick={() => { setShowInitialQuickOptions(false); if (onGoTemplates) { onGoTemplates(); } else { setShowTemplates(true); setShowQuickMenu(false); setShowQuickForm(false); } }}
            />
            <QuickOptionCard
              icon="⚡" label="极速建档" desc="AI逐步引导你填"
              onClick={() => { setShowInitialQuickOptions(false); handleExpressMode(); }}
            />
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* ═══ 语音实时预览 ═══ */}
      {isListening && (interimTranscript || transcript) && (
        <div style={{
          padding: '8px 16px', background: 'rgba(230,184,0,0.12)',
          fontSize: 13, color: '#FBBF24', borderTop: `1px solid rgba(230,184,0,0.25)`,
        }}>
          🎙️ {transcript}{interimTranscript && <span style={{ opacity: 0.5 }}>{interimTranscript}</span>}
        </div>
      )}

      {/* ═══ 快捷菜单 ═══ */}
      {showQuickMenu && (
        <div style={{
          padding: '8px 16px', background: FM_COLORS.cardBg,
          borderTop: `1px solid ${FM_COLORS.border}`,
          display: 'flex', gap: 8,
        }}>
          <QuickBtn icon="🪄" label="表单快填" onClick={handleQuickForm} />
          <QuickBtn icon="🧩" label="套用模板" onClick={() => { if (onGoTemplates) { onGoTemplates(); } else { setShowTemplates(true); setShowQuickMenu(false); setShowQuickForm(false); } }} />
          <QuickBtn icon="⚡" label="极速建档" onClick={handleExpressMode} />
        </div>
      )}

      {/* ═══ 快捷表单（内嵌） ═══ */}
      {showQuickForm && (
        <div style={{
          padding: '12px 16px', background: FM_COLORS.cardBg,
          borderTop: `1px solid ${FM_COLORS.border}`,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: FM_COLORS.textPrimary }}>🪄 快速填写</span>
            <button onClick={() => setShowQuickForm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
              <X size={16} color={FM_COLORS.textSecondary} />
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
            <MiniInput label="操盘资金 *" value={qfBudget} onChange={setQfBudget} placeholder="5000" />
            <MiniInput label="止损" value={qfStopLoss} onChange={setQfStopLoss} placeholder="1500" />
            <MiniInput label="基码" value={qfBaseUnit} onChange={setQfBaseUnit} placeholder="100" />
            <MiniInput label="止盈" value={qfTakeProfit} onChange={setQfTakeProfit} placeholder="2000" />
            <MiniInput label="时间(分钟)" value={qfDuration} onChange={setQfDuration} placeholder="60" />
          </div>
          <button
            className="clickable"
            onClick={handleQuickFormSubmit}
            disabled={!qfBudget.trim()}
            style={{
              width: '100%', padding: '10px', borderRadius: 12,
              border: 'none',
              background: qfBudget.trim() ? `linear-gradient(135deg, ${FM_COLORS.primary}, ${FM_COLORS.secondary})` : '#D1D5DB',
              color: '#fff', fontSize: 14, fontWeight: 600,
              cursor: qfBudget.trim() ? 'pointer' : 'not-allowed',
            }}
          >
            发送
          </button>
        </div>
      )}

      {/* ═══ 模板选择（内嵌） ═══ */}
      {showTemplates && (
        <div style={{
          padding: '12px 16px', background: FM_COLORS.cardBg,
          borderTop: `1px solid ${FM_COLORS.border}`,
          maxHeight: 200, overflowY: 'auto',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: FM_COLORS.textPrimary }}>🧩 选择模板</span>
            <button onClick={() => setShowTemplates(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
              <X size={16} color={FM_COLORS.textSecondary} />
            </button>
          </div>
          {templates.filter(t => t.is_builtin).map(tpl => (
            <button
              key={tpl.id}
              className="clickable"
              onClick={() => handleTemplateSelect(tpl)}
              style={{
                width: '100%', padding: '10px 14px', marginBottom: 6,
                borderRadius: 12, border: `1px solid ${FM_COLORS.border}`,
                background: FM_COLORS.inputBg, cursor: 'pointer', textAlign: 'left',
              }}
            >
              <div style={{ fontSize: 14, fontWeight: 600, color: FM_COLORS.textPrimary }}>{tpl.name}</div>
              <div style={{ fontSize: 12, color: FM_COLORS.textSecondary }}>{tpl.description}</div>
            </button>
          ))}
        </div>
      )}

      {/* ═══ 输入栏 ═══ */}
      {!planConfirmed && (
        <div style={{
          padding: '12px 20px calc(12px + env(safe-area-inset-bottom, 0px))',
          background: FM_COLORS.cardBg,
          borderTop: `1px solid ${FM_COLORS.border}`,
        }}>
          {/* 语音错误 */}
          {speechError && (
            <div style={{ fontSize: 11, color: FM_COLORS.danger, marginBottom: 4 }}>
              ⚠️ {speechError}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            {/* 快捷菜单按钮 — 初始选项可见时隐藏（避免重复） */}
            {!showInitialQuickOptions && (
              <button
                className="clickable"
                onClick={() => { setShowQuickMenu(!showQuickMenu); setShowQuickForm(false); setShowTemplates(false); }}
                style={{
                  width: 36, height: 36, borderRadius: 18, flexShrink: 0,
                  border: `1px solid ${FM_COLORS.border}`,
                  background: showQuickMenu ? FM_COLORS.accent + '15' : '#1F1F1F',
                  cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: showQuickMenu ? FM_COLORS.accent : FM_COLORS.textSecondary,
                }}
              >
                <Plus size={18} />
              </button>
            )}

            {/* 麦克风 */}
            {isSupported && (
              <button
                className="clickable"
                onClick={handleMicToggle}
                style={{
                  width: 36, height: 36, borderRadius: 18, flexShrink: 0,
                  border: 'none',
                  background: isListening
                    ? `linear-gradient(135deg, ${FM_COLORS.danger}, #FF6B6B)`
                    : '#1F1F1F',
                  cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: isListening ? '0 0 12px rgba(230,57,70,0.4)' : 'none',
                  transition: 'all 0.2s ease',
                }}
              >
                {isListening
                  ? <MicOff size={16} color="#fff" />
                  : <Mic size={16} color={FM_COLORS.textSecondary} />
                }
              </button>
            )}

            {/* 文字输入 */}
            <input
              ref={inputRef}
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSend()}
              placeholder="输入你的计划..."
              disabled={isLoading}
              style={{
                flex: 1, padding: '12px 16px', borderRadius: 22,
                border: 'none',
                background: FM_COLORS.inputBg, fontSize: 15,
                color: FM_COLORS.textPrimary, outline: 'none',
                minWidth: 0,
              }}
            />

            {/* 发送 */}
            <button
              className="clickable"
              onClick={handleSend}
              disabled={!inputText.trim() || isLoading}
              style={{
                width: 38, height: 38, borderRadius: 19, flexShrink: 0,
                border: 'none',
                background: inputText.trim()
                  ? `linear-gradient(135deg, ${FM_COLORS.primary}, ${FM_COLORS.secondary})`
                  : '#D1D5DB',
                cursor: inputText.trim() ? 'pointer' : 'not-allowed',
                color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// 子组件
// ============================================================

function ParamCell({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{
      padding: '8px 10px', borderRadius: 10, background: FM_COLORS.cardBg,
    }}>
      <div style={{ fontSize: 10, color: FM_COLORS.textSecondary, marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 600, color: color || FM_COLORS.textPrimary }}>{value}</div>
    </div>
  );
}

function QuickBtn({ icon, label, onClick }: { icon: string; label: string; onClick: () => void }) {
  return (
    <button
      className="clickable"
      onClick={onClick}
      style={{
        flex: 1, padding: '10px 8px', borderRadius: 12,
        border: `1px solid ${FM_COLORS.border}`,
        background: FM_COLORS.inputBg, cursor: 'pointer',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
      }}
    >
      <span style={{ fontSize: 18 }}>{icon}</span>
      <span style={{ fontSize: 11, fontWeight: 600, color: FM_COLORS.textPrimary }}>{label}</span>
    </button>
  );
}

/** 初始页快捷选项卡片 */
function QuickOptionCard({ icon, label, desc, onClick }: {
  icon: string; label: string; desc: string; onClick: () => void;
}) {
  return (
    <button
      className="clickable"
      onClick={onClick}
      style={{
        flex: 1, padding: '12px 8px', borderRadius: 14,
        border: `1px solid ${FM_COLORS.border}`,
        background: FM_COLORS.inputBg, cursor: 'pointer',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
        transition: 'background 0.15s',
      }}
    >
      <span style={{ fontSize: 22 }}>{icon}</span>
      <span style={{ fontSize: 13, fontWeight: 700, color: FM_COLORS.textPrimary }}>{label}</span>
      <span style={{ fontSize: 10, color: FM_COLORS.textSecondary, lineHeight: 1.3 }}>{desc}</span>
    </button>
  );
}

/** 富文本渲染：将 **text** 转为粗体 */
function renderRichText(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  if (parts.length === 1) return text;
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={i} style={{ fontWeight: 700, color: FM_COLORS.primary }}>
          {part.slice(2, -2)}
        </strong>
      );
    }
    return part;
  });
}

function MiniInput({ label, value, onChange, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; placeholder: string;
}) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 600, color: FM_COLORS.textSecondary, marginBottom: 3 }}>{label}</div>
      <input
        type="number"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: '100%', padding: '8px 10px', borderRadius: 10,
          border: `1px solid ${FM_COLORS.border}`, background: FM_COLORS.inputBg,
          fontSize: 14, outline: 'none', boxSizing: 'border-box',
          color: FM_COLORS.textPrimary,
        }}
      />
    </div>
  );
}

// ============================================================
// 辅助函数（从 FMPlanQAView 复用）
// ============================================================

function parseNumber(text: string): number | null {
  const map: Record<string, number> = {
    '一': 1, '二': 2, '两': 2, '三': 3, '四': 4, '五': 5,
    '六': 6, '七': 7, '八': 8, '九': 9, '十': 10,
    '百': 100, '千': 1000, '万': 10000,
  };
  const numMatch = text.match(/[\d,]+(\.\d+)?/);
  if (numMatch) return parseFloat(numMatch[0].replace(/,/g, ''));
  const cnMatch = text.match(/([一二两三四五六七八九十百千万]+)/);
  if (cnMatch) {
    const cn = cnMatch[1];
    let result = 0;
    let current = 0;
    for (const char of cn) {
      const val = map[char];
      if (!val) continue;
      if (val >= 10) {
        if (current === 0) current = 1;
        if (val === 10000) {
          result = (result + current) * val;
          current = 0;
        } else {
          current *= val;
          result += current;
          current = 0;
        }
      } else {
        current = val;
      }
    }
    result += current;
    return result > 0 ? result : null;
  }
  return null;
}

function detectCurrency(text: string): string | null {
  if (/港币|HKD|hk\$/i.test(text)) return 'HKD';
  if (/美元|美金|USD|\$(?!.*港)/i.test(text)) return 'USD';
  if (/澳门币|MOP/i.test(text)) return 'MOP';
  if (/人民币|RMB|元|块|CNY/i.test(text)) return 'CNY';
  return null;
}

function parsePercent(text: string): number | null {
  const match = text.match(/(\d+)\s*[%％成]/);
  if (match) {
    let num = parseInt(match[1]);
    if (text.includes('成')) num *= 10;
    return num;
  }
  if (text.includes('翻一倍') || text.includes('翻倍')) return 100;
  if (text.includes('三成')) return 30;
  if (text.includes('两成') || text.includes('二成')) return 20;
  if (text.includes('五成') || text.includes('一半')) return 50;
  return null;
}

function parseDuration(text: string): number | null {
  const cnHalfMatch = text.match(/一个半小时/);
  if (cnHalfMatch) return 90;
  const hourMatch = text.match(/(\d+\.?\d*)\s*[个小]?时/);
  const minMatch = text.match(/(\d+)\s*分/);
  const halfMatch = text.match(/半\s*[个小]?时/);
  if (hourMatch) {
    let hours = parseFloat(hourMatch[1]);
    if (text.includes('半')) hours += 0.5;
    return Math.round(hours * 60);
  }
  if (halfMatch) return 30;
  if (minMatch) return parseInt(minMatch[1]);
  return null;
}

function parseStreak(text: string): number | null {
  const match = text.match(/连[输败](\d+)[手次把]/);
  if (match) return parseInt(match[1]);
  const cnMatch = text.match(/连[输败]([一二三四五六七八九十]+)[手次把]/);
  if (cnMatch) return parseNumber(cnMatch[1]);
  return null;
}

// ── Plan 辅助 ──

function isPlanComplete(plan: Partial<SessionPlan>): boolean {
  return !!(plan.session_budget && plan.stop_loss_amount && plan.base_unit
    && plan.take_profit_amount && plan.max_duration_minutes);
}

function getNextMissingField(plan: Partial<SessionPlan>): PlanField | null {
  for (const fq of FOLLOW_UP_QUESTIONS) {
    if (plan[fq.field] == null) return fq.field;
  }
  return null;
}

function mergePlan(existing: Partial<SessionPlan>, parsed: Partial<SessionPlan>): Partial<SessionPlan> {
  const merged = { ...existing };
  for (const [key, value] of Object.entries(parsed)) {
    if (value !== null && value !== undefined) {
      (merged as any)[key] = value;
    }
  }
  return merged;
}

function formatParsedSummary(plan: Partial<SessionPlan>, confidence: number): string {
  const parts: string[] = [];
  if (plan.session_budget) parts.push(`操盘资金 ${plan.session_budget.toLocaleString()}`);
  if (plan.stop_loss_amount) parts.push(`止损 ${plan.stop_loss_amount.toLocaleString()}`);
  if (plan.base_unit) parts.push(`基码 ${plan.base_unit.toLocaleString()}`);
  if (plan.take_profit_amount) parts.push(`止盈 ${plan.take_profit_amount.toLocaleString()}`);
  if (plan.max_duration_minutes) parts.push(`时间 ${plan.max_duration_minutes}分钟`);
  return `我理解的方案：${parts.join('，')}。\n请确认以下详细方案：`;
}

function formatPartialParse(plan: Partial<SessionPlan>, missing: string[]): string {
  const understood: string[] = [];
  if (plan.session_budget) understood.push(`操盘资金 ${plan.session_budget.toLocaleString()}`);
  if (plan.stop_loss_amount) understood.push(`止损 ${plan.stop_loss_amount.toLocaleString()}`);
  if (plan.base_unit) understood.push(`基码 ${plan.base_unit.toLocaleString()}`);
  if (plan.take_profit_amount) understood.push(`止盈 ${plan.take_profit_amount.toLocaleString()}`);

  let text = understood.length > 0
    ? `收到，我理解了：${understood.join('，')}。`
    : '我还需要了解更多细节。';
  return text;
}

// ============================================================
// 进阶风控指标表单
// ============================================================

const ADV_FM = {
  cardBg: FM_COLORS.cardBg,
  border: FM_COLORS.border,
  primary: FM_COLORS.primary,
  secondary: FM_COLORS.secondary,
  accent: FM_COLORS.accent,
  danger: FM_COLORS.danger,
  textPrimary: FM_COLORS.textPrimary,
  textSecondary: FM_COLORS.textSecondary,
  sectionBg: FM_COLORS.inputBg,
};

type AdvFormSection = {
  title: string;
  icon: string;
  items: {
    key: string;
    condition?: CustomRuleCondition;    // 自定义规则条件
    planField?: keyof SessionPlan;      // 或直接映射到 plan 字段
    label: string;
    description: string;
    unit: string;
    defaultValue?: number;
  }[];
};

const ADVANCED_SECTIONS: AdvFormSection[] = [
  {
    title: '止损进阶', icon: '🚧',
    items: [
      { key: 'stop_loss_streak', planField: 'stop_loss_streak', label: '连输手数止损', description: '连续输几手就强制止损', unit: '手', defaultValue: 5 },
      { key: 'stop_loss_net_hands', planField: 'stop_loss_net_hands', label: '净输手数止损', description: '总输比赢多出几手就止损', unit: '手', defaultValue: 8 },
      { key: 'drawdown_amount', condition: 'drawdown_amount_gte', label: '回撤金额', description: '盈利后往下跌了多少钱就提醒', unit: '元' },
      { key: 'drawdown_pct', condition: 'drawdown_pct_gte', label: '回撤百分比', description: '赚了之后回吐百分之几就提醒，如赚1000回吐50%=跌了500', unit: '%', defaultValue: 50 },
    ],
  },
  {
    title: '止盈进阶', icon: '🏦',
    items: [
      { key: 'lock_profit_trigger', planField: 'lock_profit_trigger', label: '锁盈触发', description: '盈利到多少开始锁住，跌回来就提醒你走', unit: '元' },
      { key: 'lock_profit_floor', planField: 'lock_profit_floor', label: '最低保留', description: '锁盈后至少保住多少盈利', unit: '元' },
      { key: 'win_streak', condition: 'win_streak_gte', label: '连赢提醒', description: '连赢太多容易飘，到了上限提醒你冷静', unit: '手', defaultValue: 5 },
    ],
  },
  {
    title: '纪律控制', icon: '🧭',
    items: [
      { key: 'total_hands', condition: 'total_hands_gte', label: '总手数上限', description: '打了多少手就提醒停，防止无节制', unit: '手', defaultValue: 30 },
      { key: 'single_bet', condition: 'single_bet_gte', label: '单手码量上限', description: '单手下注不超过多少', unit: '元' },
      { key: 'win_rate', condition: 'win_rate_below', label: '胜率下限', description: '胜率低于多少就提醒（至少5手后生效）', unit: '%', defaultValue: 40 },
    ],
  },
];

function AdvancedIndicatorForm({
  basePlan,
  onSubmit,
  onSkip,
}: {
  basePlan: SessionPlan;
  onSubmit: (plan: SessionPlan, hasAdvanced: boolean) => void;
  onSkip: () => void;
}) {
  // 每个指标的 开关 + 值
  const [enabled, setEnabled] = React.useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    // 如果 basePlan 已有值，自动开启
    for (const sec of ADVANCED_SECTIONS) {
      for (const item of sec.items) {
        if (item.planField) {
          const v = basePlan[item.planField];
          init[item.key] = typeof v === 'number' && v > 0;
        } else {
          init[item.key] = false;
        }
      }
    }
    return init;
  });

  const [values, setValues] = React.useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const sec of ADVANCED_SECTIONS) {
      for (const item of sec.items) {
        if (item.planField) {
          const v = basePlan[item.planField];
          init[item.key] = typeof v === 'number' && v > 0 ? String(v) : '';
        } else {
          init[item.key] = item.defaultValue ? String(item.defaultValue) : '';
        }
      }
    }
    return init;
  });

  // 自定义文本规则
  const [customText, setCustomText] = React.useState('');
  const [customRules, setCustomRules] = React.useState<CustomRule[]>(basePlan.custom_rules || []);

  const toggleItem = (key: string) => {
    setEnabled(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const setValue = (key: string, val: string) => {
    setValues(prev => ({ ...prev, [key]: val }));
  };

  const addCustomTextRule = () => {
    const text = customText.trim();
    if (!text) return;
    const rule: CustomRule = {
      id: `cr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      condition: 'custom_text',
      threshold: 0,
      level: 'formal_alert',
      label: text,
      raw_input: text,
    };
    setCustomRules(prev => [...prev, rule]);
    setCustomText('');
  };

  const removeCustomRule = (id: string) => {
    setCustomRules(prev => prev.filter(r => r.id !== id));
  };

  const handleSubmit = () => {
    const updatedPlan = { ...basePlan };
    const newCustomRules: CustomRule[] = [...customRules];
    let hasAdvanced = customRules.length > 0;

    for (const sec of ADVANCED_SECTIONS) {
      for (const item of sec.items) {
        if (!enabled[item.key]) continue;
        const num = parseFloat(values[item.key]);
        if (isNaN(num) || num <= 0) continue;

        hasAdvanced = true;

        if (item.planField) {
          // 直接写入 plan 字段
          (updatedPlan as any)[item.planField] = num;
          // 连输的 warn 跟着更新
          if (item.planField === 'stop_loss_streak') {
            updatedPlan.stop_loss_streak_warn = Math.max(1, num - 1);
          }
        } else if (item.condition) {
          // 创建自定义规则
          const meta = CUSTOM_RULE_META[item.condition];
          newCustomRules.push({
            id: `cr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            condition: item.condition,
            threshold: num,
            level: meta.defaultLevel,
            label: `${item.label} ${num}${item.unit}`,
          });
        }
      }
    }

    updatedPlan.custom_rules = newCustomRules;
    onSubmit(updatedPlan, hasAdvanced);
  };

  const enabledCount = Object.values(enabled).filter(Boolean).length + customRules.length;

  return (
    <div style={{
      background: ADV_FM.sectionBg, borderRadius: 16, padding: 14,
      border: `1px solid ${ADV_FM.border}`, marginTop: 8,
    }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: ADV_FM.textPrimary, marginBottom: 4 }}>
        进阶风控指标
      </div>
      <div style={{ fontSize: 12, color: ADV_FM.textSecondary, marginBottom: 12 }}>
        根据你的风格勾选需要的指标，不懂的看说明。可以全部跳过。
      </div>

      {ADVANCED_SECTIONS.map(sec => (
        <div key={sec.title} style={{ marginBottom: 12 }}>
          <div style={{
            fontSize: 12, fontWeight: 700, color: ADV_FM.primary,
            marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4,
          }}>
            {sec.icon} {sec.title}
          </div>
          {sec.items.map(item => (
            <div key={item.key} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 10px', borderRadius: 10,
              background: enabled[item.key] ? `${ADV_FM.accent}10` : '#fff',
              border: `1px solid ${enabled[item.key] ? ADV_FM.accent + '30' : ADV_FM.border}`,
              marginBottom: 4, transition: 'all 0.2s',
            }}>
              {/* 开关 */}
              <button
                onClick={() => toggleItem(item.key)}
                style={{
                  width: 20, height: 20, borderRadius: 4, flexShrink: 0,
                  border: `2px solid ${enabled[item.key] ? ADV_FM.accent : '#CBD5E1'}`,
                  background: enabled[item.key] ? ADV_FM.accent : '#fff',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.2s',
                }}
              >
                {enabled[item.key] && (
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M2 6L5 9L10 3" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </button>

              {/* 标签+说明 */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: enabled[item.key] ? ADV_FM.textPrimary : 'rgba(255,255,255,0.6)' }}>
                  {item.label}
                </div>
                <div style={{ fontSize: 12, color: enabled[item.key] ? ADV_FM.textSecondary : 'rgba(255,255,255,0.4)', lineHeight: 1.4 }}>
                  {item.description}
                </div>
              </div>

              {/* 数值输入 */}
              {enabled[item.key] && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
                  <input
                    type="number"
                    value={values[item.key]}
                    onChange={e => setValue(item.key, e.target.value)}
                    placeholder={item.defaultValue ? String(item.defaultValue) : '0'}
                    style={{
                      width: 54, padding: '4px 6px', borderRadius: 6,
                      border: `1px solid ${ADV_FM.border}`, background: FM_COLORS.inputBg,
                      fontSize: 13, textAlign: 'center', outline: 'none',
                      color: FM_COLORS.textPrimary,
                    }}
                  />
                  <span style={{ fontSize: 11, color: ADV_FM.textSecondary }}>{item.unit}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      ))}

      {/* 自定义规则输入 */}
      <div style={{ marginBottom: 12 }}>
        <div style={{
          fontSize: 12, fontWeight: 700, color: ADV_FM.primary,
          marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4,
        }}>
          🪶 自定义规则
        </div>
        <div style={{ fontSize: 10, color: ADV_FM.textSecondary, marginBottom: 6 }}>
          用你自己的话写一条规则，如"连赢3手后必须休息5分钟"
        </div>
        {customRules.map(cr => (
          <div key={cr.id} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '6px 10px', borderRadius: 8,
            background: FM_COLORS.aiBg, marginBottom: 4,
          }}>
            <span style={{ fontSize: 12, color: ADV_FM.textPrimary }}>{cr.label}</span>
            <button
              onClick={() => removeCustomRule(cr.id)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}
            >
              <X size={12} color={ADV_FM.textSecondary} />
            </button>
          </div>
        ))}
        <div style={{ display: 'flex', gap: 6 }}>
          <input
            type="text"
            value={customText}
            onChange={e => setCustomText(e.target.value)}
            placeholder="输入自定义规则..."
            onKeyDown={e => e.key === 'Enter' && addCustomTextRule()}
            style={{
              flex: 1, padding: '6px 10px', borderRadius: 8,
              border: `1px solid ${ADV_FM.border}`, background: FM_COLORS.inputBg,
              fontSize: 12, outline: 'none', color: FM_COLORS.textPrimary,
            }}
          />
          <button
            onClick={addCustomTextRule}
            disabled={!customText.trim()}
            style={{
              padding: '6px 12px', borderRadius: 8,
              border: 'none', background: customText.trim() ? ADV_FM.accent : '#D1D5DB',
              color: '#fff', fontSize: 12, fontWeight: 600,
              cursor: customText.trim() ? 'pointer' : 'not-allowed',
            }}
          >
            添加
          </button>
        </div>
      </div>

      {/* 操作按钮 */}
      <button
        className="clickable"
        onClick={handleSubmit}
        style={{
          width: '100%', padding: '12px', borderRadius: 14,
          border: 'none',
          background: `linear-gradient(135deg, ${ADV_FM.primary}, ${ADV_FM.secondary})`,
          color: '#fff', fontSize: 14, fontWeight: 700,
          cursor: 'pointer', marginBottom: 6,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        }}
      >
        {enabledCount > 0
          ? `完成设置（${enabledCount}项）并上桌`
          : '跳过，直接上桌'}
      </button>
      {enabledCount > 0 && (
        <div style={{ fontSize: 10, color: ADV_FM.accent, textAlign: 'center' }}>
          设置后自动保存为你的个人模板
        </div>
      )}
    </div>
  );
}
