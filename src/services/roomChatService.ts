import type { Room, RoomMessage, CharacterId, CharacterResponse, TemperatureConfig, ConflictScenario } from '../types/room';
import { CHARACTER_MAP } from '../characters';
import { routeCharacters } from './characterRouter';
import { callChat, cleanResponse } from './apiClient';
import { SEED_SCENARIOS } from '../data/scenarios';

// ========= P0 新服务集成 =========
import {
  initRoomState, onCharacterSpoke, onUserMessage,
  onConflict as stateOnConflict, updateRoomHeat,
  getStatePromptInjection, getHeatPromptInjection,
  getCharacterState, getRoomHeat,
} from './stateService';
import {
  initMemory, extractAndStoreMemories,
  getMemoryPromptInjection,
} from './memoryService';
import {
  initRelationships,
  onConflict as relOnConflict, onAgreement as relOnAgreement,
  onUserSupport, onUserOppose, onInteraction,
  getRelationPromptInjection,
} from './relationshipService';
import { detectUserStance, detectCharacterInteractions } from './stanceDetector';
// ========= P1 事件引擎 =========
import {
  checkAndTriggerEvents, consumeInjectionsForCharacter,
} from './eventEngine';
// ========= P2 用户身份系统 =========
import {
  onUserMessage as identityOnUserMessage,
  recordStance,
  getUserPromptForCharacter,
} from './userIdentityService';

// ============================================================
// 角色间关系描述（静态基础，动态关系由 relationshipService 管理）
// ============================================================

const CHARACTER_RELATIONSHIPS: Partial<Record<CharacterId, Partial<Record<CharacterId, string>>>> = {
  aqiang: {
    gailv: '你看不起概率哥的纸上谈兵，但他的数据有时候让你心虚',
    kellyprof: '教授说的你根本听不懂，这让你烦躁',
    junshi: '你嘴上不服军师，但内心认他有料',
    laoliu: '老刘的下场让你害怕，但你嘴上不会承认',
    xiaofang: '小芳骂你的时候你理亏，因为你老婆也这么骂过你',
    dashiwang: '大师王吹的你半信半疑——你总觉得也许真有方法',
    ajie: '阿杰说的内幕让你不舒服，因为你不想相信赌场在搞你',
  },
  gailv: {
    aqiang: '阿强的经验论让你抓狂——2+2=4他还跟你犟',
    kellyprof: '教授是你的学术同盟，但你更接地气',
    junshi: '军师是你认可的权威，你愿意给他补充数据',
    laoliu: '老刘的遭遇验证了你的理论，但你不知道该怎么安慰他',
    dashiwang: '大师王的话每句都让你想翻白眼——你能一秒拆穿',
    xiaotian: '小甜的客服话术你一眼看穿，但你懒得跟她纠缠',
  },
  junshi: {
    aqiang: '你尊重阿强的经验，但必须纠正他的数学错误',
    gailv: '概率哥的数据你认可，但他忽略了人性因素',
    dashiwang: '拆穿大师王时你犀利但有据，不带情绪',
    laoliu: '老刘的故事让你心软，你会放下架子说人话',
    xiaofang: '小芳代表的家属视角你很重视，她说的比数据更有力',
    laozhang: '戒赌老张的经验你尊重——你知道理论和实践不同',
  },
  ajie: {
    aqiang: '你见过太多阿强这样的赌客——在赌场里赢了吹输了骂，最后一样输光',
    xiaotian: '小甜的话术你门清——你当年就是帮赌场说这些话的人',
    dashiwang: '大师王你一眼看穿——又来了，又一个骗子',
    gailv: '概率哥的数据你认同，但你知道赌场的黑不是数学能算清的',
  },
  laoliu: {
    aqiang: '阿强现在就是三年前的你——你想拉他一把但知道拉不住',
    xiaofang: '小芳说的话让你最痛——因为你老婆说过一模一样的话',
    laozhang: '老张是你的目标——你想像他一样上岸',
    dashiwang: '你恨大师王——就是这种人让你越陷越深',
  },
  xiaofang: {
    aqiang: '你恨阿强这种人——赢了吹牛输了回家骗老婆',
    laoliu: '老刘让你心疼又害怕——你老公可能就在走他的路',
    laozhang: '老张给你希望——也许你老公也能戒',
    dashiwang: '大师王你恨得牙痒——害了多少家庭',
    junshi: '军师是你最信任的——客观冷静，不偏不倚',
  },
  laozhang: {
    aqiang: '阿强让你看到曾经的自己——你不劝他，只是看着',
    laoliu: '老刘是你最心疼的人——你差点就是他',
    xiaofang: '小芳让你想起你老婆——当年她也这么崩溃过',
    junshi: '军师说的道理你都认——但你知道光靠道理戒不了',
  },
  // P0补全：之前缺失的3个角色关系
  dashiwang: {
    junshi: '军师是你最怕的人——他总能把你的话术拆穿，你尽量避开他',
    gailv: '概率哥老拿数据拆你台——但他影响力没军师大，你可以忽略',
    aqiang: '阿强是你最好的目标客户——半信半疑最容易上钩',
    laoliu: '老刘这种人你见多了——输光了才来骂你，当初不也信了？',
    ajie: '阿杰知道太多内幕，你不喜欢他在——他一开口你就被动',
    xiaotian: '小甜是你的同行——虽然路数不同，但你们本质上一样',
  },
  xiaotian: {
    ajie: '阿杰你最恨——他以前在赌场干过，总揭你底，让你很难收场',
    dashiwang: '大师王和你虽然都是"坏人"，但他太高调了——你更讲究润物细无声',
    aqiang: '阿强是好客户——只要给够优惠，他还会回来充值的',
    junshi: '军师一出场你就得小心——他拆话术太专业了',
    gailv: '概率哥的数据对你威胁不大——普通用户听不懂他说的',
  },
  kellyprof: {
    gailv: '概率哥是你的得力学生——数据功底扎实，只是还缺点学术严谨',
    aqiang: '阿强让你真诚困惑——你不理解怎么有人不信数学',
    junshi: '军师的分析很好，但你觉得他有时候太考虑人性了——数学不需要考虑人性',
    dashiwang: '大师王的存在让你愤怒——他在用伪科学污染公众认知',
    laoliu: '老刘的故事让你不舒服——你不擅长处理情绪化的场面',
  },
};

