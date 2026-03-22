import React, { useState, useEffect } from 'react';
import {
  Coins, CalendarCheck, Gift, TrendingUp, TrendingDown,
  Clock, ChevronRight, Trash2, Shield, Info, ArrowLeft,
  Sparkles, Wallet, History, Star, MessageSquare, LogOut, User,
  Cloud,
} from 'lucide-react';
import {
  getCredits, getBalance, doCheckin, getCheckinInfo,
  getRecentTransactions, subscribeCredits,
  type CreditTransaction, type TransactionType,
} from '../services/creditsService';
import { getMyReviews, deleteReview, subscribeReviews } from '../services/reviewService';
import { CHARACTER_MAP } from '../characters';
import type { CharacterReview } from '../types/room';
import { supabase, getCurrentUser } from '../services/supabaseClient';
import { usePushSubscription } from '../hooks/usePushSubscription';
import { Bell, BellOff } from 'lucide-react';

type SubView = null | 'transactions' | 'my_reviews';

const TX_TYPE_LABELS: Record<TransactionType, { label: string; color: string }> = {
  new_user_bonus: { label: '新用户赠送', color: '#4caf50' },
  daily_checkin:  { label: '每日签到',   color: '#ff9800' },
  vote_reward:    { label: '投票奖励',   color: '#2196f3' },
  create_room:    { label: '创建房间',   color: '#f44336' },
  invite_human:   { label: '邀请好友',   color: '#9c27b0' },
  junshi_analysis:{ label: '军师分析',   color: '#607d8b' },
  review_reward:  { label: '评价奖励',   color: '#ff9800' },
  purchase:       { label: '充值',       color: '#4caf50' },
};

