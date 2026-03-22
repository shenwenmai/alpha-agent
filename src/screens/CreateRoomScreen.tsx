import React, { useState, useEffect } from 'react';
import { ArrowLeft, Check, Lock, Coins, Clock } from 'lucide-react';
import { ALL_CHARACTER_IDS, CHARACTER_MAP } from '../characters';
import { createRoom } from '../services/roomService';
import { getBalance, payForRoom, canAffordRoom, ROOM_PLANS, subscribeCredits, type RoomPlan } from '../services/creditsService';
import { createUserTopic, CATEGORY_DEFS } from '../services/topicService';
import type { CharacterId, AtmosphereMode } from '../types/room';
import { SEED_SCENARIOS } from '../data/scenarios';

interface CreateRoomScreenProps {
  onCreated: (roomId: string) => void;
  onBack: () => void;
  onCharacterTap?: (charId: CharacterId) => void;
}

const ATMOSPHERE_OPTIONS: { value: AtmosphereMode; label: string; desc: string }[] = [
  { value: 'real', label: '🔥 真实', desc: '口语化、带情绪' },
  { value: 'rational', label: '🧠 理性', desc: '冷静分析讨论' },
  { value: 'mixed', label: '🎭 混合', desc: '角色各显本色' },
];

// MVP 阶段只展示前3个套餐
const MVP_PLANS: RoomPlan[] = ['hourly', 'half_day', 'daily'];

// 从每个分类随机选1-2个话题作为推荐
const SUGGESTED_TOPICS: string[] = (() => {
  const topics: string[] = [];
  for (const def of CATEGORY_DEFS) {
    const matching = SEED_SCENARIOS.filter(s => {
      if (s.category) return s.category === def.key;
      const text = (s.topic + ' ' + s.triggerKeywords.join(' ')).toLowerCase();
      return def.keywords.some(kw => text.includes(kw));
    });
    if (matching.length > 0) {
      // 取第一个
      topics.push(matching[0].topic);
      // 如果有第二个也加上（但总数不超过12）
      if (matching.length > 2 && topics.length < 12) {
        topics.push(matching[Math.floor(matching.length / 2)].topic);
      }
    }
  }
  return topics.slice(0, 12);
})();