// ============================================================
// 角色口语化模式（强化辨识度）
// ============================================================

const SPEECH_PATTERNS: Partial<Record<CharacterId, string>> = {
  aqiang: '【口语习惯】你常用：卧槽、老子、你算个屁、我跟你说、真的假的、懂不懂。句末常加语气词。不用书面语。',
  gailv: '【口语习惯】你常用：统计学上、期望值、置信度、独立事件、从数据看。偶尔带点嘲讽："你连这个都不知道？"',
  junshi: '【口语习惯】你常用军事类比：阵地、火力、撤退、战损比、侦察。偶尔犀利："兄弟 你这叫主动送人头。"',
  ajie: '【口语习惯】你常用：呵呵、懂的都懂、我不能说太多、你自己悟吧、嗯。说话点到为止，多用省略号。',
  laoliu: '【口语习惯】你说话慢，多用省略号停顿。偶尔突然激动。常用：我当年...、别提了...、说实话...。',
  xiaofang: '【口语习惯】你情绪化，多用感叹号和问号。常用：你们赌的时候想过家里人吗！、我真的累了...、他又说最后一次。',
  dashiwang: '【口语习惯】你像微商+传销：限时免费！名额有限！跟上的都吃肉了！用大量感叹号和💰🔥之类的emoji。',
  kellyprof: '【口语习惯】你学术腔：从理论上讲、根据贝叶斯定理、统计显著性、p值。对"感觉"真诚困惑。',
  xiaotian: '【口语习惯】你是甜美客服腔：亲~、您好呢、我们平台很重视您~。所有问题都往"优惠活动"引导。',
  laozhang: '【口语习惯】你平和缓慢，像老朋友聊天。常用：我也不知道...、反正我是...、你自己看着办。偶尔自嘲。',
};

// ============================================================
// 房间服务初始化追踪（确保每个房间只初始化一次）
// ============================================================

const initializedRooms = new Set<string>();

