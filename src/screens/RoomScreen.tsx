import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft, Settings2, Send, X, UserMinus, Share2, Clock, AlertTriangle } from 'lucide-react';
import html2canvas from 'html2canvas';
import { getRoom, addMessage, kickCharacter, updateCharacterTemp, applyTempPreset, subscribeRooms, isRoomExpired, getRoomTimeRemaining } from '../services/roomService';
import { sendRoomMessage, generateAutoChat } from '../services/roomChatService';
import { CHARACTER_MAP, TEMP_PRESETS } from '../characters';
import { decayStates, getRoomHeat } from '../services/stateService';
import { decayRelationships } from '../services/relationshipService';
import { generateFOMOSummary } from '../services/userIdentityService';
import type { Room, RoomMessage, CharacterId, TemperatureConfig, TempPreset } from '../types/room';

interface RoomScreenProps {
  roomId: string | null;
  onBack: () => void;
  onCharacterTap?: (charId: CharacterId) => void;
}

// ============================================================
// 温度滑条定义
// ============================================================

const TEMP_SLIDERS: Array<{
  key: keyof TemperatureConfig;
  label: string;
  emoji: string;
  low: string;
  high: string;
}> = [
  { key: 'intensity', label: '强烈度', emoji: '🔥', low: '温和', high: '暴怒' },
  { key: 'rationality', label: '理性度', emoji: '🧠', low: '感性', high: '纯理性' },
  { key: 'verbosity', label: '话密度', emoji: '🗣️', low: '惜字', high: '话痨' },
  { key: 'provocation', label: '挑逗度', emoji: '😈', low: '论事', high: '阴阳' },
  { key: 'empathy', label: '共情度', emoji: '💔', low: '冷漠', high: '走心' },
];

// ============================================================
// ID 生成
// ============================================================

function genId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

// ============================================================
// RoomScreen
// ============================================================