export default function CreateRoomScreen({ onCreated, onBack }: CreateRoomScreenProps) {
  const [name, setName] = useState('');
  const [selectedChars, setSelectedChars] = useState<CharacterId[]>(['junshi']);
  const [atmosphere, setAtmosphere] = useState<AtmosphereMode>('mixed');
  const [topic, setTopic] = useState('');
  const [selectedPlan, setSelectedPlan] = useState<RoomPlan>('hourly');
  const [balance, setBalance] = useState(() => getBalance());

  useEffect(() => {
    return subscribeCredits(() => setBalance(getBalance()));
  }, []);

  const toggleChar = (id: CharacterId) => {
    if (id === 'junshi') return;
    setSelectedChars(prev =>
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  };

  const handleCreate = () => {
    if (selectedChars.length < 2) {
      alert('至少选择2个角色');
      return;
    }

    const plan = ROOM_PLANS[selectedPlan];

    if (!canAffordRoom(selectedPlan)) {
      alert(`积分不足！创建房间需要 ${plan.credits} 积分，当前余额 ${balance} 积分。`);
      return;
    }

    const roomName = name || `${topic || '自由讨论'}`;
    const finalTopic = topic || '自由讨论';

    // 扣费
    const { success } = payForRoom(selectedPlan, roomName);
    if (!success) {
      alert('扣费失败，请重试');
      return;
    }

    // 保存用户自建话题（非预设话题时）
    if (topic && !SEED_SCENARIOS.some(s => s.topic === topic)) {
      createUserTopic(topic);
    }

    const room = createRoom({
      name: roomName,
      characters: selectedChars,
      atmosphere,
      topic: finalTopic,
      plan: selectedPlan,
    });

    onCreated(room.id);
  };

  const affordable = canAffordRoom(selectedPlan);

  return (
    <div style={{ padding: '20px 16px', paddingBottom: '20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={onBack}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}
          >
            <ArrowLeft size={22} />
          </button>
          <h1 style={{ fontSize: '22px', fontWeight: 800 }}>创建房间</h1>
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '4px',
          padding: '4px 12px', borderRadius: '16px',
          backgroundColor: 'rgba(230,184,0,0.12)',
        }}>
          <Coins size={14} color="#E6B800" />
          <span style={{ fontSize: '13px', fontWeight: 700, color: '#E6B800' }}>{balance}</span>
        </div>
      </div>

      {/* 话题 */}
      <div style={{ marginBottom: '20px' }}>
        <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--sub)', display: 'block', marginBottom: '6px' }}>
          讨论话题
        </label>
        <input
          className="input-soft"
          value={topic}
          onChange={e => setTopic(e.target.value)}
          placeholder="输入任何你想聊的话题，或选择推荐"
          style={{ width: '100%', padding: '12px 14px', fontSize: '15px', borderRadius: 'var(--radius-md)', marginBottom: '8px' }}
        />
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {SUGGESTED_TOPICS.map(t => (
            <button
              key={t}
              onClick={() => setTopic(t)}
              style={{
                fontSize: '12px',
                padding: '4px 10px',
                borderRadius: '12px',
                border: topic === t ? '1.5px solid var(--ink)' : '1px solid var(--border-light)',
                backgroundColor: topic === t ? 'var(--ink)' : 'var(--white)',
                color: topic === t ? '#fff' : 'var(--sub)',
                cursor: 'pointer',
                fontWeight: 500,
              }}
            >
              {t.length > 15 ? t.slice(0, 15) + '...' : t}
            </button>
          ))}
        </div>
      </div>

      {/* 选角色 */}
      <div style={{ marginBottom: '20px' }}>
        <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--sub)', display: 'block', marginBottom: '6px' }}>
          选择角色（至少2个）
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
          {ALL_CHARACTER_IDS.map(charId => {
            const char = CHARACTER_MAP[charId];
            if (!char) return null;
            const isSelected = selectedChars.includes(charId);
            const isLocked = charId === 'junshi';

            return (
              <button
                key={charId}
                onClick={() => toggleChar(charId)}
                className="clickable"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  padding: '12px 8px',
                  borderRadius: 'var(--radius-md)',
                  border: isSelected ? `2px solid ${char.color}` : '1.5px solid var(--border-light)',
                  backgroundColor: isSelected ? char.bgColor : 'var(--white)',
                  cursor: isLocked ? 'default' : 'pointer',
                  position: 'relative',
                  gap: '4px',
                }}
              >
                {isLocked && (
                  <Lock size={10} style={{ position: 'absolute', top: '4px', right: '4px', color: 'var(--sub)' }} />
                )}
                {isSelected && !isLocked && (
                  <Check size={12} style={{ position: 'absolute', top: '4px', right: '4px', color: char.color }} />
                )}
                <span style={{ fontSize: '24px' }}>{char.emoji}</span>
                <span style={{ fontSize: '12px', fontWeight: 600, color: isSelected ? char.color : 'var(--ink)' }}>
                  {char.shortName}
                </span>
                <span style={{ fontSize: '10px', color: 'var(--sub)', textAlign: 'center', lineHeight: 1.3 }}>
                  {char.style.slice(0, 10)}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 氛围 */}
      <div style={{ marginBottom: '20px' }}>
        <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--sub)', display: 'block', marginBottom: '6px' }}>
          氛围模式
        </label>
        <div style={{ display: 'flex', gap: '8px' }}>
          {ATMOSPHERE_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setAtmosphere(opt.value)}
              className="clickable"
              style={{
                flex: 1,
                padding: '12px 8px',
                borderRadius: 'var(--radius-md)',
                border: atmosphere === opt.value ? '2px solid var(--ink)' : '1.5px solid var(--border-light)',
                backgroundColor: atmosphere === opt.value ? 'var(--ink)' : 'var(--white)',
                color: atmosphere === opt.value ? '#fff' : 'var(--ink)',
                cursor: 'pointer',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '2px' }}>{opt.label}</div>
              <div style={{ fontSize: '11px', opacity: 0.7 }}>{opt.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* ============ 时长套餐 ============ */}
      <div style={{ marginBottom: '20px' }}>
        <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--sub)', display: 'block', marginBottom: '6px' }}>
          <Clock size={13} style={{ display: 'inline', verticalAlign: 'middle' }} /> 房间时长
        </label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {MVP_PLANS.map(planKey => {
            const plan = ROOM_PLANS[planKey];
            const isSelected = selectedPlan === planKey;
            const canAfford = balance >= plan.credits;

            return (
              <button
                key={planKey}
                onClick={() => setSelectedPlan(planKey)}
                className="clickable"
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '14px 16px',
                  borderRadius: 'var(--radius-md)',
                  border: isSelected ? '2px solid var(--ink)' : '1.5px solid var(--border-light)',
                  backgroundColor: isSelected ? 'var(--ink)' : 'var(--white)',
                  color: isSelected ? '#fff' : 'var(--ink)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  width: '100%',
                  opacity: canAfford ? 1 : 0.5,
                }}
              >
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 700 }}>
                    {plan.label}
                    <span style={{ fontSize: '12px', fontWeight: 400, marginLeft: '8px', opacity: 0.7 }}>
                      {plan.duration}
                    </span>
                  </div>
                  <div style={{ fontSize: '11px', opacity: 0.6, marginTop: '2px' }}>{plan.desc}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '16px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Coins size={14} />
                    {plan.credits}
                  </div>
                  {plan.perHour !== '—' && (
                    <div style={{ fontSize: '10px', opacity: 0.5 }}>{plan.perHour}/小时</div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 房间名（可选） */}
      <div style={{ marginBottom: '24px' }}>
        <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--sub)', display: 'block', marginBottom: '6px' }}>
          房间名称（可选）
        </label>
        <input
          className="input-soft"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="自动使用话题作为房间名"
          style={{ width: '100%', padding: '12px 14px', fontSize: '15px', borderRadius: 'var(--radius-md)' }}
        />
      </div>

      {/* 创建按钮 */}
      <button
        className="btn-primary clickable"
        onClick={handleCreate}
        disabled={selectedChars.length < 2 || !affordable}
        style={{
          width: '100%',
          padding: '16px',
          fontSize: '16px',
          fontWeight: 700,
          borderRadius: 'var(--radius-lg)',
          opacity: (selectedChars.length < 2 || !affordable) ? 0.5 : 1,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
        }}
      >
        {affordable ? (
          <>
            开始聊天
            <span style={{ fontSize: '13px', fontWeight: 500, opacity: 0.8 }}>
              ({ROOM_PLANS[selectedPlan].credits} 积分)
            </span>
          </>
        ) : (
          '积分不足'
        )}
      </button>
    </div>
  );
}