function ensureRoomInitialized(room: Room): void {
  if (initializedRooms.has(room.id)) return;
  initRoomState(room.id, room.characters);
  initMemory(room.id);
  initRelationships(room.id, room.characters);
  initializedRooms.add(room.id);
}

// ============================================================
// 构建角色 system prompt（增强版：10层上下文注入）
// ============================================================

function buildCharacterSystemPrompt(
  charId: CharacterId,
  temp: TemperatureConfig,
  room: Room,
  scenario: ConflictScenario | null,
  previousResponses?: Array<{ charId: CharacterId; text: string }>,
): string {
  const charDef = CHARACTER_MAP[charId];
  if (!charDef) return '';

  let prompt = charDef.systemPrompt;

  // ========= 层1：口语模式 =========
  const speechPattern = SPEECH_PATTERNS[charId];
  if (speechPattern) {
    prompt += `\n\n${speechPattern}`;
  }

  // ========= 层2：静态关系描述 =========
  const myRelations = CHARACTER_RELATIONSHIPS[charId];
  if (myRelations) {
    const activeRelations = room.characters
      .filter(c => c !== charId && myRelations[c])
      .map(c => `- ${CHARACTER_MAP[c]?.shortName || c}：${myRelations[c]}`)
      .join('\n');
    if (activeRelations) {
      prompt += `\n\n【你和其他人的背景关系】\n${activeRelations}`;
    }
  }

  // ========= 层2.5：结构化动机与禁忌 =========
  if (charDef.motivation || charDef.taboos?.length) {
    let motBlock = '【你的核心驱动】';
    motBlock += `\n- 动机: ${charDef.motivation}`;
    if (charDef.innerConflict) {
      motBlock += `\n- 内心矛盾: ${charDef.innerConflict}`;
    }
    if (charDef.taboos?.length > 0) {
      motBlock += `\n- 绝对禁忌（硬闸门）:\n${charDef.taboos.map(t => `  ✗ ${t}`).join('\n')}`;
    }
    prompt += `\n\n${motBlock}`;
  }

  // ========= 层3：温度状态 =========
  prompt += `\n\n【你当前的状态】
- 强烈度: ${temp.intensity}/10 ${temp.intensity >= 8 ? '→ 你很激动，说话带情绪' : temp.intensity <= 3 ? '→ 你很温和克制' : ''}
- 理性度: ${temp.rationality}/10 ${temp.rationality >= 8 ? '→ 纯数据纯逻辑' : temp.rationality <= 3 ? '→ 凭感觉说话' : ''}
- 话密度: ${temp.verbosity}/10 ${temp.verbosity >= 8 ? '→ 话多，主动发言' : temp.verbosity <= 3 ? '→ 惜字如金，只说关键' : ''}
- 挑逗度: ${temp.provocation}/10 ${temp.provocation >= 8 ? '→ 主动挑衅、阴阳怪气' : temp.provocation <= 3 ? '→ 就事论事不针对人' : ''}
- 共情度: ${temp.empathy}/10 ${temp.empathy >= 8 ? '→ 关心对方感受' : temp.empathy <= 3 ? '→ 冷漠，只关心话题' : ''}`;

  // ========= 层4：房间上下文 =========
  const otherChars = room.characters
    .filter(c => c !== charId)
    .map(c => CHARACTER_MAP[c]?.shortName || c)
    .join('、');
  prompt += `\n\n【房间信息】
- 话题: ${room.topic}
- 房间里还有: ${otherChars || '没有其他角色'}
- 氛围: ${room.atmosphere === 'real' ? '真实（口语化、带情绪）' : room.atmosphere === 'rational' ? '理性（冷静分析）' : '混合'}`;

  // ========= 层5：场景提示 =========
  if (scenario) {
    prompt += `\n\n【当前争论话题】${scenario.topic}`;
    const opening = scenario.openingLines[charId];
    if (opening) {
      prompt += `\n你的立场参考: "${opening}"`;
    }
  }

  // ========= 层6：串行感知层 =========
  if (previousResponses && previousResponses.length > 0) {
    const prevLines = previousResponses
      .map(r => `[${CHARACTER_MAP[r.charId]?.shortName || r.charId}]: ${r.text}`)
      .join('\n');
    prompt += `\n\n【刚才其他角色的回复（你要针对性回应）】\n${prevLines}
你必须对上面的发言做出反应——可以反驳、补充、附和或嘲讽。不要忽视他们说的话。像真的群聊一样接话。`;
  }

  // ========= 🆕 层7：动态心理状态注入 =========
  const stateInjection = getStatePromptInjection(room.id, charId);
  if (stateInjection) {
    prompt += `\n\n${stateInjection}`;
  }

  // ========= 🆕 层8：动态关系感知 =========
  const relationInjection = getRelationPromptInjection(room.id, charId);
  if (relationInjection) {
    prompt += `\n\n${relationInjection}`;
  }

  // ========= 🆕 层9：记忆注入 =========
  const memoryInjection = getMemoryPromptInjection(room.id, charId);
  if (memoryInjection) {
    prompt += `\n\n${memoryInjection}`;
  }

  // ========= 🆕 层10：房间热度感知 =========
  const heatInjection = getHeatPromptInjection(room.id);
  if (heatInjection) {
    prompt += `\n\n${heatInjection}`;
  }

  // ========= 🆕 层11：事件引擎注入 =========
  const eventInjections = consumeInjectionsForCharacter(room.id, charId);
  if (eventInjections.length > 0) {
    prompt += `\n\n【特殊情境（自然融入你的回复，不要生硬提起）】\n${eventInjections.join('\n')}`;
  }

  // ========= 🆕 层12：用户身份感知 =========
  const userProfileInjection = getUserPromptForCharacter(charId);
  if (userProfileInjection) {
    prompt += `\n\n${userProfileInjection}`;
  }

  // 群聊格式提醒（增强版）
  prompt += `\n\n【重要】你在群聊中回复。
- 保持简短自然（1-4句），像在微信群里发消息
- 不要写标题，不要写长文，不要用markdown格式
- 直接说你想说的话，用你自己的说话方式
- 如果有人刚说了话，你要接着聊，不要自说自话
- 绝对不要以"[角色名]:"开头`;

  return prompt;
}

