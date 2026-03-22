import type { Room, RoomMessage, CharacterId, TemperatureConfig, AtmosphereMode, TempPreset, RoomPlanType } from '../types/room';
import { getDefaultTemp, TEMP_PRESETS } from '../characters';

const STORAGE_KEY = 'roundtable_rooms_v1';
const MAX_MESSAGES_PER_ROOM = 200;

// ============================================================
// Store
// ============================================================

export const roomStore = {
  rooms: [] as Room[],
  activeRoomId: null as string | null,
};

// 加载
function loadStore() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      roomStore.rooms = data.rooms || [];
      roomStore.activeRoomId = data.activeRoomId || null;
    }
  } catch (e) {
    console.error('Failed to load room store', e);
  }
}

// 保存
function saveStore() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      rooms: roomStore.rooms,
      activeRoomId: roomStore.activeRoomId,
    }));
  } catch (e) {
    console.error('Failed to save room store', e);
  }
}

// ============================================================
// Subscription (same pattern as extractionService)
// ============================================================

type Listener = () => void;
const listeners: Listener[] = [];

export function subscribeRooms(listener: Listener): () => void {
  listeners.push(listener);
  return () => {
    const idx = listeners.indexOf(listener);
    if (idx > -1) listeners.splice(idx, 1);
  };
}

function notifyListeners() {
  listeners.forEach(l => l());
}

// ============================================================
// ID 生成
// ============================================================

function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

// ============================================================
// Room CRUD
// ============================================================

// 套餐时长映射（毫秒）
const PLAN_DURATION_MS: Record<RoomPlanType, number> = {
  free: 60 * 60 * 1000,           // 1小时（免费体验）
  hourly: 60 * 60 * 1000,         // 1小时
  half_day: 12 * 60 * 60 * 1000,  // 12小时
  daily: 24 * 60 * 60 * 1000,     // 24小时
  monthly: 30 * 24 * 60 * 60 * 1000,   // 30天
  yearly: 365 * 24 * 60 * 60 * 1000,   // 365天
  permanent: 0,                    // 永久
};

export function createRoom(config: {
  name: string;
  characters: CharacterId[];
  atmosphere: AtmosphereMode;
  topic: string;
  plan?: RoomPlanType;
}): Room {
  const now = new Date();
  const plan = config.plan || 'hourly';

  // 计算到期时间
  let expiresAt: string | undefined;
  if (plan !== 'permanent') {
    const duration = PLAN_DURATION_MS[plan];
    expiresAt = new Date(now.getTime() + duration).toISOString();
  }

  // 初始化每个角色的温度为默认值
  const characterTemps: Partial<Record<CharacterId, TemperatureConfig>> = {};
  for (const charId of config.characters) {
    characterTemps[charId] = { ...getDefaultTemp(charId) };
  }

  const room: Room = {
    id: generateId(),
    name: config.name || `房间${roomStore.rooms.length + 1}`,
    createdAt: now.toISOString(),
    lastActiveAt: now.toISOString(),
    characters: config.characters,
    characterTemps,
    atmosphere: config.atmosphere,
    topic: config.topic,
    messages: [],
    isActive: true,
    plan,
    expiresAt,
  };

  roomStore.rooms.unshift(room);
  roomStore.activeRoomId = room.id;
  saveStore();
  notifyListeners();
  return room;
}

export function getRoom(id: string): Room | undefined {
  return roomStore.rooms.find(r => r.id === id);
}

export function getActiveRoom(): Room | null {
  if (!roomStore.activeRoomId) return null;
  return getRoom(roomStore.activeRoomId) || null;
}

export function setActiveRoom(id: string | null): void {
  roomStore.activeRoomId = id;
  saveStore();
  notifyListeners();
}

export function getAllRooms(): Room[] {
  return roomStore.rooms;
}

