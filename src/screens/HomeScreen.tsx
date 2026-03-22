import React, { useState, useEffect } from 'react';
import {
  Plus, MessageCircle, Clock, ChevronRight, Trash2,
  ThumbsUp, ThumbsDown, Users, Flame, Coins, Sparkles,
  Send, TrendingUp, Zap, MessageSquare, Edit3,
} from 'lucide-react';
import { subscribeRooms, getAllRooms, deleteRoom, setActiveRoom, createRoom } from '../services/roomService';
import { CHARACTER_MAP, ALL_CHARACTER_IDS } from '../characters';
import { SEED_SCENARIOS } from '../data/scenarios';
import {
  getTodayHotTopic,
  getScenariosByCategory,
  getVotes,
  castVote,
  CATEGORY_DEFS,
  ALL_CATEGORIES,
  getUserTopics,
  createUserTopic,
  deleteUserTopic,
  categorizeScenario,
  sortFeed,
  getTopicEngagement,
  getUserTopicEngagement,
  type TopicCategory,
  type UserTopic,
  type FeedSort,
} from '../services/topicService';
import { getBalance, grantVoteReward, subscribeCredits } from '../services/creditsService';
import { getRatingStats, initReviews, subscribeReviews } from '../services/reviewService';
import { Star } from 'lucide-react';
import type { Room, CharacterId, ConflictScenario } from '../types/room';

interface HomeScreenProps {
  onCreateRoom: () => void;
  onOpenRoom: (id: string) => void;
  onCharacterTap?: (charId: CharacterId) => void;
}

// 分类emoji映射
const CATEGORY_EMOJI: Record<string, string> = {};
CATEGORY_DEFS.forEach(def => { CATEGORY_EMOJI[def.key] = def.emoji; });

// 排序选项
const SORT_OPTIONS: { key: FeedSort; label: string; icon: React.ReactNode }[] = [
  { key: 'hot', label: '热门', icon: <Flame size={13} /> },
  { key: 'new', label: '最新', icon: <Zap size={13} /> },
  { key: 'recommended', label: '推荐', icon: <TrendingUp size={13} /> },
];