// ============================================================
// 构建聊天历史 (RoomMessage[] → OpenAI messages)
// ============================================================

function buildChatHistory(
  messages: RoomMessage[],
): Array<{ role: string; content: string }> {
  return messages
    .filter(m => m.role !== 'system')
    .map(msg => {
      if (msg.role === 'user') {
        return { role: 'user' as const, content: msg.text };
      }
      const name = msg.characterId ? (CHARACTER_MAP[msg.characterId]?.shortName || msg.characterId) : '未知';
      return { role: 'assistant' as const, content: `[${name}]: ${msg.text}` };
    });
}

// ============================================================
// RAG 上下文获取（仅军师）
// ============================================================

async function fetchRAGContext(query: string): Promise<string> {
  try {
    const res = await fetch('/api/rag', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, topK: 5 }),
    });
    if (!res.ok) return '';
    const data = await res.json();
    if (!data.results || data.results.length === 0) return '';

    const chunks = data.results
      .map((r: { text: string; score: number }) => r.text)
      .join('\n\n');
    return `\n\n【知识库参考（仅供参考，用你自己的话说）】\n${chunks}`;
  } catch {
    return '';
  }
}

// ============================================================
// 截断修复
// ============================================================

function fixTruncatedResponse(text: string): string {
  if (!text) return text;
  const trimmed = text.trim();
  const normalEndings = /[。！？…~\.\!\?\)）」』"']$/;
  if (normalEndings.test(trimmed)) return trimmed;
  const lastChar = trimmed[trimmed.length - 1];
  if (/[a-zA-Z0-9\u4e00-\u9fff]/.test(lastChar)) {
    return trimmed + '…';
  }
  return trimmed;
}

// ============================================================
// 🥇 主函数：串行感知式多角色回复（集成状态/记忆/关系/站队）
// ============================================================

