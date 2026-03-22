// ============================================================
// actionValidator — 单步动作检测 (对话推进协议 v1)
// 检查 AI 回复是否以"可回答的单步动作问题"收尾
// ============================================================

export type ActionCheckResult = { ok: boolean; reason?: string };

const QUESTION_END_RE = /[？?]\s*$/;
const HAS_CHOICE_RE =
  /(是还是|要不要|可不可以|能不能|是否|A|B|1|2|二选一|选哪个|哪一个|给我一个数字|多少|几|愿不愿意)/i;
const MULTI_TASK_RE =
  /(1[\.\、]|2[\.\、]|首先|其次|然后|另外|再者|第一|第二|第三)/;
const ACTION_VERB_RE =
  /(告诉我|说一下|选|写下|给出|确认|决定|发我|回我|填|试试|先做)/;

export function hasSingleActionQuestion(text: string): ActionCheckResult {
  const t = (text || '').trim();
  if (!t) return { ok: false, reason: 'empty' };
  if (!QUESTION_END_RE.test(t))
    return { ok: false, reason: 'no_question_end' };
  if (!HAS_CHOICE_RE.test(t))
    return { ok: false, reason: 'no_answerable_pattern' };
  if (!ACTION_VERB_RE.test(t))
    return { ok: false, reason: 'no_action_verb' };
  if (MULTI_TASK_RE.test(t))
    return { ok: false, reason: 'possible_multi_tasks' };
  return { ok: true };
}
