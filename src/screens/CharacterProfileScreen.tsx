import React, { useState, useEffect } from 'react';
import { ArrowLeft, Star, ThumbsUp, MessageCircle, Edit3, X, Coins } from 'lucide-react';
import { CHARACTER_MAP } from '../characters';
import {
  getReviewsForCharacter,
  getRatingStats,
  submitReview,
  toggleHelpful,
  hasReviewedCharacter,
  subscribeReviews,
  initReviews,
} from '../services/reviewService';
import { getBalance, subscribeCredits } from '../services/creditsService';
import type { CharacterId, ReviewTag, CharacterReview } from '../types/room';

// ============================================================
// 所有可选标签
// ============================================================

const ALL_TAGS: ReviewTag[] = [
  '犀利', '有料', '搞笑', '真实', '暴躁',
  '话太多', '话太少', '接地气', '毒舌', '暖心',
  '无聊', '吵架王', '骗子本色', '理性', '鸡汤',
];

interface CharacterProfileScreenProps {
  characterId: CharacterId;
  onBack: () => void;
  onCreateRoom: (characterId: CharacterId) => void;
}

// ============================================================
// 时间格式化
// ============================================================

function formatTimeAgo(isoStr: string): string {
  const diff = Date.now() - new Date(isoStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return '刚刚';
  if (mins < 60) return `${mins}分钟前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}小时前`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}天前`;
  if (days < 30) return `${Math.floor(days / 7)}周前`;
  return `${Math.floor(days / 30)}个月前`;
}

// ============================================================
// 星星组件
// ============================================================

function Stars({ rating, size = 14, interactive = false, onChange }: {
  rating: number;
  size?: number;
  interactive?: boolean;
  onChange?: (r: number) => void;
}) {
  return (
    <div style={{ display: 'flex', gap: '2px' }}>
      {[1, 2, 3, 4, 5].map(i => (
        <Star
          key={i}
          size={size}
          fill={i <= rating ? '#f59e0b' : 'none'}
          color={i <= rating ? '#f59e0b' : '#d1d5db'}
          style={{ cursor: interactive ? 'pointer' : 'default' }}
          onClick={() => interactive && onChange?.(i)}
        />
      ))}
    </div>
  );
}

// ============================================================
// 主组件
// ============================================================

export default function CharacterProfileScreen({
  characterId,
  onBack,
  onCreateRoom,
}: CharacterProfileScreenProps) {
  const char = CHARACTER_MAP[characterId];
  const [reviews, setReviews] = useState<CharacterReview[]>([]);
  const [stats, setStats] = useState(() => getRatingStats(characterId));
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [balance, setBalance] = useState(() => getBalance());
  const [, setTick] = useState(0);

  useEffect(() => {
    initReviews();
    refreshData();
    const unsub1 = subscribeReviews(() => refreshData());
    const unsub2 = subscribeCredits(() => setBalance(getBalance()));
    return () => { unsub1(); unsub2(); };
  }, [characterId]);

  function refreshData() {
    setReviews(getReviewsForCharacter(characterId));
    setStats(getRatingStats(characterId));
    setTick(t => t + 1);
  }

  if (!char) return <div>角色不存在</div>;

  const alreadyReviewed = hasReviewedCharacter(characterId);

  return (
    <div style={{ backgroundColor: '#0A0A0A', paddingBottom: '20px' }}>
      {/* ===== Header ===== */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px', backgroundColor: 'var(--white)',
        borderBottom: '1px solid var(--border-light)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}>
            <ArrowLeft size={22} />
          </button>
          <span style={{ fontSize: '18px', fontWeight: 700 }}>角色档案</span>
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '4px',
          padding: '4px 12px', borderRadius: '16px', backgroundColor: 'rgba(230,184,0,0.12)',
        }}>
          <Coins size={14} color="#E6B800" />
          <span style={{ fontSize: '13px', fontWeight: 700, color: '#E6B800' }}>{balance}</span>
        </div>
      </div>

      {/* ===== 角色英雄卡 ===== */}
      <div style={{
        margin: '12px', borderRadius: '16px', overflow: 'hidden',
        background: `linear-gradient(135deg, ${char.bgColor}, ${char.bgColor}dd, #1F1F1F)`,
        border: `2px solid ${char.color}22`,
      }}>
        <div style={{ padding: '24px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: '56px', marginBottom: '8px' }}>{char.emoji}</div>
          <div style={{ fontSize: '22px', fontWeight: 800, color: char.color, marginBottom: '4px' }}>
            {char.name}
          </div>
          <div style={{ fontSize: '14px', color: 'var(--sub)', marginBottom: '12px', lineHeight: 1.5 }}>
            {char.position}
          </div>
          <div style={{
            display: 'inline-block', padding: '4px 14px', borderRadius: '12px',
            backgroundColor: `${char.color}15`, color: char.color,
            fontSize: '12px', fontWeight: 600,
          }}>
            {char.style}
          </div>
        </div>

        {/* 冲突关系 */}
        {char.conflictTargets.length > 0 && (
          <div style={{
            padding: '12px 20px 16px', borderTop: `1px solid ${char.color}15`,
            display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap',
            justifyContent: 'center',
          }}>
            <span style={{ fontSize: '11px', color: 'var(--sub)' }}>常与</span>
            {char.conflictTargets.slice(0, 4).map(tid => {
              const t = CHARACTER_MAP[tid];
              return t ? (
                <span key={tid} style={{
                  fontSize: '11px', padding: '2px 8px', borderRadius: '10px',
                  backgroundColor: 'var(--white)', color: 'var(--ink)',
                  border: '1px solid var(--border-light)',
                }}>
                  {t.emoji} {t.shortName}
                </span>
              ) : null;
            })}
            <span style={{ fontSize: '11px', color: 'var(--sub)' }}>互怼</span>
          </div>
        )}
      </div>

      {/* ===== App Store 风格评分总览 ===== */}
      <div style={{
        margin: '0 12px 12px', padding: '20px', borderRadius: '14px',
        backgroundColor: 'var(--white)', boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
      }}>
        <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
          {/* 左侧大分数 */}
          <div style={{ textAlign: 'center', minWidth: '80px' }}>
            <div style={{ fontSize: '48px', fontWeight: 800, color: 'var(--ink)', lineHeight: 1 }}>
              {stats.totalReviews > 0 ? stats.averageRating.toFixed(1) : '—'}
            </div>
            <Stars rating={Math.round(stats.averageRating)} size={16} />
            <div style={{ fontSize: '12px', color: 'var(--sub)', marginTop: '4px' }}>
              {stats.totalReviews} 条评价
            </div>
          </div>

          {/* 右侧分布柱状图 */}
          <div style={{ flex: 1 }}>
            {[5, 4, 3, 2, 1].map(star => {
              const count = stats.distribution[star - 1] || 0;
              const maxCount = Math.max(...stats.distribution, 1);
              const pct = (count / maxCount) * 100;

              return (
                <div key={star} style={{
                  display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px',
                }}>
                  <span style={{ fontSize: '11px', color: 'var(--sub)', width: '14px', textAlign: 'right' }}>
                    {star}
                  </span>
                  <div style={{
                    flex: 1, height: '8px', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '4px',
                    overflow: 'hidden',
                  }}>
                    <div style={{
                      width: `${pct}%`, height: '100%', borderRadius: '4px',
                      backgroundColor: char.color, transition: 'width 0.3s',
                    }} />
                  </div>
                  <span style={{ fontSize: '10px', color: 'var(--sub)', width: '20px' }}>
                    {count}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ===== 热门标签云 ===== */}
      {stats.topTags.length > 0 && (
        <div style={{
          margin: '0 12px 12px', padding: '14px 16px', borderRadius: '14px',
          backgroundColor: 'var(--white)', boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
        }}>
          <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '10px', color: 'var(--ink)' }}>
            热门标签
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {stats.topTags.map(({ tag, count }) => (
              <span key={tag} style={{
                padding: '4px 12px', borderRadius: '12px',
                backgroundColor: char.bgColor, color: char.color,
                fontSize: '12px', fontWeight: 600,
              }}>
                {tag} <span style={{ opacity: 0.6 }}>({count})</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ===== 评价列表 ===== */}
      <div style={{ margin: '0 12px' }}>
        <div style={{
          fontSize: '13px', fontWeight: 700, marginBottom: '10px', color: 'var(--ink)',
          padding: '0 4px',
        }}>
          全部评价 ({reviews.length})
        </div>

        {reviews.length === 0 ? (
          <div style={{
            padding: '40px 20px', textAlign: 'center', color: 'var(--sub)',
            backgroundColor: 'var(--white)', borderRadius: '14px',
          }}>
            还没有评价，来做第一个评价的人吧！
          </div>
        ) : (
          reviews.map(review => (
            <div key={review.id} style={{
              padding: '14px 16px', marginBottom: '8px', borderRadius: '12px',
              backgroundColor: 'var(--white)', boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
            }}>
              {/* 星星 + 时间 */}
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                marginBottom: '8px',
              }}>
                <Stars rating={review.rating} size={13} />
                <span style={{ fontSize: '11px', color: 'var(--sub)' }}>
                  {formatTimeAgo(review.createdAt)}
                </span>
              </div>

              {/* 评价文字 */}
              {review.text && (
                <div style={{
                  fontSize: '14px', lineHeight: 1.6, color: 'var(--ink)',
                  marginBottom: '8px',
                }}>
                  {review.text}
                </div>
              )}

              {/* 标签 */}
              {review.tags.length > 0 && (
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' }}>
                  {review.tags.map(tag => (
                    <span key={tag} style={{
                      fontSize: '11px', padding: '2px 8px', borderRadius: '8px',
                      backgroundColor: 'rgba(255,255,255,0.06)', color: 'var(--sub)',
                    }}>
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              {/* 底部行：话题来源 + 有用按钮 */}
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                {review.roomTopic ? (
                  <span style={{ fontSize: '11px', color: 'var(--sub)', opacity: 0.7 }}>
                    来自「{review.roomTopic.length > 15 ? review.roomTopic.slice(0, 15) + '...' : review.roomTopic}」
                  </span>
                ) : <span />}

                <button
                  onClick={() => { toggleHelpful(review.id); refreshData(); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '4px',
                    padding: '3px 10px', borderRadius: '10px', border: 'none',
                    backgroundColor: review.userMarkedHelpful ? `${char.color}15` : 'rgba(255,255,255,0.06)',
                    color: review.userMarkedHelpful ? char.color : 'var(--sub)',
                    fontSize: '11px', fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  <ThumbsUp size={11} />
                  有用 {review.helpfulCount > 0 && `(${review.helpfulCount})`}
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* ===== 底部固定按钮区 ===== */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        padding: '12px 16px calc(12px + env(safe-area-inset-bottom, 0px))',
        backgroundColor: 'var(--white)',
        borderTop: '1px solid var(--border-light)',
        display: 'flex', gap: '10px',
        zIndex: 100,
      }}>
        <button
          onClick={() => setShowReviewForm(true)}
          className="clickable"
          style={{
            flex: 1, padding: '14px', borderRadius: '12px',
            border: `2px solid ${char.color}`,
            backgroundColor: 'var(--white)', color: char.color,
            fontSize: '15px', fontWeight: 700, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
          }}
        >
          <Edit3 size={16} />
          {alreadyReviewed ? '再次评价' : '写评价'}
          {!alreadyReviewed && (
            <span style={{ fontSize: '11px', fontWeight: 500, opacity: 0.7 }}>+3积分</span>
          )}
        </button>
        <button
          onClick={() => onCreateRoom(characterId)}
          className="btn-primary clickable"
          style={{
            flex: 1, padding: '14px', borderRadius: '12px',
            fontSize: '15px', fontWeight: 700, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
          }}
        >
          <MessageCircle size={16} />
          和TA聊天
        </button>
      </div>

      {/* ===== 评价表单弹窗 ===== */}
      {showReviewForm && (
        <ReviewFormModal
          characterId={characterId}
          charColor={char.color}
          charBgColor={char.bgColor}
          charEmoji={char.emoji}
          charShortName={char.shortName}
          onClose={() => setShowReviewForm(false)}
          onSubmitted={() => {
            setShowReviewForm(false);
            refreshData();
          }}
        />
      )}
    </div>
  );
}

// ============================================================
// 评价表单弹窗组件
// ============================================================

function ReviewFormModal({ characterId, charColor, charBgColor, charEmoji, charShortName, onClose, onSubmitted }: {
  characterId: CharacterId;
  charColor: string;
  charBgColor: string;
  charEmoji: string;
  charShortName: string;
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const [rating, setRating] = useState(0);
  const [selectedTags, setSelectedTags] = useState<ReviewTag[]>([]);
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const toggleTag = (tag: ReviewTag) => {
    setSelectedTags(prev => {
      if (prev.includes(tag)) return prev.filter(t => t !== tag);
      if (prev.length >= 3) return prev; // 最多3个
      return [...prev, tag];
    });
  };

  const handleSubmit = () => {
    if (rating === 0) return;
    setSubmitting(true);

    submitReview({
      characterId,
      rating,
      text: text.trim(),
      tags: selectedTags,
    });

    setTimeout(() => {
      setSubmitting(false);
      onSubmitted();
    }, 300);
  };

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)',
          zIndex: 200, transition: 'opacity 0.2s',
        }}
      />

      {/* 底部滑出面板 */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        backgroundColor: 'var(--white)', borderRadius: '20px 20px 0 0',
        padding: '20px 16px calc(20px + env(safe-area-inset-bottom, 0px))',
        zIndex: 201,
        maxHeight: '85vh', overflowY: 'auto',
        animation: 'slideUp 0.3s ease-out',
      }}>
        {/* 标题 */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginBottom: '20px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '28px' }}>{charEmoji}</span>
            <span style={{ fontSize: '18px', fontWeight: 700 }}>评价 {charShortName}</span>
          </div>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', cursor: 'pointer', padding: '4px',
          }}>
            <X size={22} color="var(--sub)" />
          </button>
        </div>

        {/* 星星选择 */}
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <div style={{ fontSize: '13px', color: 'var(--sub)', marginBottom: '8px' }}>
            总体评分 {rating > 0 && <span style={{ color: charColor, fontWeight: 700 }}>
              {['', '很差', '较差', '还行', '不错', '很棒'][rating]}
            </span>}
          </div>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
            {[1, 2, 3, 4, 5].map(i => (
              <button
                key={i}
                onClick={() => setRating(i)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer', padding: '4px',
                  transform: i <= rating ? 'scale(1.2)' : 'scale(1)',
                  transition: 'transform 0.15s',
                }}
              >
                <Star
                  size={32}
                  fill={i <= rating ? '#f59e0b' : 'none'}
                  color={i <= rating ? '#f59e0b' : '#d1d5db'}
                />
              </button>
            ))}
          </div>
        </div>

        {/* 标签选择 */}
        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '13px', color: 'var(--sub)', marginBottom: '8px' }}>
            快捷标签（最多3个）
          </div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {ALL_TAGS.map(tag => {
              const isSelected = selectedTags.includes(tag);
              return (
                <button
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  style={{
                    padding: '5px 12px', borderRadius: '12px',
                    border: isSelected ? `1.5px solid ${charColor}` : '1px solid var(--border-light)',
                    backgroundColor: isSelected ? charBgColor : 'var(--white)',
                    color: isSelected ? charColor : 'var(--sub)',
                    fontSize: '13px', fontWeight: isSelected ? 600 : 400,
                    cursor: 'pointer', transition: 'all 0.15s',
                  }}
                >
                  {tag}
                </button>
              );
            })}
          </div>
        </div>

        {/* 文本输入 */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between',
            fontSize: '13px', color: 'var(--sub)', marginBottom: '6px',
          }}>
            <span>写点什么（可选）</span>
            <span>{text.length}/200</span>
          </div>
          <textarea
            value={text}
            onChange={e => setText(e.target.value.slice(0, 200))}
            placeholder="说说你和这个角色聊天的体验..."
            rows={3}
            style={{
              width: '100%', padding: '12px', borderRadius: '12px',
              border: '1.5px solid var(--border-light)',
              fontSize: '14px', resize: 'none', lineHeight: 1.5,
              fontFamily: 'inherit',
              outline: 'none',
            }}
            onFocus={e => { e.target.style.borderColor = charColor; }}
            onBlur={e => { e.target.style.borderColor = 'var(--border-light)'; }}
          />
        </div>

        {/* 积分提示 */}
        {!hasReviewedCharacter(characterId) && (
          <div style={{
            padding: '8px 14px', borderRadius: '10px',
            backgroundColor: 'rgba(230,184,0,0.12)', marginBottom: '16px',
            display: 'flex', alignItems: 'center', gap: '6px',
            fontSize: '12px', color: '#E6B800',
          }}>
            <Coins size={14} />
            首次评价该角色可获得 <strong>3积分</strong> 奖励
          </div>
        )}

        {/* 提交按钮 */}
        <button
          onClick={handleSubmit}
          disabled={rating === 0 || submitting}
          className="btn-primary clickable"
          style={{
            width: '100%', padding: '16px', borderRadius: '14px',
            fontSize: '16px', fontWeight: 700,
            opacity: (rating === 0 || submitting) ? 0.5 : 1,
            cursor: (rating === 0 || submitting) ? 'not-allowed' : 'pointer',
          }}
        >
          {submitting ? '提交中...' : rating === 0 ? '请先选择评分' : '提交评价'}
        </button>
      </div>
    </>
  );
}