export default function HomeScreen({ onCreateRoom, onOpenRoom, onCharacterTap }: HomeScreenProps) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [activeCategory, setActiveCategory] = useState<TopicCategory>('全部');
  const [feedSort, setFeedSort] = useState<FeedSort>('hot');
  const [hotTopic] = useState(() => getTodayHotTopic());
  const [votes, setVotes] = useState(() => getVotes(hotTopic.id));
  const [showAllTopics, setShowAllTopics] = useState(false);
  const [balance, setBalance] = useState(() => getBalance());
  const [userTopics, setUserTopics] = useState<UserTopic[]>([]);
  const [customTopic, setCustomTopic] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [, setReviewTick] = useState(0);

  useEffect(() => {
    initReviews();
    setRooms(getAllRooms());
    setUserTopics(getUserTopics());
    const unsub1 = subscribeRooms(() => setRooms(getAllRooms()));
    const unsub2 = subscribeCredits(() => setBalance(getBalance()));
    const unsub3 = subscribeReviews(() => setReviewTick(t => t + 1));
    return () => { unsub1(); unsub2(); unsub3(); };
  }, []);

  const handleOpenRoom = (id: string) => {
    setActiveRoom(id);
    onOpenRoom(id);
  };

  const handleTopicClick = (scenario: ConflictScenario) => {
    const room = createRoom({
      name: scenario.topic.slice(0, 15),
      characters: scenario.characters.filter(c => CHARACTER_MAP[c]) as CharacterId[],
      atmosphere: 'mixed',
      topic: scenario.topic,
    });
    onOpenRoom(room.id);
  };

  const handleDeleteRoom = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm('确定删除这个房间？')) deleteRoom(id);
  };

  const handleVote = (side: 'agree' | 'disagree') => {
    const result = castVote(hotTopic.id, side);
    setVotes(result);
    grantVoteReward(hotTopic.id);
  };

  // 用户自建话题 → 直接创建房间
  const handleCustomTopicSubmit = () => {
    const topic = customTopic.trim();
    if (!topic) return;
    createUserTopic(topic);
    setUserTopics(getUserTopics());

    const otherChars = ALL_CHARACTER_IDS.filter(c => c !== 'junshi');
    const shuffled = [...otherChars].sort(() => Math.random() - 0.5);
    const selectedChars: CharacterId[] = ['junshi', shuffled[0], shuffled[1]];

    const room = createRoom({
      name: topic.slice(0, 15),
      characters: selectedChars,
      atmosphere: 'mixed',
      topic,
    });
    setCustomTopic('');
    setShowCustomInput(false);
    onOpenRoom(room.id);
  };

  const handleUserTopicClick = (ut: UserTopic) => {
    const otherChars = ALL_CHARACTER_IDS.filter(c => c !== 'junshi');
    const shuffled = [...otherChars].sort(() => Math.random() - 0.5);
    const selectedChars: CharacterId[] = ['junshi', shuffled[0], shuffled[1]];

    const room = createRoom({
      name: ut.topic.slice(0, 15),
      characters: selectedChars,
      atmosphere: 'mixed',
      topic: ut.topic,
    });
    onOpenRoom(room.id);
  };

  const handleDeleteUserTopic = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    deleteUserTopic(id);
    setUserTopics(getUserTopics());
  };

  // Feed数据：分类过滤 → 排序
  const categoryTopics = getScenariosByCategory(activeCategory);
  const sortedTopics = sortFeed(categoryTopics, feedSort);
  const displayTopics = showAllTopics ? sortedTopics : sortedTopics.slice(0, 10);

  const timeAgo = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return '刚刚';
    if (mins < 60) return `${mins}分钟前`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}小时前`;
    return `${Math.floor(hours / 24)}天前`;
  };

  const totalVotes = votes.agree + votes.disagree;
  const agreePercent = totalVotes > 0 ? Math.round((votes.agree / totalVotes) * 100) : 50;

  return (
    <div style={{ paddingBottom: '20px', backgroundColor: '#0A0A0A' }}>
      {/* Sticky Header */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 20,
        backgroundColor: '#0A0A0A',
        padding: '16px 16px 12px',
        borderBottom: '1px solid #1F1F1F',
      }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: '26px', fontWeight: 900, marginBottom: '4px', color: '#fff' }}>博弈圆桌</h1>
          <p style={{ fontSize: '13px', color: '#888' }}>AI 多角色群聊 · 在争论中看透赌博</p>
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '4px',
          padding: '5px 12px', borderRadius: '16px',
          backgroundColor: 'rgba(230,184,0,0.12)',
        }}>
          <Coins size={13} color="#E6B800" />
          <span style={{ fontSize: '13px', fontWeight: 700, color: '#E6B800' }}>{balance}</span>
        </div>
      </div>
      </div>

      <div style={{ padding: '0 16px' }}>
      {/* ============ 角色人气榜 ============ */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px',
          padding: '0 2px',
        }}>
          <span style={{ fontSize: '16px' }}>🏆</span>
          <span style={{ fontSize: '14px', fontWeight: 700, color: '#fff' }}>角色人气榜</span>
          <span style={{ fontSize: '11px', color: '#888' }}>{ALL_CHARACTER_IDS.length}位角色</span>
        </div>

        <div style={{
          display: 'flex', gap: '8px', overflowX: 'auto',
          paddingBottom: '4px', WebkitOverflowScrolling: 'touch',
        }}>
          {ALL_CHARACTER_IDS
            .map(charId => ({ charId, stats: getRatingStats(charId) }))
            .sort((a, b) => b.stats.averageRating - a.stats.averageRating)
            .map(({ charId, stats: cStats }) => {
              const char = CHARACTER_MAP[charId];
              if (!char) return null;
              return (
                <div
                  key={charId}
                  className="clickable"
                  onClick={() => onCharacterTap?.(charId)}
                  style={{
                    minWidth: '100px', padding: '14px 12px',
                    borderRadius: '12px', backgroundColor: '#1F1F1F',
                    border: '1px solid rgba(255,255,255,0.08)',
                    cursor: 'pointer', textAlign: 'center', flexShrink: 0,
                  }}
                >
                  <div style={{ fontSize: '32px', marginBottom: '4px' }}>{char.emoji}</div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: char.color, marginBottom: '4px' }}>
                    {char.shortName}
                  </div>
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    gap: '3px', marginBottom: '2px',
                  }}>
                    <Star size={12} fill="#f59e0b" color="#f59e0b" />
                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#fff' }}>
                      {cStats.totalReviews > 0 ? cStats.averageRating.toFixed(1) : '—'}
                    </span>
                  </div>
                  <div style={{ fontSize: '10px', color: '#888' }}>
                    {cStats.totalReviews}条评价
                  </div>
                </div>
              );
            })}
        </div>
      </div>

      {/* ============ 快捷入口 ============ */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        {/* 找军师 */}
        <button
          className="clickable"
          onClick={() => {
            const room = createRoom({
              name: '军师一对一',
              characters: ['junshi'] as CharacterId[],
              atmosphere: 'rational',
              topic: '一对一深度对话',
              plan: 'free',
            });
            onOpenRoom(room.id);
          }}
          style={{
            flex: 1, display: 'flex', alignItems: 'center', gap: '10px',
            padding: '14px', borderRadius: '12px',
            backgroundColor: '#1F1F1F', cursor: 'pointer', textAlign: 'left',
            border: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <span style={{ fontSize: '22px' }}>🎖️</span>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#fff' }}>找军师</div>
            <div style={{ fontSize: '10px', color: '#888' }}>一对一 · 免费</div>
          </div>
        </button>

        {/* 创建房间 */}
        <button
          className="clickable"
          onClick={onCreateRoom}
          style={{
            flex: 1, display: 'flex', alignItems: 'center', gap: '10px',
            padding: '14px', borderRadius: '12px',
            backgroundColor: '#E6B800', color: '#000',
            cursor: 'pointer', textAlign: 'left',
            boxShadow: '0 2px 6px rgba(0,0,0,0.15)', border: 'none',
          }}
        >
          <Plus size={20} />
          <div>
            <div style={{ fontSize: '13px', fontWeight: 700 }}>创建房间</div>
            <div style={{ fontSize: '10px', opacity: 0.7 }}>自选角色 · 定制</div>
          </div>
        </button>
      </div>

      {/* ============ 发起话题（Reddit Create Post） ============ */}
      <div style={{
        marginBottom: '16px',
        borderRadius: '12px',
        backgroundColor: '#1F1F1F',
        padding: '14px 16px',
        border: '1px solid rgba(255,255,255,0.08)',
      }}>
        {showCustomInput ? (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
              <Edit3 size={16} color="#6c63ff" />
              <span style={{ fontSize: '14px', fontWeight: 700, color: '#6c63ff' }}>发起话题</span>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                value={customTopic}
                onChange={e => setCustomTopic(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCustomTopicSubmit()}
                placeholder="说说你想聊什么..."
                autoFocus
                style={{
                  flex: 1, padding: '10px 14px', fontSize: '15px',
                  borderRadius: '10px',
                  border: '1.5px solid rgba(108,99,255,0.2)',
                  outline: 'none', backgroundColor: '#141414', color: '#fff',
                }}
              />
              <button
                onClick={handleCustomTopicSubmit}
                disabled={!customTopic.trim()}
                style={{
                  padding: '10px 16px', borderRadius: '10px',
                  border: 'none', cursor: 'pointer',
                  backgroundColor: customTopic.trim() ? '#6c63ff' : '#1F1F1F',
                  color: '#fff', fontWeight: 600, fontSize: '14px',
                  display: 'flex', alignItems: 'center', gap: '4px',
                }}
              >
                <Send size={15} />
              </button>
            </div>
            {/* 快捷话题 */}
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '10px' }}>
              {['去澳门到底能不能赢', '赌球和投资有什么区别', '老婆发现我赌博了', '网赌平台安全吗', '德州扑克算不算赌博'].map(hint => (
                <button
                  key={hint}
                  onClick={() => { setCustomTopic(hint); }}
                  style={{
                    fontSize: '11px', padding: '4px 10px', borderRadius: '10px',
                    border: '1px solid rgba(255,255,255,0.08)', backgroundColor: '#141414',
                    color: '#888', cursor: 'pointer', fontWeight: 500,
                  }}
                >
                  {hint}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div
            onClick={() => setShowCustomInput(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer',
            }}
          >
            <div style={{
              width: '36px', height: '36px', borderRadius: '50%',
              background: 'linear-gradient(135deg, #6c63ff20, #6c63ff10)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <Edit3 size={16} color="#6c63ff" />
            </div>
            <div style={{
              flex: 1, padding: '9px 14px', borderRadius: '20px',
              backgroundColor: '#141414', color: '#aaa', fontSize: '14px',
            }}>
              发起话题，AI角色立刻开始讨论...
            </div>
          </div>
        )}
      </div>

      {/* ============ 今日热议（置顶帖） ============ */}
      <div style={{
        marginBottom: '12px',
        borderRadius: '12px',
        overflow: 'hidden',
        backgroundColor: '#1F1F1F',
        border: '1px solid rgba(255,255,255,0.08)',
      }}>
        {/* 热议标签 */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          padding: '10px 16px',
          background: 'linear-gradient(90deg, rgba(255,107,53,0.06), rgba(255,107,53,0.02))',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
        }}>
          <Flame size={14} color="#ff6b35" />
          <span style={{ fontSize: '12px', fontWeight: 700, color: '#ff6b35' }}>今日热议</span>
          <span style={{ fontSize: '10px', color: '#ccc', marginLeft: '4px' }}>📌 置顶</span>
          <span style={{ fontSize: '11px', color: 'var(--sub)', marginLeft: 'auto' }}>
            {totalVotes}人参与
          </span>
        </div>

        <div style={{ padding: '12px 16px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 700, lineHeight: 1.4, marginBottom: '8px' }}>
            {hotTopic.topic}
          </h3>

          {/* 角色 + 分类标签 */}
          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '12px' }}>
            {hotTopic.characters.map(charId => {
              const char = CHARACTER_MAP[charId];
              if (!char) return null;
              return (
                <span key={charId} style={{
                  fontSize: '10px', padding: '2px 7px', borderRadius: '5px',
                  backgroundColor: char.bgColor, color: char.color, fontWeight: 500,
                }}>
                  {char.emoji} {char.shortName}
                </span>
              );
            })}
            <span style={{
              fontSize: '10px', padding: '2px 7px', borderRadius: '5px',
              backgroundColor: 'rgba(255,255,255,0.06)', color: '#888',
            }}>
              {hotTopic.type}
            </span>
          </div>

          {/* 投票条 */}
          <div style={{ marginBottom: '10px' }}>
            <div style={{
              display: 'flex', height: '5px', borderRadius: '3px', overflow: 'hidden',
              backgroundColor: 'rgba(255,255,255,0.1)',
            }}>
              <div style={{ width: `${agreePercent}%`, backgroundColor: '#4caf50', transition: 'width 0.3s' }} />
              <div style={{ width: `${100 - agreePercent}%`, backgroundColor: '#ef5350', transition: 'width 0.3s' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#888', marginTop: '3px' }}>
              <span>正方 {agreePercent}%</span>
              <span>反方 {100 - agreePercent}%</span>
            </div>
          </div>

          {/* 操作按钮 */}
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              onClick={() => handleVote('agree')}
              className="clickable"
              style={{
                flex: 1, padding: '8px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                backgroundColor: votes.userVote === 'agree' ? '#4caf50' : 'rgba(76,175,80,0.15)',
                color: votes.userVote === 'agree' ? '#fff' : '#4caf50',
                fontWeight: 600, fontSize: '12px',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
              }}
            >
              <ThumbsUp size={13} /> {votes.agree}
            </button>
            <button
              onClick={() => handleVote('disagree')}
              className="clickable"
              style={{
                flex: 1, padding: '8px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                backgroundColor: votes.userVote === 'disagree' ? '#ef5350' : 'rgba(239,83,80,0.15)',
                color: votes.userVote === 'disagree' ? '#fff' : '#ef5350',
                fontWeight: 600, fontSize: '12px',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
              }}
            >
              <ThumbsDown size={13} /> {votes.disagree}
            </button>
            <button
              onClick={() => handleTopicClick(hotTopic)}
              className="clickable"
              style={{
                padding: '8px 14px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                backgroundColor: '#E6B800', color: '#000',
                fontWeight: 600, fontSize: '12px', whiteSpace: 'nowrap',
              }}
            >
              进入讨论
            </button>
          </div>
        </div>
      </div>

      {/* ============ 分类标签（Subreddit导航） ============ */}
      <div style={{
        display: 'flex', gap: '6px', overflowX: 'auto', marginBottom: '8px',
        paddingBottom: '2px', WebkitOverflowScrolling: 'touch',
      }}>
        {ALL_CATEGORIES.map(cat => {
          const emoji = CATEGORY_EMOJI[cat] || '';
          const count = cat === '全部' ? SEED_SCENARIOS.length : getScenariosByCategory(cat).length;
          return (
            <button
              key={cat}
              onClick={() => { setActiveCategory(cat); setShowAllTopics(false); }}
              className="clickable"
              style={{
                padding: '6px 12px', borderRadius: '8px', cursor: 'pointer',
                backgroundColor: activeCategory === cat ? '#E6B800' : '#1F1F1F',
                color: activeCategory === cat ? '#000' : '#aaa',
                fontSize: '12px', fontWeight: 600, whiteSpace: 'nowrap',
                border: activeCategory === cat ? 'none' : '1px solid rgba(255,255,255,0.08)',
              }}
            >
              {cat === '全部' ? `📋 全部 ${count}` : `${emoji} ${cat} ${count}`}
            </button>
          );
        })}
      </div>

      {/* ============ 排序标签（Hot/New/Recommended） ============ */}
      <div style={{
        display: 'flex', gap: '4px', marginBottom: '12px',
        borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '8px',
      }}>
        {SORT_OPTIONS.map(opt => (
          <button
            key={opt.key}
            onClick={() => setFeedSort(opt.key)}
            style={{
              display: 'flex', alignItems: 'center', gap: '3px',
              padding: '4px 10px', borderRadius: '6px', border: 'none', cursor: 'pointer',
              backgroundColor: feedSort === opt.key ? '#6c63ff15' : 'transparent',
              color: feedSort === opt.key ? '#6c63ff' : '#888',
              fontSize: '12px', fontWeight: feedSort === opt.key ? 700 : 500,
            }}
          >
            {opt.icon} {opt.label}
          </button>
        ))}
      </div>

      {/* ============ 话题Feed（Reddit帖子列表） ============ */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
        {/* 用户自建话题（混入Feed顶部） */}
        {activeCategory === '全部' && userTopics.slice(0, 3).map(ut => {
          const engagement = getUserTopicEngagement(ut);
          return (
            <div
              key={ut.id}
              className="clickable"
              onClick={() => handleUserTopicClick(ut)}
              style={{
                backgroundColor: '#1F1F1F', borderRadius: '12px',
                padding: '14px 16px', cursor: 'pointer',
                border: '1px solid rgba(255,255,255,0.08)',
                borderLeft: '3px solid #6c63ff',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                <span style={{
                  fontSize: '9px', padding: '2px 6px', borderRadius: '4px',
                  backgroundColor: '#6c63ff15', color: '#6c63ff', fontWeight: 700,
                }}>
                  我发起的
                </span>
                {ut.category && (
                  <span style={{ fontSize: '10px', color: '#888' }}>
                    {CATEGORY_EMOJI[ut.category] || '💬'} {ut.category}
                  </span>
                )}
                <span style={{ fontSize: '10px', color: '#ccc', marginLeft: 'auto' }}>
                  {engagement.timeAgo}
                </span>
              </div>
              <div style={{ fontSize: '15px', fontWeight: 600, lineHeight: 1.4, marginBottom: '8px' }}>
                {ut.topic}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '11px', color: '#888' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                  <MessageSquare size={11} /> {engagement.comments}条讨论
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                  <Users size={11} /> {engagement.heat}人围观
                </span>
                <button
                  onClick={(e) => handleDeleteUserTopic(e, ut.id)}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    padding: '2px', color: '#ccc', marginLeft: 'auto', fontSize: '10px',
                  }}
                >
                  <Trash2 size={11} />
                </button>
              </div>
            </div>
          );
        })}

        {/* 种子话题Feed */}
        {displayTopics.map((scenario, idx) => {
          const engagement = getTopicEngagement(scenario);
          const cats = categorizeScenario(scenario);
          const catEmoji = CATEGORY_EMOJI[cats[0]] || '';
          const isHot = engagement.heat > 500;

          return (
            <div
              key={scenario.id}
              className="clickable"
              onClick={() => handleTopicClick(scenario)}
              style={{
                backgroundColor: '#1F1F1F', borderRadius: '12px',
                padding: '14px 16px', cursor: 'pointer',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              {/* 帖子头部：分类 + 时间 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                <span style={{
                  fontSize: '10px', padding: '2px 6px', borderRadius: '4px',
                  backgroundColor: 'rgba(255,255,255,0.06)', color: '#888', fontWeight: 500,
                }}>
                  {catEmoji} {cats[0]}
                </span>
                {scenario.subcategory && (
                  <span style={{ fontSize: '10px', color: '#bbb' }}>
                    · {scenario.subcategory}
                  </span>
                )}
                <span style={{ fontSize: '10px', color: '#ccc', marginLeft: 'auto' }}>
                  {engagement.timeAgo}
                </span>
              </div>

              {/* 帖子标题 */}
              <div style={{
                fontSize: '15px', fontWeight: 600, lineHeight: 1.4, marginBottom: '8px',
                color: 'var(--ink)',
              }}>
                {scenario.topic}
              </div>

              {/* 参与角色 */}
              <div style={{ display: 'flex', gap: '3px', flexWrap: 'wrap', marginBottom: '10px' }}>
                {scenario.characters.slice(0, 4).map(charId => {
                  const char = CHARACTER_MAP[charId];
                  if (!char) return null;
                  return (
                    <span
                      key={charId}
                      onClick={onCharacterTap ? (e) => { e.stopPropagation(); onCharacterTap(charId); } : undefined}
                      style={{
                        fontSize: '10px', padding: '1px 6px', borderRadius: '4px',
                        backgroundColor: char.bgColor, color: char.color,
                        cursor: onCharacterTap ? 'pointer' : 'default',
                      }}
                    >
                      {char.emoji} {char.shortName}
                    </span>
                  );
                })}
                {scenario.characters.length > 4 && (
                  <span style={{ fontSize: '10px', color: '#ccc' }}>+{scenario.characters.length - 4}</span>
                )}
                <span style={{
                  fontSize: '10px', padding: '1px 6px', borderRadius: '4px',
                  backgroundColor: 'rgba(255,255,255,0.06)', color: '#888',
                }}>
                  {scenario.type}
                </span>
              </div>

              {/* 底部统计（Reddit风格） */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: '14px',
                fontSize: '11px', color: '#888',
                borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '8px',
              }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                  <ThumbsUp size={11} /> {Math.round(engagement.heat * 0.7)}
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                  <MessageSquare size={11} /> {engagement.comments}条讨论
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                  <Users size={11} /> {engagement.heat}人围观
                </span>
                {isHot && (
                  <span style={{
                    display: 'flex', alignItems: 'center', gap: '2px',
                    color: '#ff6b35', fontWeight: 600,
                  }}>
                    <Flame size={11} /> 热
                  </span>
                )}
                <ChevronRight size={14} color="#555" style={{ marginLeft: 'auto' }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* 展开更多 */}
      {sortedTopics.length > 10 && !showAllTopics && (
        <button
          onClick={() => setShowAllTopics(true)}
          className="clickable"
          style={{
            width: '100%', padding: '12px', marginBottom: '16px',
            borderRadius: '12px', cursor: 'pointer',
            backgroundColor: '#1F1F1F', fontSize: '13px', color: '#6c63ff',
            fontWeight: 600, border: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          查看全部 {sortedTopics.length} 个话题 →
        </button>
      )}

      {/* ============ 我的房间 ============ */}
      {rooms.length > 0 && (
        <div style={{ marginBottom: '16px' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px',
            padding: '0 2px',
          }}>
            <MessageCircle size={16} color="#aaa" />
            <span style={{ fontSize: '14px', fontWeight: 700, color: '#fff' }}>我的房间</span>
            <span style={{ fontSize: '11px', color: '#888' }}>{rooms.length}</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {rooms.slice(0, 5).map(room => {
              const lastMsg = room.messages[room.messages.length - 1];
              return (
                <div
                  key={room.id}
                  className="clickable"
                  onClick={() => handleOpenRoom(room.id)}
                  role="button"
                  tabIndex={0}
                  style={{
                    display: 'flex', alignItems: 'center', padding: '12px 14px',
                    backgroundColor: '#1F1F1F', borderRadius: '12px',
                    cursor: 'pointer', textAlign: 'left', width: '100%',
                    border: '1px solid rgba(255,255,255,0.08)',
                  }}
                >
                  {/* 角色头像组 */}
                  <div style={{ display: 'flex', marginRight: '12px', flexShrink: 0 }}>
                    {room.characters.slice(0, 3).map((charId, i) => {
                      const char = CHARACTER_MAP[charId];
                      if (!char) return null;
                      return (
                        <span key={charId} style={{
                          width: '28px', height: '28px', borderRadius: '50%',
                          backgroundColor: char.bgColor, border: `2px solid #1F1F1F`,
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '13px', marginLeft: i > 0 ? '-8px' : 0,
                          position: 'relative', zIndex: 3 - i,
                        }}>
                          {char.emoji}
                        </span>
                      );
                    })}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: '#fff' }}>{room.name}</span>
                      <span style={{ fontSize: '10px', color: '#ccc' }}>
                        {timeAgo(room.lastActiveAt)}
                      </span>
                    </div>
                    <div style={{
                      fontSize: '12px', color: '#888',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {lastMsg
                        ? (lastMsg.role === 'character' && lastMsg.characterId
                          ? `${CHARACTER_MAP[lastMsg.characterId]?.shortName || ''}: ${lastMsg.text.slice(0, 35)}`
                          : lastMsg.text.slice(0, 35))
                        : room.topic}
                    </div>
                  </div>
                  <button
                    onClick={(e) => handleDeleteRoom(e, room.id)}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      padding: '6px', color: '#ddd',
                    }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              );
            })}

            {rooms.length > 5 && (
              <div style={{ textAlign: 'center', fontSize: '12px', color: '#888', padding: '4px' }}>
                共 {rooms.length} 个房间
              </div>
            )}
          </div>
        </div>
      )}

      </div>
    </div>
  );
}
