// ============================================================
// Session 状态机 Service
// 管理 session_plans 的状态流转和事件校验
// ============================================================

// 合法状态
export type SessionStatus = 'planned' | 'active' | 'paused' | 'ended' | 'cancelled';

// 合法事件类型
export type SessionEventType =
  | 'win' | 'loss' | 'bet_change' | 'pause' | 'resume'
  | 'emotion' | 'rule_change' | 'helper_action' | 'end' | 'cancel' | 'view';

// 增加 hand_index 的事件
const HAND_EVENTS: ReadonlySet<string> = new Set(['win', 'loss']);

// 每个状态允许接收的事件
const ALLOWED_EVENTS: Record<SessionStatus, ReadonlySet<string>> = {
  planned: new Set(['win', 'loss', 'bet_change', 'cancel', 'view']),
  active:  new Set(['win', 'loss', 'bet_change', 'pause', 'emotion', 'rule_change', 'helper_action', 'end', 'view']),
  paused:  new Set(['resume', 'end', 'view']),
  ended:   new Set(['view']),
  cancelled: new Set(['view']),
};

// 状态转移表：(currentStatus, eventType) → nextStatus
const TRANSITIONS: Record<string, SessionStatus> = {
  'planned:win':        'active',
  'planned:loss':       'active',
  'planned:bet_change': 'active',
  'planned:cancel':     'cancelled',
  'active:pause':       'paused',
  'active:end':         'ended',
  'paused:resume':      'active',
  'paused:end':         'ended',
};

/**
 * 检查状态转移是否合法
 */
export function validateTransition(currentStatus: SessionStatus, eventType: SessionEventType): boolean {
  return ALLOWED_EVENTS[currentStatus]?.has(eventType) ?? false;
}

/**
 * 获取事件触发后的下一状态，无变化时返回 currentStatus
 */
export function getNextStatus(currentStatus: SessionStatus, eventType: SessionEventType): SessionStatus {
  const key = `${currentStatus}:${eventType}`;
  return TRANSITIONS[key] ?? currentStatus;
}

/**
 * 检查 session 是否能接收该事件（不含 view）
 */
export function canAcceptEvent(sessionStatus: SessionStatus, eventType: SessionEventType): boolean {
  if (eventType === 'view') return true;
  return validateTransition(sessionStatus, eventType);
}

/**
 * 判断事件是否增加 hand_index
 */
export function isHandEvent(eventType: string): boolean {
  return HAND_EVENTS.has(eventType);
}
