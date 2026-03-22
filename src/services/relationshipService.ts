import type { CharacterId, RelationEdge, RelationshipGraph } from '../types/room';
import { CHARACTER_MAP } from '../characters';

// ============================================================
// 博弈圆桌 — 动态关系图谱服务
// 管理角色间 & 用户↔角色 的动态数值关系，随对话演化
// ============================================================

// ============================================================
// 工具函数
// ============================================================

/** 生成唯一ID */
function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 6);
}

/** 数值钳制 */
function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

/** 关系边的key格式 */
function edgeKey(source: string, target: string): string {
  return `${source}->${target}`;
}

/** localStorage 存储key */
function storageKey(roomId: string): string {
  return `roundtable_relations_${roomId}`;
}

/** 创建默认关系边 */
function defaultEdge(overrides?: Partial<RelationEdge>): RelationEdge {
  return {
    affinity: 0,
    trust: 20,
    tension: 0,
    recentEvents: [],
    interactionCount: 0,
    lastUpdated: new Date().toISOString(),
    ...overrides,
  };
}

// ============================================================
// 订阅/通知模式
// ============================================================

type RelationshipListener = (roomId: string, graph: RelationshipGraph) => void;
const listeners: Set<RelationshipListener> = new Set();

/** 订阅关系图变化 */
export function subscribeRelationships(fn: RelationshipListener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** 通知所有订阅者 */
function notify(roomId: string): void {
  const graph = getGraph(roomId);
  if (!graph) return;
  listeners.forEach(fn => {
    try { fn(roomId, graph); } catch (e) { console.warn('[RelationshipService] 订阅者回调出错:', e); }
  });
}

// ============================================================
// 内存缓存 + localStorage 持久化
// ============================================================

const graphCache: Map<string, RelationshipGraph> = new Map();

/** 从 localStorage 加载 */
function loadGraph(roomId: string): RelationshipGraph | null {
  // 优先内存缓存
  const cached = graphCache.get(roomId);
  if (cached) return cached;

  try {
    const raw = localStorage.getItem(storageKey(roomId));
    if (raw) {
      const parsed = JSON.parse(raw) as RelationshipGraph;
      graphCache.set(roomId, parsed);
      return parsed;
    }
  } catch (e) {
    console.warn('[RelationshipService] 加载关系图失败:', e);
  }
  return null;
}

/** 持久化到 localStorage */
function saveGraph(roomId: string, graph: RelationshipGraph): void {
  graphCache.set(roomId, graph);
  try {
    localStorage.setItem(storageKey(roomId), JSON.stringify(graph));
  } catch (e) {
    console.warn('[RelationshipService] 保存关系图失败:', e);
  }
}

// ============================================================
// 角色间初始关系表（硬编码，基于人设）
// ============================================================

interface InitialRelation {
  a: CharacterId;
  b: CharacterId;
  affinity: number;
  trust: number;
  tension: number;
  note: string; // 关系备注
}

const INITIAL_RELATIONS: InitialRelation[] = [
  // 阿强 ↔ 概率哥：经验vs数据，天然对立
  { a: 'aqiang', b: 'gailv', affinity: -30, trust: 20, tension: 70, note: '经验vs数据，天然对立' },
  // 阿强 ↔ 军师：嘴上不服但认可
  { a: 'aqiang', b: 'junshi', affinity: 20, trust: 40, tension: 40, note: '嘴上不服但认可' },
  // 阿强 ↔ 老刘：同病相怜
  { a: 'aqiang', b: 'laoliu', affinity: 30, trust: 30, tension: 20, note: '同病相怜' },
  // 阿强 ↔ 大师王：半信半疑
  { a: 'aqiang', b: 'dashiwang', affinity: 10, trust: 15, tension: 50, note: '半信半疑' },
  // 概率哥 ↔ Kelly教授：学术同盟
  { a: 'gailv', b: 'kellyprof', affinity: 50, trust: 60, tension: 10, note: '学术同盟' },
  // 概率哥 ↔ 大师王：看不起骗子
  { a: 'gailv', b: 'dashiwang', affinity: -60, trust: 0, tension: 80, note: '看不起骗子' },
  // 军师 ↔ 大师王：正义vs欺诈
  { a: 'junshi', b: 'dashiwang', affinity: -40, trust: 0, tension: 60, note: '正义vs欺诈' },
  // 军师 ↔ 老刘：心软同情
  { a: 'junshi', b: 'laoliu', affinity: 40, trust: 50, tension: 10, note: '心软同情' },
  // 军师 ↔ 老张：相互尊重
  { a: 'junshi', b: 'laozhang', affinity: 50, trust: 60, tension: 5, note: '相互尊重' },
  // 老刘 ↔ 小芳：同命相怜但触痛
  { a: 'laoliu', b: 'xiaofang', affinity: 40, trust: 50, tension: 30, note: '同命相怜但触痛' },
  // 老刘 ↔ 大师王：恨骗子
  { a: 'laoliu', b: 'dashiwang', affinity: -70, trust: 0, tension: 90, note: '恨骗子' },
  // 小芳 ↔ 阿强：恨赌徒
  { a: 'xiaofang', b: 'aqiang', affinity: -40, trust: 10, tension: 70, note: '恨赌徒' },
  // 小芳 ↔ 老张：希望
  { a: 'xiaofang', b: 'laozhang', affinity: 50, trust: 60, tension: 5, note: '希望' },
  // 小甜 ↔ 阿杰：前同事对立
  { a: 'xiaotian', b: 'ajie', affinity: -30, trust: 5, tension: 75, note: '前同事对立' },
  // 阿杰 ↔ 大师王：一眼看穿
  { a: 'ajie', b: 'dashiwang', affinity: -50, trust: 0, tension: 80, note: '一眼看穿' },
];

// ============================================================
// 1. 初始化房间关系图
// ============================================================

/**
 * 初始化房间的关系图
 * 只为房间内同时存在的角色对建立关系边
 * 用户→角色关系统一初始化为中性值
 */
export function initRelationships(roomId: string, characters: CharacterId[]): RelationshipGraph {
  const graph: RelationshipGraph = {};
  const charSet = new Set(characters);

  // 角色间关系：遍历初始关系表，只初始化房间内都有的角色对
  for (const rel of INITIAL_RELATIONS) {
    if (charSet.has(rel.a) && charSet.has(rel.b)) {
      // 双向建立（A→B 和 B→A 用相同初始值）
      const keyAB = edgeKey(rel.a, rel.b);
      const keyBA = edgeKey(rel.b, rel.a);
      graph[keyAB] = defaultEdge({
        affinity: rel.affinity,
        trust: rel.trust,
        tension: rel.tension,
      });
      graph[keyBA] = defaultEdge({
        affinity: rel.affinity,
        trust: rel.trust,
        tension: rel.tension,
      });
    }
  }

  // 对于房间内有的角色对但没有预设关系的，初始化为中性
  for (const a of characters) {
    for (const b of characters) {
      if (a === b) continue;
      const key = edgeKey(a, b);
      if (!graph[key]) {
        graph[key] = defaultEdge();
      }
    }
  }

  // 用户→角色关系：全部初始化为中性观察状态
  for (const charId of characters) {
    graph[edgeKey('user', charId)] = defaultEdge({
      affinity: 0,
      trust: 20,
      tension: 0,
    });
  }

  saveGraph(roomId, graph);
  notify(roomId);
  return graph;
}

// ============================================================
// 2. 获取单条关系边
// ============================================================

/** 获取 source→target 的关系边，不存在则返回 null */
export function getRelation(roomId: string, sourceId: string, targetId: string): RelationEdge | null {
  const graph = loadGraph(roomId);
  if (!graph) return null;
  return graph[edgeKey(sourceId, targetId)] ?? null;
}

// ============================================================
// 3. 获取完整关系图
// ============================================================

/** 获取房间的完整关系图 */
export function getGraph(roomId: string): RelationshipGraph | null {
  return loadGraph(roomId);
}

// ============================================================
// 4. 获取用户的所有关系
// ============================================================

/** 获取所有 user→character 的关系边 */
export function getUserRelations(roomId: string): Record<string, RelationEdge> {
  const graph = loadGraph(roomId);
  if (!graph) return {};

  const result: Record<string, RelationEdge> = {};
  for (const [key, edge] of Object.entries(graph)) {
    if (key.startsWith('user->')) {
      result[key] = edge;
    }
  }
  return result;
}

// ============================================================
// 内部：安全更新关系边
// ============================================================

/**
 * 安全地修改一条关系边
 * 如果边不存在则自动创建默认边
 */
function mutateEdge(
  graph: RelationshipGraph,
  source: string,
  target: string,
  mutator: (edge: RelationEdge) => void,
): void {
  const key = edgeKey(source, target);
  if (!graph[key]) {
    graph[key] = defaultEdge();
  }
  mutator(graph[key]);
  // 钳制数值范围
  graph[key].affinity = clamp(graph[key].affinity, -100, 100);
  graph[key].trust = clamp(graph[key].trust, 0, 100);
  graph[key].tension = clamp(graph[key].tension, 0, 100);
  graph[key].lastUpdated = new Date().toISOString();
}

/** 往 recentEvents 添加事件（保留最多5条） */
function pushEvent(edge: RelationEdge, description: string): void {
  edge.recentEvents.push(description);
  if (edge.recentEvents.length > 5) {
    edge.recentEvents = edge.recentEvents.slice(-5);
  }
}

// ============================================================
// 5. 冲突事件：两角色发生争吵
// ============================================================

/**
 * 角色A和角色B发生冲突
 * 好感降低、张力升高、信任降低
 */
export function onConflict(roomId: string, charA: string, charB: string, description: string): void {
  const graph = loadGraph(roomId);
  if (!graph) return;

  // A→B
  mutateEdge(graph, charA, charB, (edge) => {
    edge.affinity -= 5;
    edge.tension += 10;
    edge.trust -= 3;
    edge.interactionCount++;
    pushEvent(edge, description);
  });

  // B→A
  mutateEdge(graph, charB, charA, (edge) => {
    edge.affinity -= 5;
    edge.tension += 10;
    edge.trust -= 3;
    edge.interactionCount++;
    pushEvent(edge, description);
  });

  saveGraph(roomId, graph);
  notify(roomId);
}

// ============================================================
// 6. 共识事件：两角色达成一致
// ============================================================

/**
 * 角色A和角色B达成共识
 * 好感升高、信任升高、张力降低
 */
export function onAgreement(roomId: string, charA: string, charB: string, description: string): void {
  const graph = loadGraph(roomId);
  if (!graph) return;

  // A→B
  mutateEdge(graph, charA, charB, (edge) => {
    edge.affinity += 8;
    edge.trust += 5;
    edge.tension -= 10;
    edge.interactionCount++;
    pushEvent(edge, description);
  });

  // B→A
  mutateEdge(graph, charB, charA, (edge) => {
    edge.affinity += 8;
    edge.trust += 5;
    edge.tension -= 10;
    edge.interactionCount++;
    pushEvent(edge, description);
  });

  saveGraph(roomId, graph);
  notify(roomId);
}

// ============================================================
// 7. 用户支持某角色
// ============================================================

/**
 * 用户支持了某角色
 * - user→target 好感+10、信任+5
 * - target 的对立角色：user→rival 张力+5
 * 返回被影响的对立角色列表（供 stateService 使用）
 */
export function onUserSupport(
  roomId: string,
  targetChar: CharacterId,
  description: string,
): { rivalCharacters: CharacterId[] } {
  const graph = loadGraph(roomId);
  if (!graph) return { rivalCharacters: [] };

  // user→target: 好感+10, 信任+5
  mutateEdge(graph, 'user', targetChar, (edge) => {
    edge.affinity += 10;
    edge.trust += 5;
    edge.interactionCount++;
    pushEvent(edge, description);
  });

  // 找到 target 的对立角色（来自 CharacterDefinition.conflictTargets）
  const charDef = CHARACTER_MAP[targetChar];
  const rivals: CharacterId[] = [];

  if (charDef?.conflictTargets) {
    for (const rivalId of charDef.conflictTargets) {
      const rivalKey = edgeKey('user', rivalId);
      // 只影响房间内存在的角色关系
      if (graph[rivalKey]) {
        mutateEdge(graph, 'user', rivalId, (edge) => {
          edge.tension += 5;
        });
        rivals.push(rivalId);
      }
    }
  }

  saveGraph(roomId, graph);
  notify(roomId);
  return { rivalCharacters: rivals };
}

// ============================================================
// 8. 用户反对某角色
// ============================================================

/**
 * 用户反对了某角色
 * - user→target 好感-8, 张力+10
 */
export function onUserOppose(roomId: string, targetChar: CharacterId, description: string): void {
  const graph = loadGraph(roomId);
  if (!graph) return;

  // user→target: 好感-8, 张力+10
  mutateEdge(graph, 'user', targetChar, (edge) => {
    edge.affinity -= 8;
    edge.tension += 10;
    edge.interactionCount++;
    pushEvent(edge, description);
  });

  saveGraph(roomId, graph);
  notify(roomId);
}

// ============================================================
// 9. 简单互动：同一轮发言
// ============================================================

/**
 * 角色A和角色B在同一轮发言（简单互动）
 * - interactionCount++
 * - 好感自然向0回归（正的-1，负的+1）
 */
export function onInteraction(roomId: string, charA: string, charB: string): void {
  const graph = loadGraph(roomId);
  if (!graph) return;

  // A→B
  mutateEdge(graph, charA, charB, (edge) => {
    edge.interactionCount++;
    // 好感自然向0回归
    if (edge.affinity > 0) {
      edge.affinity -= 1;
    } else if (edge.affinity < 0) {
      edge.affinity += 1;
    }
  });

  // B→A
  mutateEdge(graph, charB, charA, (edge) => {
    edge.interactionCount++;
    if (edge.affinity > 0) {
      edge.affinity -= 1;
    } else if (edge.affinity < 0) {
      edge.affinity += 1;
    }
  });

  saveGraph(roomId, graph);
  notify(roomId);
}

// ============================================================
// 10. 自然衰减：张力随时间冷却
// ============================================================

/**
 * 自然衰减 tick
 * - 张力 -2（自然冷却）
 * - 好感和信任保持稳定（需要事件驱动）
 */
export function decayRelationships(roomId: string): void {
  const graph = loadGraph(roomId);
  if (!graph) return;

  let changed = false;
  for (const [, edge] of Object.entries(graph)) {
    if (edge.tension > 0) {
      edge.tension = clamp(edge.tension - 2, 0, 100);
      edge.lastUpdated = new Date().toISOString();
      changed = true;
    }
  }

  if (changed) {
    saveGraph(roomId, graph);
    notify(roomId);
  }
}

// ============================================================
// 11. 生成关系 prompt 注入文本
// ============================================================

/** 好感度的自然语言描述 */
function affinityDesc(val: number): string {
  if (val >= 60) return '关系很好';
  if (val >= 30) return '有些好感';
  if (val >= 10) return '略有好感';
  if (val > -10) return '还在观察';
  if (val > -30) return '有点不爽';
  if (val > -60) return '不太喜欢';
  return '很讨厌';
}

/** 信任度的自然语言描述 */
function trustDesc(val: number): string {
  if (val >= 70) return '很信任';
  if (val >= 40) return '有一定信任';
  if (val >= 20) return '有点信任';
  return '不太信任';
}

/** 张力的自然语言描述 */
function tensionDesc(val: number): string {
  if (val >= 80) return '快要爆发了';
  if (val >= 60) return '很紧张';
  if (val >= 40) return '有些紧张';
  if (val >= 20) return '有点紧张';
  if (val >= 5) return '微妙';
  return '平静';
}

/**
 * 为指定角色生成关系感知 prompt
 * 返回自然语言描述，角色可以在对话中参考
 */
export function getRelationPromptInjection(roomId: string, charId: CharacterId): string {
  const graph = loadGraph(roomId);
  if (!graph) return '';

  const lines: string[] = [];

  // 收集该角色对其他所有目标的关系
  for (const [key, edge] of Object.entries(graph)) {
    // 匹配 charId->xxx 的关系边
    if (!key.startsWith(`${charId}->`)) continue;
    const targetId = key.split('->')[1];
    if (targetId === charId) continue; // 不含自己→自己

    // 获取目标显示名
    let targetName: string;
    if (targetId === 'user') {
      targetName = '用户';
    } else {
      targetName = CHARACTER_MAP[targetId]?.shortName || targetId;
    }

    // 构建自然语言描述
    const parts: string[] = [];
    parts.push(`${affinityDesc(edge.affinity)}(${edge.affinity})`);

    if (edge.tension >= 5) {
      parts.push(`${tensionDesc(edge.tension)}(${edge.tension})`);
    }

    parts.push(`${trustDesc(edge.trust)}(${edge.trust})`);

    lines.push(`- ${targetName}：${parts.join('，')}`);
  }

  // 也包含 user→charId 的关系（用户对该角色的态度）
  const userEdge = graph[edgeKey('user', charId)];
  if (userEdge) {
    const parts: string[] = [];
    parts.push(`${affinityDesc(userEdge.affinity)}(${userEdge.affinity})`);
    if (userEdge.tension >= 5) {
      parts.push(`${tensionDesc(userEdge.tension)}(${userEdge.tension})`);
    }
    parts.push(`${trustDesc(userEdge.trust)}(${userEdge.trust})`);
    lines.push(`- 用户：${parts.join('，')}`);
  }

  if (lines.length === 0) return '';

  return `【你对其他人的当前感觉】\n${lines.join('\n')}`;
}

// ============================================================
// 12. 获取高张力角色对
// ============================================================

/**
 * 返回张力超过阈值的角色对
 * 用于事件引擎判断是否触发冲突升级
 */
export function getHighTensionPairs(
  roomId: string,
  threshold: number = 60,
): Array<{ source: string; target: string; tension: number; edge: RelationEdge }> {
  const graph = loadGraph(roomId);
  if (!graph) return [];

  const pairs: Array<{ source: string; target: string; tension: number; edge: RelationEdge }> = [];
  const seen = new Set<string>(); // 避免A→B和B→A重复

  for (const [key, edge] of Object.entries(graph)) {
    if (edge.tension < threshold) continue;

    const [source, target] = key.split('->');
    // 去重：只保留字母序靠前的方向
    const pairKey = [source, target].sort().join('|');
    if (seen.has(pairKey)) continue;
    seen.add(pairKey);

    pairs.push({ source, target, tension: edge.tension, edge });
  }

  // 按张力从高到低排序
  return pairs.sort((a, b) => b.tension - a.tension);
}