export function deleteRoom(id: string): void {
  roomStore.rooms = roomStore.rooms.filter(r => r.id !== id);
  if (roomStore.activeRoomId === id) {
    roomStore.activeRoomId = null;
  }
  saveStore();
  notifyListeners();
}

// ============================================================
// Messages
// ============================================================

export function addMessage(roomId: string, msg: RoomMessage): void {
  const room = getRoom(roomId);
  if (!room) return;

  room.messages.push(msg);
  room.lastActiveAt = new Date().toISOString();

  // 消息上限裁剪
  if (room.messages.length > MAX_MESSAGES_PER_ROOM) {
    room.messages = room.messages.slice(-MAX_MESSAGES_PER_ROOM);
  }

  saveStore();
  // 不触发 notifyListeners 避免循环（RoomScreen 自己管理消息 state）
}

export function getMessages(roomId: string): RoomMessage[] {
  const room = getRoom(roomId);
  return room?.messages || [];
}

// ============================================================
// Character Management
// ============================================================

export function kickCharacter(roomId: string, charId: CharacterId): void {
  const room = getRoom(roomId);
  if (!room) return;

  room.characters = room.characters.filter(c => c !== charId);
  delete room.characterTemps[charId];

  // 添加系统消息
  room.messages.push({
    id: generateId(),
    role: 'system',
    text: `${charId} 已被移出房间`,
    timestamp: new Date().toISOString(),
  });

  saveStore();
  notifyListeners();
}

export function addCharacter(roomId: string, charId: CharacterId): void {
  const room = getRoom(roomId);
  if (!room) return;
  if (room.characters.includes(charId)) return;

  room.characters.push(charId);
  room.characterTemps[charId] = { ...getDefaultTemp(charId) };

  room.messages.push({
    id: generateId(),
    role: 'system',
    text: `${charId} 加入了房间`,
    timestamp: new Date().toISOString(),
  });

  saveStore();
  notifyListeners();
}

// ============================================================
// Temperature Control
// ============================================================

export function updateCharacterTemp(
  roomId: string,
  charId: CharacterId,
  temp: TemperatureConfig,
): void {
  const room = getRoom(roomId);
  if (!room) return;
  room.characterTemps[charId] = { ...temp };
  saveStore();
  // 不通知，避免重渲染抖动
}

export function applyTempPreset(roomId: string, preset: TempPreset): void {
  const room = getRoom(roomId);
  if (!room) return;

  const presetDef = TEMP_PRESETS[preset];
  if (!presetDef) return;

  for (const charId of room.characters) {
    room.characterTemps[charId] = presetDef.apply(charId);
  }

  saveStore();
  notifyListeners();
}

export function resetCharacterTemp(roomId: string, charId: CharacterId): void {
  const room = getRoom(roomId);
  if (!room) return;
  room.characterTemps[charId] = { ...getDefaultTemp(charId) };
  saveStore();
}

// ============================================================
// Room Expiration
// ============================================================

export function isRoomExpired(room: Room): boolean {
  if (!room.expiresAt) return false; // 永久房间
  return new Date(room.expiresAt).getTime() <= Date.now();
}

export function getRoomTimeRemaining(room: Room): { expired: boolean; label: string; ms: number } {
  if (!room.expiresAt) {
    return { expired: false, label: '永久', ms: Infinity };
  }

  const remaining = new Date(room.expiresAt).getTime() - Date.now();
  if (remaining <= 0) {
    return { expired: true, label: '已到期', ms: 0 };
  }

  const mins = Math.floor(remaining / 60000);
  if (mins < 60) {
    return { expired: false, label: `${mins}分钟`, ms: remaining };
  }
  const hours = Math.floor(mins / 60);
  if (hours < 24) {
    return { expired: false, label: `${hours}小时${mins % 60 > 0 ? mins % 60 + '分' : ''}`, ms: remaining };
  }
  const days = Math.floor(hours / 24);
  return { expired: false, label: `${days}天`, ms: remaining };
}

// ============================================================
// Init
// ============================================================

loadStore();