export default function SettingsScreen() {
  const [subView, setSubView] = useState<SubView>(null);
  const [balance, setBalance] = useState(() => getBalance());
  const [checkinInfo, setCheckinInfo] = useState(() => getCheckinInfo());
  const [checkinResult, setCheckinResult] = useState<{ credits: number; streak: number } | null>(null);
  const [transactions, setTransactions] = useState<CreditTransaction[]>(() => getRecentTransactions(50));
  const [myReviews, setMyReviews] = useState<CharacterReview[]>(() => getMyReviews());

  useEffect(() => {
    const refresh = () => {
      setBalance(getBalance());
      setCheckinInfo(getCheckinInfo());
      setTransactions(getRecentTransactions(50));
    };
    const unsub1 = subscribeCredits(refresh);
    const unsub2 = subscribeReviews(() => setMyReviews(getMyReviews()));
    return () => { unsub1(); unsub2(); };
  }, []);

  const handleCheckin = () => {
    const result = doCheckin();
    if (result) {
      setCheckinResult(result);
      setTimeout(() => setCheckinResult(null), 3000);
    }
  };

  const handleClearData = () => {
    if (confirm('确定要清除所有数据吗？积分、房间、对话记录都会被删除，不可恢复。')) {
      localStorage.clear();
      window.location.reload();
    }
  };

  const creditsData = getCredits();

  // 我的评价列表
  if (subView === 'my_reviews') {
    return (
      <div style={{ padding: '20px 16px', paddingBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
          <button
            onClick={() => setSubView(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}
          >
            <ArrowLeft size={22} />
          </button>
          <h1 style={{ fontSize: '20px', fontWeight: 800 }}>我的评价</h1>
          <span style={{ fontSize: '13px', color: 'var(--sub)' }}>{myReviews.length}条</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {myReviews.length === 0 ? (
            <p style={{ color: 'var(--sub)', fontSize: '14px', textAlign: 'center', padding: '40px 0' }}>
              还没有发表过评价
            </p>
          ) : myReviews.map(review => {
            const char = CHARACTER_MAP[review.characterId];
            return (
              <div key={review.id} style={{
                padding: '14px 16px', backgroundColor: 'var(--white)',
                borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <span style={{ fontSize: '20px' }}>{char?.emoji || '?'}</span>
                  <span style={{ fontSize: '14px', fontWeight: 700, color: char?.color || '#fff' }}>
                    {char?.shortName || '未知'}
                  </span>
                  <div style={{ display: 'flex', gap: '1px', marginLeft: '4px' }}>
                    {[1, 2, 3, 4, 5].map(i => (
                      <Star key={i} size={12}
                        fill={i <= review.rating ? '#f59e0b' : 'none'}
                        color={i <= review.rating ? '#f59e0b' : '#d1d5db'}
                      />
                    ))}
                  </div>
                  <span style={{ fontSize: '11px', color: 'var(--sub)', marginLeft: 'auto' }}>
                    {new Date(review.createdAt).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })}
                  </span>
                </div>
                {review.text && (
                  <div style={{ fontSize: '13px', lineHeight: 1.5, color: '#fff', marginBottom: '6px' }}>
                    {review.text}
                  </div>
                )}
                {review.tags.length > 0 && (
                  <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '8px' }}>
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
                <button
                  onClick={() => {
                    if (confirm('确定删除这条评价？')) {
                      deleteReview(review.id);
                      setMyReviews(getMyReviews());
                    }
                  }}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    fontSize: '12px', color: '#ccc', padding: '2px',
                  }}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // 交易记录列表
  if (subView === 'transactions') {
    return (
      <div style={{ padding: '20px 16px', paddingBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
          <button
            onClick={() => setSubView(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}
          >
            <ArrowLeft size={22} />
          </button>
          <h1 style={{ fontSize: '20px', fontWeight: 800 }}>交易记录</h1>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {transactions.length === 0 ? (
            <p style={{ color: 'var(--sub)', fontSize: '14px', textAlign: 'center', padding: '40px 0' }}>
              暂无交易记录
            </p>
          ) : transactions.map(tx => {
            const typeInfo = TX_TYPE_LABELS[tx.type] || { label: tx.type, color: '#999' };
            const isIncome = tx.amount > 0;
            return (
              <div key={tx.id} style={{
                display: 'flex', alignItems: 'center', padding: '12px 14px',
                backgroundColor: 'var(--white)', borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-light)',
              }}>
                <div style={{
                  width: '36px', height: '36px', borderRadius: '50%',
                  backgroundColor: isIncome ? 'rgba(76,175,80,0.15)' : 'rgba(244,67,54,0.15)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  {isIncome ? <TrendingUp size={16} color="#4caf50" /> : <TrendingDown size={16} color="#f44336" />}
                </div>
                <div style={{ flex: 1, marginLeft: '12px', minWidth: 0 }}>
                  <div style={{ fontSize: '14px', fontWeight: 600 }}>{tx.description}</div>
                  <div style={{ fontSize: '11px', color: 'var(--sub)', marginTop: '2px' }}>
                    <span style={{
                      display: 'inline-block', padding: '1px 6px', borderRadius: '4px',
                      backgroundColor: typeInfo.color + '18', color: typeInfo.color,
                      fontSize: '10px', fontWeight: 600, marginRight: '6px',
                    }}>
                      {typeInfo.label}
                    </span>
                    {new Date(tx.timestamp).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
                <span style={{
                  fontSize: '15px', fontWeight: 700,
                  color: isIncome ? '#4caf50' : '#f44336',
                }}>
                  {isIncome ? '+' : ''}{tx.amount}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px 16px', paddingBottom: '20px' }}>
      {/* Header */}
      <h1 style={{ fontSize: '28px', fontWeight: 800, marginBottom: '4px' }}>
        我的
      </h1>
      <p style={{ fontSize: '13px', color: 'var(--sub)', marginBottom: '20px' }}>
        积分钱包与账户管理
      </p>

      {/* ============ 积分钱包卡片 ============ */}
      <div style={{
        marginBottom: '20px',
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
        color: '#fff',
        padding: '24px 20px',
        position: 'relative',
      }}>
        {/* 装饰 */}
        <div style={{
          position: 'absolute', top: '-20px', right: '-20px',
          width: '120px', height: '120px', borderRadius: '50%',
          background: 'rgba(255,255,255,0.05)',
        }} />
        <div style={{
          position: 'absolute', bottom: '-30px', left: '-10px',
          width: '80px', height: '80px', borderRadius: '50%',
          background: 'rgba(255,255,255,0.03)',
        }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <Wallet size={18} color="#ffd700" />
          <span style={{ fontSize: '13px', fontWeight: 600, opacity: 0.8 }}>积分余额</span>
        </div>

        <div style={{ fontSize: '42px', fontWeight: 800, marginBottom: '4px', letterSpacing: '-1px' }}>
          {balance.toLocaleString()}
        </div>
        <div style={{ fontSize: '12px', opacity: 0.5, marginBottom: '20px' }}>
          ≈ ${(balance / 100).toFixed(2)} USD
        </div>

        <div style={{ display: 'flex', gap: '16px' }}>
          <div>
            <div style={{ fontSize: '11px', opacity: 0.5 }}>累计获得</div>
            <div style={{ fontSize: '15px', fontWeight: 700, color: '#4caf50' }}>
              +{creditsData.totalEarned.toLocaleString()}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '11px', opacity: 0.5 }}>累计消费</div>
            <div style={{ fontSize: '15px', fontWeight: 700, color: '#ef5350' }}>
              -{creditsData.totalSpent.toLocaleString()}
            </div>
          </div>
        </div>
      </div>

      {/* ============ 每日签到 ============ */}
      <div style={{
        marginBottom: '20px',
        padding: '16px',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border-light)',
        backgroundColor: 'var(--white)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '40px', height: '40px', borderRadius: '50%',
              backgroundColor: 'rgba(230,184,0,0.12)', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
            }}>
              <CalendarCheck size={20} color="#E6B800" />
            </div>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 700 }}>每日签到</div>
              <div style={{ fontSize: '12px', color: 'var(--sub)' }}>
                {checkinInfo.streak > 0 ? `已连续签到 ${checkinInfo.streak} 天` : '开始连续签到吧'}
              </div>
            </div>
          </div>

          <button
            onClick={handleCheckin}
            disabled={!checkinInfo.canCheckin}
            className="clickable"
            style={{
              padding: '8px 20px',
              borderRadius: '20px',
              border: 'none',
              cursor: checkinInfo.canCheckin ? 'pointer' : 'default',
              backgroundColor: checkinInfo.canCheckin ? '#E6B800' : '#333',
              color: checkinInfo.canCheckin ? '#000' : '#888',
              fontSize: '13px',
              fontWeight: 700,
            }}
          >
            {checkinInfo.canCheckin ? '签到' : '已签到'}
          </button>
        </div>

        {/* 签到成功提示 */}
        {checkinResult && (
          <div style={{
            marginTop: '12px', padding: '10px 14px',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'rgba(230,184,0,0.12)',
            display: 'flex', alignItems: 'center', gap: '8px',
          }}>
            <Sparkles size={16} color="#E6B800" />
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#E6B800' }}>
              签到成功！获得 {checkinResult.credits} 积分，连续 {checkinResult.streak} 天
            </span>
          </div>
        )}
      </div>

      {/* ============ 积分获取途径 ============ */}
      <div style={{
        marginBottom: '20px',
        padding: '16px',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border-light)',
        backgroundColor: 'var(--white)',
      }}>
        <h3 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Gift size={16} color="#4caf50" /> 获取积分
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {[
            { label: '每日签到', value: '5-12 积分/天', desc: '连续签到有加成' },
            { label: '话题投票', value: '2 积分/次', desc: '参与今日热议投票' },
            { label: '评价角色', value: '3 积分/角色', desc: '首次评价每个角色' },
            { label: '邀请好友', value: '50 积分/人', desc: '好友注册后奖励' },
          ].map(item => (
            <div key={item.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600 }}>{item.label}</div>
                <div style={{ fontSize: '11px', color: 'var(--sub)' }}>{item.desc}</div>
              </div>
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#4caf50' }}>{item.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ============ 功能入口 ============ */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
        {/* 交易记录 */}
        <button
          onClick={() => setSubView('transactions')}
          className="clickable"
          style={{
            display: 'flex', alignItems: 'center', padding: '14px 16px',
            backgroundColor: 'var(--white)', border: '1px solid var(--border-light)',
            borderRadius: 'var(--radius-md)', cursor: 'pointer',
            textAlign: 'left', width: '100%',
          }}
        >
          <div style={{
            width: '36px', height: '36px', borderRadius: '50%',
            backgroundColor: 'rgba(33,150,243,0.15)', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <History size={18} color="#2196f3" />
          </div>
          <div style={{ flex: 1, marginLeft: '12px' }}>
            <div style={{ fontSize: '14px', fontWeight: 600 }}>交易记录</div>
            <div style={{ fontSize: '12px', color: 'var(--sub)' }}>查看积分收支明细</div>
          </div>
          <ChevronRight size={16} color="var(--sub)" />
        </button>

        {/* 我的评价 */}
        <button
          onClick={() => setSubView('my_reviews')}
          className="clickable"
          style={{
            display: 'flex', alignItems: 'center', padding: '14px 16px',
            backgroundColor: 'var(--white)', border: '1px solid var(--border-light)',
            borderRadius: 'var(--radius-md)', cursor: 'pointer',
            textAlign: 'left', width: '100%',
          }}
        >
          <div style={{
            width: '36px', height: '36px', borderRadius: '50%',
            backgroundColor: 'rgba(230,184,0,0.12)', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <MessageSquare size={18} color="#E6B800" />
          </div>
          <div style={{ flex: 1, marginLeft: '12px' }}>
            <div style={{ fontSize: '14px', fontWeight: 600 }}>我的评价</div>
            <div style={{ fontSize: '12px', color: 'var(--sub)' }}>
              已发表 {myReviews.length} 条角色评价
            </div>
          </div>
          <ChevronRight size={16} color="var(--sub)" />
        </button>

        {/* 账户信息 */}
        {(() => {
          const user = getCurrentUser();
          const displayName = user?.user_metadata?.full_name
            || user?.user_metadata?.name
            || user?.email?.split('@')[0]
            || '用户';
          const avatarUrl = user?.user_metadata?.avatar_url || user?.user_metadata?.picture;
          return (
            <div style={{
              display: 'flex', alignItems: 'center', padding: '14px 16px',
              backgroundColor: 'var(--white)', border: '1px solid var(--border-light)',
              borderRadius: 'var(--radius-md)',
            }}>
              {avatarUrl ? (
                <img src={avatarUrl} alt="" style={{
                  width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                  objectFit: 'cover',
                }} />
              ) : (
                <div style={{
                  width: 36, height: 36, borderRadius: '50%',
                  backgroundColor: 'rgba(124,58,237,0.2)', display: 'flex',
                  alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <User size={18} color="#7C3AED" />
                </div>
              )}
              <div style={{ flex: 1, marginLeft: 12 }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{displayName}</div>
                <div style={{ fontSize: 12, color: 'var(--sub)' }}>{user?.email || ''}</div>
              </div>
              <Cloud size={14} color="#4caf50" style={{ marginRight: 4 }} />
              <span style={{ fontSize: 11, color: '#4caf50', fontWeight: 600 }}>已同步</span>
            </div>
          );
        })()}

        {/* 推送通知 */}
        <PushNotificationToggle />

        {/* 退出登录 */}
        <button
          onClick={async () => {
            if (confirm('确定要退出登录吗？')) {
              await supabase.auth.signOut();
              // AuthGate 会自动检测到 session 变化并显示登录页
            }
          }}
          className="clickable"
          style={{
            display: 'flex', alignItems: 'center', padding: '14px 16px',
            backgroundColor: 'var(--white)', border: '1px solid var(--border-light)',
            borderRadius: 'var(--radius-md)', cursor: 'pointer',
            textAlign: 'left', width: '100%',
          }}
        >
          <div style={{
            width: 36, height: 36, borderRadius: '50%',
            backgroundColor: 'rgba(230,184,0,0.12)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <LogOut size={18} color="#E6B800" />
          </div>
          <div style={{ flex: 1, marginLeft: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 600 }}>退出登录</div>
            <div style={{ fontSize: 12, color: 'var(--sub)' }}>数据已安全存储在云端</div>
          </div>
        </button>

        {/* 清除本地缓存 */}
        <button
          onClick={handleClearData}
          className="clickable"
          style={{
            display: 'flex', alignItems: 'center', padding: '14px 16px',
            backgroundColor: 'var(--white)', border: '1px solid var(--border-light)',
            borderRadius: 'var(--radius-md)', cursor: 'pointer',
            textAlign: 'left', width: '100%',
          }}
        >
          <div style={{
            width: 36, height: 36, borderRadius: '50%',
            backgroundColor: 'rgba(244,67,54,0.15)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <Trash2 size={18} color="#f44336" />
          </div>
          <div style={{ flex: 1, marginLeft: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#f44336' }}>清除本地缓存</div>
            <div style={{ fontSize: 12, color: 'var(--sub)' }}>不会影响云端数据</div>
          </div>
        </button>
      </div>

      {/* 版本信息 */}
      <div style={{ textAlign: 'center', padding: '16px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginBottom: '4px' }}>
          <Info size={12} color="var(--sub)" />
          <span style={{ fontSize: '12px', color: 'var(--sub)' }}>博弈圆桌 v2.0 (Preview)</span>
        </div>
        <div style={{ fontSize: '11px', color: 'var(--sub)', opacity: 0.5 }}>
          AI 多角色群聊平台
        </div>
      </div>
    </div>
  );
}

// ── 推送通知开关 ──

function PushNotificationToggle() {
  const { isSupported, permission, isSubscribed, loading, subscribe, unsubscribe } = usePushSubscription();

  // iOS Safari 需要 PWA 模式才支持推送
  const isPWA = window.matchMedia('(display-mode: standalone)').matches
    || (navigator as any).standalone === true;

  if (!isSupported) {
    return (
      <div
        style={{
          display: 'flex', alignItems: 'center', padding: '14px 16px',
          backgroundColor: 'var(--white)', border: '1px solid var(--border-light)',
          borderRadius: 'var(--radius-md)', width: '100%',
        }}
      >
        <div style={{
          width: 36, height: 36, borderRadius: '50%',
          backgroundColor: 'rgba(255,255,255,0.06)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <BellOff size={18} color="#888" />
        </div>
        <div style={{ flex: 1, marginLeft: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>推送通知</div>
          <div style={{ fontSize: 12, color: 'var(--sub)' }}>
            {/iPhone|iPad/.test(navigator.userAgent) && !isPWA
              ? '请先"添加到主屏幕"，然后从主屏幕打开即可开启推送'
              : '当前浏览器不支持推送通知'}
          </div>
        </div>
      </div>
    );
  }

  const handleToggle = async () => {
    if (isSubscribed) {
      await unsubscribe();
    } else {
      await subscribe();
    }
  };

  return (
    <button
      onClick={handleToggle}
      disabled={loading || permission === 'denied'}
      className="clickable"
      style={{
        display: 'flex', alignItems: 'center', padding: '14px 16px',
        backgroundColor: 'var(--white)', border: '1px solid var(--border-light)',
        borderRadius: 'var(--radius-md)', cursor: loading ? 'not-allowed' : 'pointer',
        textAlign: 'left', width: '100%', opacity: loading ? 0.6 : 1,
      }}
    >
      <div style={{
        width: 36, height: 36, borderRadius: '50%',
        backgroundColor: isSubscribed ? 'rgba(33,150,243,0.15)' : 'rgba(255,255,255,0.06)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        {isSubscribed ? <Bell size={18} color="#2196F3" /> : <BellOff size={18} color="#888" />}
      </div>
      <div style={{ flex: 1, marginLeft: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>
          {isSubscribed ? '推送通知已开启' : '开启推送通知'}
        </div>
        <div style={{ fontSize: 12, color: 'var(--sub)' }}>
          {permission === 'denied'
            ? '通知权限被拒绝，请在浏览器设置中允许'
            : isSubscribed
              ? '情绪预警、关键时刻将推送到通知栏'
              : '实战中情绪波动时收到提醒'}
        </div>
      </div>
      <div style={{
        width: 44, height: 24, borderRadius: 12,
        backgroundColor: isSubscribed ? '#2196F3' : '#444',
        position: 'relative', transition: 'all 0.2s', flexShrink: 0,
      }}>
        <div style={{
          width: 20, height: 20, borderRadius: '50%',
          backgroundColor: '#eee', position: 'absolute',
          top: 2, left: isSubscribed ? 22 : 2,
          transition: 'all 0.2s',
          boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
        }} />
      </div>
    </button>
  );
}