export async function sendRoomMessage(
  room: Room,
  userMessage: string,
): Promise<CharacterResponse[]> {
  // 🆕 确保服务初始化
  ensureRoomInitialized(room);

  // 1. 路由决策（传入 roomId 启用加权评分路由）
  const decision = routeCharacters(
    userMessage,
    room.characters,
    room.messages.slice(-20),
    room.id,
  );

  if (decision.respondingCharacters.length === 0) {
    return [];
  }

  // 🆕 2. 用户消息处理：更新状态 + 检测站队 + 用户身份
  onUserMessage(room.id, userMessage, room.characters);
  identityOnUserMessage(room.id, userMessage, room.characters);
  updateRoomHeat(room.id, room.messages);

  // 站队检测
  const recentCharMsgs = room.messages
    .filter(m => m.role === 'character' && m.characterId)
    .slice(-5)
    .map(m => ({ characterId: m.characterId!, text: m.text }));

  const stance = detectUserStance(userMessage, room.characters, recentCharMsgs);

  // 根据站队更新关系 + 用户身份
  if (stance.confidence >= 0.4 && stance.targetCharacter) {
    if (stance.type === 'support') {
      onUserSupport(room.id, stance.targetCharacter, `用户表示支持：${userMessage.slice(0, 30)}`);
    } else if (stance.type === 'oppose') {
      onUserOppose(room.id, stance.targetCharacter, `用户表示反对：${userMessage.slice(0, 30)}`);
    }
    // 记录到用户身份系统
    recordStance(stance.type, stance.targetCharacter);
  } else if (stance.type !== 'neutral') {
    recordStance(stance.type);
  }

  // 3. 构建聊天历史
  const chatHistory = buildChatHistory(room.messages.slice(-20));

  // 4. 串行调用：后续角色能看到前面角色的回复
  const responses: CharacterResponse[] = [];
  const previousResponses: Array<{ charId: CharacterId; text: string }> = [];

  for (const charId of decision.respondingCharacters) {
    const charDef = CHARACTER_MAP[charId];
    if (!charDef) continue;

    const temp = room.characterTemps[charId] || charDef.defaultTemp;

    // 构建 system prompt（10层注入）
    let systemPrompt = buildCharacterSystemPrompt(
      charId, temp, room, decision.scenario,
      previousResponses.length > 0 ? previousResponses : undefined,
    );

    // 军师专用 RAG
    if (charDef.ragEnabled) {
      const ragContext = await fetchRAGContext(userMessage);
      if (ragContext) {
        systemPrompt += ragContext;
      }
    }

    // 动态 maxTokens + 回复长度指令（基于房间热度）
    const heat = getRoomHeat(room.id);
    const heatLevel = heat?.level || 'warm';
    let maxTokens = charDef.ragEnabled ? 600 : 500;
    let lengthHint = '';

    if (heatLevel === 'boiling' || heatLevel === 'hot') {
      // 热场：短回复，节奏快
      maxTokens = charDef.ragEnabled ? 400 : 300;
      lengthHint = '\n【节奏提示】当前讨论很激烈，请保持简短有力（1-2句），像群聊里抢话一样快速回应。';
    } else if (heatLevel === 'cold') {
      // 冷场：长回复，展开话题
      maxTokens = charDef.ragEnabled ? 700 : 600;
      lengthHint = '\n【节奏提示】现在房间比较安静，你可以多说几句（3-5句），展开你的观点，抛出新角度吸引别人讨论。';
    }
    // warm: 保持默认，不注入额外指令

    if (lengthHint) {
      systemPrompt += lengthHint;
    }

    // 构建当前聊天历史（加入前面角色的回复）
    const currentHistory = [...chatHistory];
    for (const prev of previousResponses) {
      const prevName = CHARACTER_MAP[prev.charId]?.shortName || prev.charId;
      currentHistory.push({ role: 'assistant', content: `[${prevName}]: ${prev.text}` });
    }

    try {
      const result = await callChat(
        systemPrompt,
        currentHistory,
        0.75,
        'gpt-4.1-mini',
        maxTokens,
      );

      const cleanedText = fixTruncatedResponse(cleanResponse(result.text));

      if (cleanedText) {
        responses.push({
          characterId: charId,
          text: cleanedText,
          status: 'fulfilled',
        });
        previousResponses.push({ charId, text: cleanedText });

        // 🆕 更新角色状态
        onCharacterSpoke(room.id, charId, cleanedText);
      }
    } catch (err) {
      console.warn(`Character ${charId} failed:`, err);
    }
  }

  // 🆕 5. 后处理：角色间互动分析 + 关系/记忆更新
  if (responses.length >= 2) {
    const charMessages = responses.map(r => ({
      characterId: r.characterId,
      text: r.text,
    }));

    // 检测角色间的冲突和同意
    const interactions = detectCharacterInteractions(charMessages);
    for (const interaction of interactions) {
      if (interaction.type === 'conflict') {
        relOnConflict(room.id, interaction.charA, interaction.charB, interaction.evidence);
        stateOnConflict(room.id, interaction.charA, interaction.charB);
      } else if (interaction.type === 'agreement') {
        relOnAgreement(room.id, interaction.charA, interaction.charB, interaction.evidence);
      }
      // 记录互动
      onInteraction(room.id, interaction.charA, interaction.charB);
    }
  }

  // 🆕 提取记忆
  const newMessages: RoomMessage[] = [
    { id: 'user-temp', role: 'user', text: userMessage, timestamp: new Date().toISOString() },
    ...responses.map(r => ({
      id: `char-temp-${r.characterId}`,
      role: 'character' as const,
      characterId: r.characterId,
      text: r.text,
      timestamp: new Date().toISOString(),
    })),
  ];
  extractAndStoreMemories(room.id, newMessages, room.characters);

  // 更新房间热度（包含新消息）
  updateRoomHeat(room.id, [...room.messages, ...newMessages]);

  // 🆕 6. 触发事件引擎（为下一轮准备 prompt injections）
  const heat = getRoomHeat(room.id);
  checkAndTriggerEvents(room.id, [...room.messages, ...newMessages], room.characters, {
    userStance: stance,
    heatLevel: heat?.level,
  });

  return responses;
}