export default function RoomScreen({ roomId, onBack, onCharacterTap }: RoomScreenProps) {
  const [room, setRoom] = useState<Room | null>(null);
  const [messages, setMessages] = useState<RoomMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [typingChar, setTypingChar] = useState<CharacterId | null>(null);
  const [showTempDrawer, setShowTempDrawer] = useState(false);
  const [kickConfirm, setKickConfirm] = useState<CharacterId | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareImage, setShareImage] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [timeLabel, setTimeLabel] = useState('');
  const [expired, setExpired] = useState(false);
  const [showReviewPrompt, setShowReviewPrompt] = useState(false);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [mentionFilter, setMentionFilter] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const shareCardRef = useRef<HTMLDivElement>(null);

  // @ 提及可选角色列表（过滤后）
  const mentionCandidates = (room?.characters || []).filter(cId => {
    const charDef = CHARACTER_MAP[cId];
    if (!charDef) return false;
    if (!mentionFilter) return true;
    return charDef.shortName.includes(mentionFilter) || charDef.name.includes(mentionFilter);
  });

  // 加载房间数据
  const loadRoom = useCallback(() => {
    if (!roomId) return;
    const r = getRoom(roomId);
    if (r) {
      setRoom({ ...r });
      setMessages([...r.messages]);
    }
  }, [roomId]);

  useEffect(() => {
    loadRoom();
    return subscribeRooms(loadRoom);
  }, [loadRoom]);

  // 房间到期倒计时
  useEffect(() => {
    if (!room) return;
    const update = () => {
      const info = getRoomTimeRemaining(room);
      setTimeLabel(info.label);
      setExpired(info.expired);
    };
    update();
    const interval = setInterval(update, 30000); // 每30秒更新
    return () => clearInterval(interval);
  }, [room?.expiresAt]);

  // 自动滚到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typingChar]);

  // 🆕 状态衰减定时器（每30秒衰减一次角色状态和关系张力）
  useEffect(() => {
    if (!roomId) return;
    const decayInterval = setInterval(() => {
      decayStates(roomId);
      decayRelationships(roomId);
    }, 30000);
    return () => clearInterval(decayInterval);
  }, [roomId]);

  // 🆕 FOMO：检测用户回到房间时是否错过了自动对话
  const [fomoMessage, setFomoMessage] = useState<string | null>(null);
  const lastSeenCountRef = useRef<number>(0);

  useEffect(() => {
    if (!roomId || !room) return;
    // 初始化时记录消息数
    if (lastSeenCountRef.current === 0) {
      lastSeenCountRef.current = messages.length;
      return;
    }
    // 如果消息数增长了且是角色消息（自动对话），生成FOMO
    const missedCount = messages.length - lastSeenCountRef.current;
    if (missedCount >= 3) {
      const missedMsgs = messages.slice(-missedCount);
      const summary = generateFOMOSummary(roomId, missedMsgs);
      if (summary) {
        setFomoMessage(summary);
        // 5秒后自动消失
        setTimeout(() => setFomoMessage(null), 8000);
      }
    }
    lastSeenCountRef.current = messages.length;
  }, [messages.length]);

  // ============================================================
  // 发消息
  // ============================================================

  const handleSend = async () => {
    if (!input.trim() || sending || !room || !roomId) return;
    if (expired) return; // 房间到期不允许发送
    const text = input.trim();
    setInput('');
    setSending(true);

    // 1. 添加用户消息
    const userMsg: RoomMessage = {
      id: genId(),
      role: 'user',
      text,
      timestamp: new Date().toISOString(),
    };
    addMessage(roomId, userMsg);
    setMessages(prev => [...prev, userMsg]);

    try {
      // 2. 获取角色回复
      const responses = await sendRoomMessage(room, text);

      // 3. 逐个显示角色回复（带延迟，按角色打字速度+内容长度动态计算）
      for (let i = 0; i < responses.length; i++) {
        const resp = responses[i];
        const charDef = CHARACTER_MAP[resp.characterId];
        // 基础延迟按 typingSpeed
        const baseDelay = charDef?.typingSpeed === 'fast' ? 600 : charDef?.typingSpeed === 'slow' ? 2200 : 1200;
        // 文本长度加权（每30字+200ms，上限2s）
        const lengthBonus = Math.min(2000, Math.floor(resp.text.length / 30) * 200);
        const delay = baseDelay + lengthBonus + Math.random() * 500;

        // 显示 typing
        setTypingChar(resp.characterId);
        await new Promise(r => setTimeout(r, delay));

        // 添加角色消息
        const charMsg: RoomMessage = {
          id: genId(),
          role: 'character',
          characterId: resp.characterId,
          text: resp.text,
          timestamp: new Date().toISOString(),
        };
        addMessage(roomId, charMsg);
        setMessages(prev => [...prev, charMsg]);
        setTypingChar(null);
      }
    } catch (err) {
      console.error('Room chat error:', err);
      const errMsg: RoomMessage = {
        id: genId(),
        role: 'system',
        text: '网络出了点问题，稍后再试',
        timestamp: new Date().toISOString(),
      };
      addMessage(roomId, errMsg);
      setMessages(prev => [...prev, errMsg]);
    }

    setSending(false);
    inputRef.current?.focus();
  };

  /** 处理输入变更 — 检测 @ 提及 */
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInput(val);

    // 检测 @ 触发：找到最后一个 @ 符号
    const cursorPos = e.target.selectionStart ?? val.length;
    const textBeforeCursor = val.slice(0, cursorPos);
    const atIndex = textBeforeCursor.lastIndexOf('@');

    if (atIndex >= 0) {
      const afterAt = textBeforeCursor.slice(atIndex + 1);
      // @ 后面不能有空格（空格表示已完成选择）
      if (!afterAt.includes(' ')) {
        setMentionFilter(afterAt);
        setMentionOpen(true);
        setMentionIndex(0);
        return;
      }
    }
    setMentionOpen(false);
  };

  /** 插入 @角色名 到输入框 */
  const insertMention = (charId: CharacterId) => {
    const charDef = CHARACTER_MAP[charId];
    if (!charDef) return;

    const cursorPos = inputRef.current?.selectionStart ?? input.length;
    const textBeforeCursor = input.slice(0, cursorPos);
    const atIndex = textBeforeCursor.lastIndexOf('@');

    if (atIndex >= 0) {
      const before = input.slice(0, atIndex);
      const after = input.slice(cursorPos);
      const newVal = `${before}@${charDef.shortName} ${after}`;
      setInput(newVal);
    } else {
      setInput(input + `@${charDef.shortName} `);
    }
    setMentionOpen(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // @ 选择器键盘导航
    if (mentionOpen && mentionCandidates.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMentionIndex(prev => (prev + 1) % mentionCandidates.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMentionIndex(prev => (prev - 1 + mentionCandidates.length) % mentionCandidates.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        insertMention(mentionCandidates[mentionIndex]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setMentionOpen(false);
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // ============================================================
  // 防冷场：空闲自动聊天（热度自适应）
  // ============================================================

  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoChatCountRef = useRef(0);
  const isAutoChatting = useRef(false);

  /** 根据房间热度动态计算空闲超时时间 */
  const getIdleTimeout = useCallback((): number => {
    if (!roomId) return 45000;
    const heat = getRoomHeat(roomId);
    const level = heat?.level || 'cold';
    const round = autoChatCountRef.current;
    // 第一轮超时：冷→25s 温→40s 热→60s 沸腾→90s
    // 后续轮次递增 +50%
    const base: Record<string, number> = {
      cold: 25000, warm: 40000, hot: 60000, boiling: 90000,
    };
    const timeout = (base[level] || 40000) * (1 + round * 0.5);
    return Math.min(timeout, 120000); // 上限 2 分钟
  }, [roomId]);

  const resetIdleTimer = useCallback(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    autoChatCountRef.current = 0; // 用户说话后重置计数
  }, []);

  const startIdleTimer = useCallback(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    if (!room || !roomId || room.characters.length < 2) return;

    const timeout = getIdleTimeout();

    idleTimerRef.current = setTimeout(async () => {
      if (sending || isAutoChatting.current || autoChatCountRef.current >= 3) return;
      isAutoChatting.current = true;

      try {
        const currentRoom = getRoom(roomId);
        if (!currentRoom) return;

        const responses = await generateAutoChat(currentRoom);
        if (responses.length === 0) return;

        // 逐个显示自动聊天消息（带真实打字延迟）
        for (const resp of responses) {
          const charDef = CHARACTER_MAP[resp.characterId];
          const baseDelay = charDef?.typingSpeed === 'fast' ? 500 : charDef?.typingSpeed === 'slow' ? 1800 : 1000;
          const lengthBonus = Math.min(1500, Math.floor(resp.text.length / 30) * 150);
          const delay = baseDelay + lengthBonus + Math.random() * 400;

          setTypingChar(resp.characterId);
          await new Promise(r => setTimeout(r, delay));

          const charMsg: RoomMessage = {
            id: genId(),
            role: 'character',
            characterId: resp.characterId,
            text: resp.text,
            timestamp: new Date().toISOString(),
          };
          addMessage(roomId, charMsg);
          setMessages(prev => [...prev, charMsg]);
          setTypingChar(null);
        }

        autoChatCountRef.current++;

        // 最多3轮自动对话，每轮间隔递增
        if (autoChatCountRef.current < 3) {
          startIdleTimer();
        }
      } catch (err) {
        console.warn('Auto-chat error:', err);
      } finally {
        isAutoChatting.current = false;
      }
    }, timeout);
  }, [room, roomId, sending, getIdleTimeout]);

  // 每次有新消息或发送完毕时重置并启动计时器
  useEffect(() => {
    if (messages.length > 0 && !sending) {
      resetIdleTimer();
      startIdleTimer();
    }
    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, [messages.length, sending, startIdleTimer, resetIdleTimer]);

  // ============================================================
  // 截图分享
  // ============================================================

  const handleShare = async () => {
    setShowShareModal(true);
    setShareImage(null);
    setSharing(true);

    // 等渲染完成后截图
    await new Promise(r => setTimeout(r, 100));

    if (shareCardRef.current) {
      try {
        const canvas = await html2canvas(shareCardRef.current, {
          backgroundColor: '#ffffff',
          scale: 2,
          useCORS: true,
        });
        setShareImage(canvas.toDataURL('image/png'));
      } catch (err) {
        console.error('Screenshot failed:', err);
      }
    }
    setSharing(false);
  };

  const handleDownloadImage = () => {
    if (!shareImage) return;
    const link = document.createElement('a');
    link.download = `博弈圆桌-${room?.name || 'chat'}.png`;
    link.href = shareImage;
    link.click();
  };

  const handleNativeShare = async () => {
    if (!shareImage) return;
    try {
      const blob = await (await fetch(shareImage)).blob();
      const file = new File([blob], '博弈圆桌.png', { type: 'image/png' });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: '博弈圆桌精彩对话' });
      } else {
        handleDownloadImage();
      }
    } catch {
      handleDownloadImage();
    }
  };

  // 获取最近的精彩消息（最近10条角色消息）
  const getShareMessages = (): RoomMessage[] => {
    const recent = messages.slice(-20);
    const interesting = recent.filter(m => m.role === 'character' || m.role === 'user');
    return interesting.slice(-8);
  };

  // ============================================================
  // 踢角色
  // ============================================================

  const handleKick = (charId: CharacterId) => {
    if (!roomId) return;
    kickCharacter(roomId, charId);
    setKickConfirm(null);
    loadRoom();
  };

  // ============================================================
  // 温度调整
  // ============================================================

  const handleTempChange = (charId: CharacterId, key: keyof TemperatureConfig, value: number) => {
    if (!roomId || !room) return;
    const current = room.characterTemps[charId] || { intensity: 5, rationality: 5, verbosity: 5, provocation: 5, empathy: 5 };
    const newTemp = { ...current, [key]: value };
    updateCharacterTemp(roomId, charId, newTemp);
    setRoom(prev => prev ? { ...prev, characterTemps: { ...prev.characterTemps, [charId]: newTemp } } : prev);
  };

  const handlePreset = (preset: TempPreset) => {
    if (!roomId) return;
    applyTempPreset(roomId, preset);
    loadRoom();
  };

  // 退出房间时检查是否弹评价提示
  const handleBackWithReview = () => {
    if (!room || !onCharacterTap) { onBack(); return; }
    const charMsgCount = messages.filter(m => m.role === 'character').length;
    if (charMsgCount >= 3 && room.characters.length > 0) {
      setShowReviewPrompt(true);
    } else {
      onBack();
    }
  };

  if (!room) {
    return (
      <div style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--sub)' }}>
        房间不存在
        <br />
        <button onClick={onBack} style={{ marginTop: '12px', textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer' }}>
          返回首页
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: 'var(--page)' }}>

      {/* ============ Header ============ */}
      <div style={{
        padding: '12px 16px',
        paddingTop: 'calc(12px + env(safe-area-inset-top, 0px))',
        backgroundColor: 'var(--white)',
        borderBottom: '1px solid var(--border-light)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <button onClick={handleBackWithReview} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px' }}>
            <ArrowLeft size={20} />
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '16px', fontWeight: 700 }}>{room.name}</div>
            <div style={{ fontSize: '11px', color: 'var(--sub)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{room.topic}</span>
              {room.expiresAt && (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: '2px',
                  padding: '1px 6px', borderRadius: '8px', flexShrink: 0,
                  backgroundColor: expired ? '#ffebee' : '#fff3e0',
                  color: expired ? '#f44336' : '#e65100',
                  fontSize: '10px', fontWeight: 600,
                }}>
                  <Clock size={9} /> {timeLabel}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={handleShare}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '8px',
            }}
            title="分享对话"
          >
            <Share2 size={18} />
          </button>
          <button
            onClick={() => setShowTempDrawer(!showTempDrawer)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '8px',
              backgroundColor: showTempDrawer ? 'var(--accent-lavender)' : 'transparent',
            }}
          >
            <Settings2 size={20} />
          </button>
        </div>

        {/* 角色头像行 */}
        <div style={{ display: 'flex', gap: '6px', overflowX: 'auto' }}>
          {room.characters.map(charId => {
            const char = CHARACTER_MAP[charId];
            if (!char) return null;
            return (
              <button
                key={charId}
                onClick={() => setKickConfirm(kickConfirm === charId ? null : charId)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '2px',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '4px',
                  position: 'relative',
                }}
              >
                <img
                  src={char.avatar}
                  alt={char.shortName}
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    border: `2px solid ${char.color}`,
                    objectFit: 'cover',
                  }}
                />
                <span style={{ fontSize: '10px', color: 'var(--sub)', fontWeight: 500 }}>{char.shortName}</span>

                {/* 踢出确认 */}
                {kickConfirm === charId && charId !== 'junshi' && (
                  <div style={{
                    position: 'absolute',
                    top: '-6px',
                    right: '-8px',
                    zIndex: 10,
                  }}>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleKick(charId); }}
                      style={{
                        width: '20px',
                        height: '20px',
                        borderRadius: '50%',
                        backgroundColor: '#e53935',
                        border: 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <UserMinus size={10} color="#fff" />
                    </button>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ============ FOMO Banner ============ */}
      {fomoMessage && (
        <div
          onClick={() => setFomoMessage(null)}
          style={{
            padding: '10px 16px',
            backgroundColor: 'rgba(230,184,0,0.12)',
            borderBottom: '1px solid rgba(230,184,0,0.2)',
            fontSize: '13px',
            color: '#E6B800',
            fontWeight: 500,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            flexShrink: 0,
            animation: 'fadeIn 0.3s ease',
          }}
        >
          <span>🔥</span>
          <span style={{ flex: 1 }}>{fomoMessage}</span>
          <X size={14} style={{ opacity: 0.5 }} />
        </div>
      )}

      {/* ============ Messages ============ */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--sub)', fontSize: '13px', padding: '40px 0' }}>
            发一条消息，角色们会开始讨论
          </div>
        )}

        {messages.map(msg => {
          // 系统消息
          if (msg.role === 'system') {
            return (
              <div key={msg.id} style={{ textAlign: 'center', color: 'var(--sub)', fontSize: '12px', padding: '8px 0' }}>
                {msg.text}
              </div>
            );
          }

          // 用户消息
          if (msg.role === 'user') {
            return (
              <div key={msg.id} style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '12px' }}>
                <div style={{
                  maxWidth: '75%',
                  padding: '10px 14px',
                  borderRadius: '18px 18px 4px 18px',
                  backgroundColor: 'var(--ink)',
                  color: '#fff',
                  fontSize: '14px',
                  lineHeight: 1.5,
                  wordBreak: 'break-word',
                }}>
                  {msg.text}
                </div>
              </div>
            );
          }

          // 角色消息
          const char = msg.characterId ? CHARACTER_MAP[msg.characterId] : null;
          return (
            <div key={msg.id} style={{ display: 'flex', gap: '8px', marginBottom: '12px', alignItems: 'flex-start' }}>
              {/* 头像 */}
              <img
                src={char?.avatar || ''}
                alt={char?.shortName || ''}
                style={{
                  width: '30px',
                  height: '30px',
                  borderRadius: '50%',
                  border: `2px solid ${char?.color || '#ccc'}`,
                  objectFit: 'cover',
                  flexShrink: 0,
                }}
              />
              <div style={{ maxWidth: '75%' }}>
                <div style={{ fontSize: '11px', fontWeight: 600, color: char?.color || 'var(--sub)', marginBottom: '2px' }}>
                  {char?.shortName || '未知'}
                </div>
                <div style={{
                  padding: '10px 14px',
                  borderRadius: '4px 18px 18px 18px',
                  backgroundColor: 'var(--white)',
                  border: `1px solid ${char?.color || 'var(--border-light)'}22`,
                  fontSize: '14px',
                  lineHeight: 1.5,
                  wordBreak: 'break-word',
                }}>
                  {msg.text}
                </div>
              </div>
            </div>
          );
        })}

        {/* Typing Indicator */}
        {typingChar && (
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', alignItems: 'flex-start' }}>
            <img
              src={CHARACTER_MAP[typingChar]?.avatar || ''}
              alt={CHARACTER_MAP[typingChar]?.shortName || ''}
              style={{
                width: '30px',
                height: '30px',
                borderRadius: '50%',
                border: `2px solid ${CHARACTER_MAP[typingChar]?.color || '#ccc'}`,
                objectFit: 'cover',
                flexShrink: 0,
              }}
            />
            <div>
              <div style={{ fontSize: '11px', fontWeight: 600, color: CHARACTER_MAP[typingChar]?.color || 'var(--sub)', marginBottom: '2px' }}>
                {CHARACTER_MAP[typingChar]?.shortName}
              </div>
              <div style={{
                padding: '10px 14px',
                borderRadius: '4px 18px 18px 18px',
                backgroundColor: 'var(--white)',
                fontSize: '14px',
                color: 'var(--sub)',
              }}>
                <span className="typing-dots">正在输入</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* ============ Temperature Drawer ============ */}
      {showTempDrawer && (
        <div style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: 'var(--white)',
          borderTop: '1px solid var(--border-light)',
          borderRadius: '20px 20px 0 0',
          boxShadow: '0 -8px 32px rgba(0,0,0,0.12)',
          maxHeight: '60vh',
          overflowY: 'auto',
          zIndex: 100,
          padding: '16px',
          paddingBottom: 'calc(16px + env(safe-area-inset-bottom, 0px))',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700 }}>角色控制台</h3>
            <button onClick={() => setShowTempDrawer(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
              <X size={20} />
            </button>
          </div>

          {/* 快捷预设 */}
          <div style={{ display: 'flex', gap: '6px', marginBottom: '16px', overflowX: 'auto' }}>
            {(Object.keys(TEMP_PRESETS) as TempPreset[]).map(preset => {
              const p = TEMP_PRESETS[preset];
              return (
                <button
                  key={preset}
                  onClick={() => handlePreset(preset)}
                  className="clickable"
                  style={{
                    padding: '6px 12px',
                    borderRadius: '12px',
                    border: '1px solid var(--border-light)',
                    backgroundColor: 'var(--white)',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {p.emoji} {p.label}
                </button>
              );
            })}
          </div>

          {/* 每个角色的温度调节 */}
          {room.characters.map(charId => {
            const char = CHARACTER_MAP[charId];
            if (!char) return null;
            const temp = room.characterTemps[charId] || char.defaultTemp;

            return (
              <div
                key={charId}
                style={{
                  marginBottom: '16px',
                  padding: '12px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: char.bgColor + '33',
                  border: `1px solid ${char.color}22`,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                  <img src={char.avatar} alt={char.shortName} style={{ width: 24, height: 24, borderRadius: '50%', border: `2px solid ${char.color}`, objectFit: 'cover' }} />
                  <span style={{ fontSize: '14px', fontWeight: 700, color: char.color }}>{char.shortName}</span>
                </div>

                {TEMP_SLIDERS.map(slider => (
                  <div key={slider.key} style={{ marginBottom: '6px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--sub)', marginBottom: '2px' }}>
                      <span>{slider.emoji} {slider.label}</span>
                      <span style={{ fontWeight: 600 }}>{temp[slider.key]}/10</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '10px', color: 'var(--sub)', width: '24px' }}>{slider.low}</span>
                      <input
                        type="range"
                        min={1}
                        max={10}
                        value={temp[slider.key]}
                        onChange={e => handleTempChange(charId, slider.key, parseInt(e.target.value))}
                        style={{ flex: 1, accentColor: char.color }}
                      />
                      <span style={{ fontSize: '10px', color: 'var(--sub)', width: '24px', textAlign: 'right' }}>{slider.high}</span>
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}

      {/* ============ Input Bar ============ */}
      {expired ? (
        <div style={{
          padding: '14px 16px',
          paddingBottom: 'calc(14px + env(safe-area-inset-bottom, 0px))',
          backgroundColor: 'rgba(230,184,0,0.08)',
          borderTop: '1px solid rgba(230,184,0,0.2)',
          display: 'flex',
          gap: '10px',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}>
          <AlertTriangle size={16} color="#E6B800" />
          <span style={{ fontSize: '13px', color: '#e65100', fontWeight: 600 }}>
            房间已到期，对话记录已保留
          </span>
        </div>
      ) : (
        <div style={{
          padding: '10px 16px',
          paddingBottom: 'calc(10px + env(safe-area-inset-bottom, 0px))',
          backgroundColor: 'var(--white)',
          borderTop: '1px solid var(--border-light)',
          display: 'flex',
          gap: '10px',
          alignItems: 'center',
          flexShrink: 0,
          position: 'relative',
        }}>
          {/* @ 提及选择器 */}
          {mentionOpen && mentionCandidates.length > 0 && (
            <div style={{
              position: 'absolute', bottom: '100%', left: 16, right: 16,
              background: '#1F1F1F', borderRadius: 14, marginBottom: 6,
              boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
              border: '1px solid var(--border-light)',
              maxHeight: 200, overflowY: 'auto', zIndex: 50,
            }}>
              {mentionCandidates.map((cId, idx) => {
                const cd = CHARACTER_MAP[cId];
                if (!cd) return null;
                return (
                  <div
                    key={cId}
                    className="clickable"
                    onClick={() => insertMention(cId)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '10px 14px', cursor: 'pointer',
                      background: idx === mentionIndex ? 'var(--bg-secondary)' : 'transparent',
                      borderBottom: idx < mentionCandidates.length - 1 ? '1px solid var(--border-light)' : 'none',
                    }}
                  >
                    <img src={cd.avatar} alt={cd.shortName} style={{ width: 24, height: 24, borderRadius: '50%', border: `2px solid ${cd.color}`, objectFit: 'cover' }} />
                    <div>
                      <span style={{ fontSize: 14, fontWeight: 600, color: cd.color }}>{cd.shortName}</span>
                      <span style={{ fontSize: 11, color: '#888', marginLeft: 6 }}>{cd.position.slice(0, 15)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <input
            ref={inputRef}
            className="input-soft"
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onBlur={() => setTimeout(() => setMentionOpen(false), 150)}
            placeholder="说点什么...（@可呼叫角色）"
            disabled={sending}
            style={{
              flex: 1,
              padding: '10px 14px',
              fontSize: '15px',
              borderRadius: 'var(--radius-full)',
            }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || sending}
            className="clickable"
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              backgroundColor: input.trim() && !sending ? 'var(--ink)' : '#ddd',
              border: 'none',
              cursor: input.trim() && !sending ? 'pointer' : 'default',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s ease',
              flexShrink: 0,
            }}
          >
            <Send size={16} color="#fff" />
          </button>
        </div>
      )}

      {/* ============ Share Modal ============ */}
      {showShareModal && (
        <div style={{
          position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          zIndex: 200, padding: '20px',
        }}>
          <div style={{
            backgroundColor: '#1F1F1F', borderRadius: '16px', width: '100%', maxWidth: '360px',
            maxHeight: '80vh', overflow: 'auto', position: 'relative',
          }}>
            {/* 关闭按钮 */}
            <button
              onClick={() => { setShowShareModal(false); setShareImage(null); }}
              style={{
                position: 'sticky', top: '8px', right: '8px', float: 'right',
                background: 'rgba(0,0,0,0.1)', border: 'none', cursor: 'pointer',
                width: '28px', height: '28px', borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                zIndex: 10, margin: '8px',
              }}
            >
              <X size={14} />
            </button>

            {/* 预览图或卡片 */}
            {shareImage ? (
              <div style={{ padding: '16px' }}>
                <img src={shareImage} alt="分享预览" style={{ width: '100%', borderRadius: '8px' }} />
                <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                  <button
                    onClick={handleDownloadImage}
                    className="clickable"
                    style={{
                      flex: 1, padding: '12px', borderRadius: '10px', border: 'none',
                      backgroundColor: '#E6B800', color: '#000',
                      fontSize: '14px', fontWeight: 600, cursor: 'pointer',
                    }}
                  >
                    保存图片
                  </button>
                  <button
                    onClick={handleNativeShare}
                    className="clickable"
                    style={{
                      flex: 1, padding: '12px', borderRadius: '10px', border: 'none',
                      backgroundColor: '#4caf50', color: '#fff',
                      fontSize: '14px', fontWeight: 600, cursor: 'pointer',
                    }}
                  >
                    分享
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ padding: '40px', textAlign: 'center', color: 'var(--sub)' }}>
                {sharing ? '正在生成截图...' : '截图失败'}
              </div>
            )}
          </div>

          {/* 隐藏的分享卡片（用于 html2canvas 渲染） */}
          <div style={{ position: 'fixed', left: '-9999px', top: 0 }}>
            <div
              ref={shareCardRef}
              style={{
                width: '360px', padding: '20px', backgroundColor: '#fff',
                fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
              }}
            >
              {/* 卡片头部 */}
              <div style={{ marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid #eee' }}>
                <div style={{ fontSize: '18px', fontWeight: 800, marginBottom: '4px' }}>博弈圆桌</div>
                <div style={{ fontSize: '13px', color: '#666' }}>{room.topic}</div>
                <div style={{ display: 'flex', gap: '4px', marginTop: '8px', flexWrap: 'wrap' }}>
                  {room.characters.map(charId => {
                    const char = CHARACTER_MAP[charId];
                    if (!char) return null;
                    return (
                      <span key={charId} style={{
                        fontSize: '11px', padding: '2px 8px', borderRadius: '6px',
                        backgroundColor: char.bgColor, color: char.color, fontWeight: 500,
                      }}>
                        {char.emoji} {char.shortName}
                      </span>
                    );
                  })}
                </div>
              </div>

              {/* 消息列表 */}
              {getShareMessages().map(msg => {
                if (msg.role === 'user') {
                  return (
                    <div key={msg.id} style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '10px' }}>
                      <div style={{
                        maxWidth: '75%', padding: '8px 12px', borderRadius: '14px 14px 4px 14px',
                        backgroundColor: '#1a1a2e', color: '#fff', fontSize: '13px', lineHeight: 1.5,
                      }}>
                        {msg.text}
                      </div>
                    </div>
                  );
                }
                const char = msg.characterId ? CHARACTER_MAP[msg.characterId] : null;
                return (
                  <div key={msg.id} style={{ display: 'flex', gap: '8px', marginBottom: '10px', alignItems: 'flex-start' }}>
                    <img
                      src={char?.avatar || ''}
                      alt={char?.shortName || ''}
                      style={{
                        width: '28px', height: '28px', borderRadius: '50%',
                        border: `2px solid ${char?.color || '#ccc'}`,
                        objectFit: 'cover', flexShrink: 0,
                      }}
                    />
                    <div style={{ maxWidth: '75%' }}>
                      <div style={{ fontSize: '11px', fontWeight: 600, color: char?.color || '#999', marginBottom: '2px' }}>
                        {char?.shortName || '未知'}
                      </div>
                      <div style={{
                        padding: '8px 12px', borderRadius: '4px 14px 14px 14px',
                        backgroundColor: '#f8f9fa', fontSize: '13px', lineHeight: 1.5,
                        border: `1px solid ${char?.color || '#eee'}22`,
                      }}>
                        {msg.text}
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* 水印 */}
              <div style={{
                marginTop: '16px', paddingTop: '12px', borderTop: '1px solid #eee',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <span style={{ fontSize: '12px', color: '#999' }}>来自「博弈圆桌」</span>
                <span style={{ fontSize: '11px', color: '#bbb' }}>AI 多角色群聊</span>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* ============ 退出评价提示 ============ */}
      {showReviewPrompt && (
        <>
          <div
            onClick={() => { setShowReviewPrompt(false); onBack(); }}
            style={{
              position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)',
              zIndex: 300,
            }}
          />
          <div style={{
            position: 'fixed', bottom: 0, left: 0, right: 0,
            backgroundColor: 'var(--white)', borderRadius: '20px 20px 0 0',
            padding: '24px 16px calc(24px + env(safe-area-inset-bottom, 0px))',
            zIndex: 301, textAlign: 'center',
          }}>
            <div style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px' }}>
              和他们聊得怎么样？
            </div>
            <div style={{
              display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap',
              marginBottom: '20px',
            }}>
              {room?.characters.map(charId => {
                const char = CHARACTER_MAP[charId];
                if (!char) return null;
                return (
                  <button
                    key={charId}
                    onClick={() => {
                      setShowReviewPrompt(false);
                      onCharacterTap?.(charId);
                    }}
                    className="clickable"
                    style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
                      background: 'none', border: 'none', cursor: 'pointer', padding: '8px',
                    }}
                  >
                    <img
                      src={char.avatar}
                      alt={char.shortName}
                      style={{
                        width: '48px', height: '48px', borderRadius: '50%',
                        border: `2px solid ${char.color}`,
                        objectFit: 'cover',
                      }}
                    />
                    <span style={{ fontSize: '12px', fontWeight: 600, color: char.color }}>
                      {char.shortName}
                    </span>
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => { setShowReviewPrompt(false); onBack(); }}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: '14px', color: 'var(--sub)', padding: '8px 20px',
              }}
            >
              下次再说
            </button>
          </div>
        </>
      )}
    </div>
  );
}