// ============================================================
// 防冷场：角色主动发言（集成状态/关系感知）
// ============================================================

function findRelevantScenario(room: Room): ConflictScenario | null {
  const candidates = SEED_SCENARIOS.filter(s => {
    const inRoom = s.characters.filter(c => room.characters.includes(c as CharacterId));
    return inRoom.length >= 2;
  });
  if (candidates.length === 0) return null;

  const recentText = room.messages.slice(-30).map(m => m.text).join(' ');
  const unused = candidates.filter(s =>
    !s.triggerKeywords.some(kw => recentText.includes(kw)),
  );

  const pool = unused.length > 0 ? unused : candidates;
  return pool[Math.floor(Math.random() * pool.length)];
}

export async function generateAutoChat(room: Room): Promise<CharacterResponse[]> {
  if (room.characters.length < 2) return [];

  // 🆕 确保服务初始化
  ensureRoomInitialized(room);

  const scenario = findRelevantScenario(room);

  // 选发起角色（优先精力高 + 非军师非教授）
  const activeChars = room.characters.filter(c => c !== 'junshi' && c !== 'kellyprof');

  // 🆕 按精力和参与度排序，精力高的优先发起
  let initiator: CharacterId;
  const charStates = activeChars.map(c => ({
    id: c,
    state: getCharacterState(room.id, c),
  }));
  const sortedByEnergy = charStates.sort((a, b) => {
    const aEnergy = a.state?.mood.energy ?? 50;
    const bEnergy = b.state?.mood.energy ?? 50;
    return bEnergy - aEnergy;
  });
  initiator = sortedByEnergy.length > 0
    ? sortedByEnergy[0].id
    : room.characters[Math.floor(Math.random() * room.characters.length)];

  // 选回应角色（跟发起者有冲突关系的优先）
  const initiatorDef = CHARACTER_MAP[initiator];
  const conflicts = initiatorDef?.conflictTargets?.filter(c => room.characters.includes(c as CharacterId)) || [];
  const responder = conflicts.length > 0
    ? conflicts[Math.floor(Math.random() * conflicts.length)] as CharacterId
    : room.characters.filter(c => c !== initiator)[Math.floor(Math.random() * (room.characters.length - 1))];

  if (!responder) return [];

  const chatHistory = buildChatHistory(room.messages.slice(-15));
  const responses: CharacterResponse[] = [];

  // 冷场判断（影响发起者和回应者的回复长度）
  const autoHeat = getRoomHeat(room.id);
  const autoCold = !autoHeat || autoHeat.level === 'cold';
  const autoMaxTokens = autoCold ? 500 : 300;

  // 发起者先说
  {
    const charDef = CHARACTER_MAP[initiator];
    if (!charDef) return [];

    const temp = room.characterTemps[initiator] || charDef.defaultTemp;
    let systemPrompt = buildCharacterSystemPrompt(initiator, temp, room, scenario);

    systemPrompt += `\n\n【特殊指令】房间安静了一会儿。你要主动抛一个话题或者挑起一个讨论。`;
    if (scenario) {
      const opening = scenario.openingLines[initiator];
      if (opening) {
        systemPrompt += `\n参考话术: "${opening}"（用你自己的话说，不要原样照搬）`;
      } else {
        systemPrompt += `\n话题方向: ${scenario.topic}`;
      }
    }
    systemPrompt += `\n不要说"大家怎么不说话了"之类的元叙事。直接抛出你想聊的内容。`;

    if (autoCold) {
      systemPrompt += `\n现在房间很安静，你可以多展开一些（2-4句），抛出有争议的观点来吸引别人回应。`;
    } else {
      systemPrompt += `\n保持1-2句，自然随意。`;
    }

    try {
      const result = await callChat(systemPrompt, chatHistory, 0.85, 'gpt-4.1-mini', autoMaxTokens);
      const text = fixTruncatedResponse(cleanResponse(result.text));
      if (text) {
        responses.push({ characterId: initiator, text, status: 'fulfilled' });
        onCharacterSpoke(room.id, initiator, text);
      }
    } catch (err) {
      console.warn(`Auto-chat initiator ${initiator} failed:`, err);
      return [];
    }
  }

  // 回应者接话（串行感知）
  if (responses.length > 0) {
    const charDef = CHARACTER_MAP[responder];
    if (!charDef) return responses;

    const temp = room.characterTemps[responder] || charDef.defaultTemp;
    let systemPrompt = buildCharacterSystemPrompt(
      responder, temp, room, scenario,
      [{ charId: initiator, text: responses[0].text }],
    );

    if (autoCold) {
      systemPrompt += `\n\n【特殊指令】上面那条是另一个角色刚说的，你要自然地接话、补充或反驳。可以多说几句（2-4句）。`;
    } else {
      systemPrompt += `\n\n【特殊指令】上面那条是另一个角色刚说的，你要自然地接话、补充或反驳。保持1-2句。`;
    }

    const responderHistory = [
      ...chatHistory,
      { role: 'assistant', content: `[${CHARACTER_MAP[initiator]?.shortName}]: ${responses[0].text}` },
    ];

    try {
      const result = await callChat(systemPrompt, responderHistory, 0.85, 'gpt-4.1-mini', autoMaxTokens);
      const text = fixTruncatedResponse(cleanResponse(result.text));
      if (text) {
        responses.push({ characterId: responder, text, status: 'fulfilled' });
        onCharacterSpoke(room.id, responder, text);
      }
    } catch (err) {
      console.warn(`Auto-chat responder ${responder} failed:`, err);
    }
  }

  // 🆕 分析自动对话中的互动
  if (responses.length >= 2) {
    const interactions = detectCharacterInteractions(
      responses.map(r => ({ characterId: r.characterId, text: r.text }))
    );
    for (const i of interactions) {
      if (i.type === 'conflict') {
        relOnConflict(room.id, i.charA, i.charB, i.evidence);
        stateOnConflict(room.id, i.charA, i.charB);
      } else {
        relOnAgreement(room.id, i.charA, i.charB, i.evidence);
      }
    }

    // 提取记忆
    const newMsgs: RoomMessage[] = responses.map(r => ({
      id: `auto-${r.characterId}`,
      role: 'character' as const,
      characterId: r.characterId,
      text: r.text,
      timestamp: new Date().toISOString(),
    }));
    extractAndStoreMemories(room.id, newMsgs, room.characters);
  }

  return responses;
}
