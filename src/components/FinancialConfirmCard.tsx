import React, { useState } from 'react';
import { Check, X, MessageCircle } from 'lucide-react';
import type { FundSource, FundDirection } from '../types/schema';
import type { PendingFinancial } from '../services/extractionService';
import {
  confirmPendingFinancial, dismissPendingFinancial, getCurrencySymbol,
} from '../services/extractionService';

const FUND_SOURCES: FundSource[] = ['闲钱', '借贷', '生活金'];

/**
 * 聊天内嵌的财务确认卡片
 * AI 提取到金额后显示，用户确认方向+来源后写入账本
 */
export default function FinancialConfirmCard({ pending }: { pending: PendingFinancial }) {
  const [selectedSource, setSelectedSource] = useState<FundSource>('闲钱');
  const [confirmed, setConfirmed] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const sym = getCurrencySymbol(pending.currency);

  if (confirmed) {
    return (
      <div style={{
        padding: '10px 16px', borderRadius: '16px',
        backgroundColor: 'rgba(39,174,96,0.06)', border: '1px solid rgba(39,174,96,0.15)',
        display: 'flex', alignItems: 'center', gap: '8px',
        fontSize: '13px', color: '#27AE60', fontWeight: 600,
      }}>
        <Check size={14} />
        已记入 {sym}{pending.amount.toLocaleString()}
        {pending.direction === '投入' && selectedSource !== '闲钱' && (
          <span style={{
            fontSize: '10px', padding: '1px 6px', borderRadius: '4px',
            backgroundColor: selectedSource === '借贷' ? 'rgba(230,92,92,0.1)' : 'rgba(196,118,0,0.1)',
            color: selectedSource === '借贷' ? '#E65C5C' : '#c47600',
            fontWeight: 700,
          }}>
            {selectedSource}
          </span>
        )}
      </div>
    );
  }

  if (dismissed) {
    return null; // 完全消失
  }

  // 重复引用 → 小标签
  if (pending.isDuplicate) {
    return (
      <div style={{
        padding: '6px 12px', borderRadius: '12px',
        backgroundColor: 'rgba(0,0,0,0.03)',
        display: 'inline-flex', alignItems: 'center', gap: '6px',
        fontSize: '12px', color: 'var(--sub)', fontWeight: 500,
      }}>
        <MessageCircle size={12} />
        {sym}{pending.amount.toLocaleString()} 早前已记录
      </div>
    );
  }

  // 全新待确认 → 完整卡片
  return (
    <div style={{
      padding: '14px 16px', borderRadius: '16px',
      backgroundColor: 'var(--white)',
      border: '1.5px solid rgba(0,0,0,0.08)',
      boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
    }}>
      {/* 标题行 */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: '12px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{
            width: '8px', height: '8px', borderRadius: '50%',
            backgroundColor: pending.direction === '投入' ? '#E65C5C' : '#27AE60',
          }} />
          <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--ink)' }}>
            {pending.direction}
          </span>
          <span style={{
            fontSize: '18px', fontWeight: 700, fontFamily: 'monospace',
            color: pending.direction === '投入' ? '#E65C5C' : '#27AE60',
          }}>
            {sym}{pending.amount.toLocaleString()}
          </span>
        </div>
        <button
          onClick={() => { dismissPendingFinancial(pending.id); setDismissed(true); }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}
        >
          <X size={16} color="var(--sub)" />
        </button>
      </div>

      {/* 来源选择（仅投入） */}
      {pending.direction === '投入' && (
        <div style={{ marginBottom: '12px' }}>
          <p style={{ fontSize: '11px', color: 'var(--sub)', fontWeight: 600, marginBottom: '8px' }}>
            钱从哪来？
          </p>
          <div style={{ display: 'flex', gap: '6px' }}>
            {FUND_SOURCES.map(src => {
              const active = selectedSource === src;
              const isRed = src === '借贷';
              const isOrange = src === '生活金';
              return (
                <button
                  key={src}
                  onClick={() => setSelectedSource(src)}
                  style={{
                    flex: 1, padding: '8px 6px', borderRadius: '10px',
                    border: active
                      ? `2px solid ${isRed ? '#E65C5C' : isOrange ? '#c47600' : 'var(--ink)'}`
                      : '2px solid rgba(0,0,0,0.06)',
                    backgroundColor: active
                      ? (isRed ? 'rgba(230,92,92,0.06)' : isOrange ? 'rgba(196,118,0,0.06)' : 'rgba(0,0,0,0.02)')
                      : 'transparent',
                    fontSize: '13px', fontWeight: active ? 700 : 500,
                    color: active
                      ? (isRed ? '#E65C5C' : isOrange ? '#c47600' : 'var(--ink)')
                      : 'var(--sub)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {src}
                </button>
              );
            })}
          </div>
          {selectedSource === '借贷' && (
            <p style={{ fontSize: '11px', color: '#E65C5C', fontWeight: 600, marginTop: '6px' }}>
              ⚠ 借钱去赌是最危险的信号
            </p>
          )}
          {selectedSource === '生活金' && (
            <p style={{ fontSize: '11px', color: '#c47600', fontWeight: 600, marginTop: '6px' }}>
              ⚠ 你确定要动用生活金吗？
            </p>
          )}
        </div>
      )}

      {/* 确认按钮 */}
      <button
        onClick={() => {
          confirmPendingFinancial(
            pending.id,
            pending.direction === '投入' ? selectedSource : undefined
          );
          setConfirmed(true);
        }}
        style={{
          width: '100%', padding: '10px', borderRadius: '12px',
          border: 'none', cursor: 'pointer',
          backgroundColor: selectedSource === '借贷' && pending.direction === '投入' ? '#E65C5C' : 'var(--ink)',
          color: '#fff', fontSize: '14px', fontWeight: 700,
          transition: 'opacity 0.15s',
        }}
      >
        <Check size={14} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
        确认记入
      </button>
    </div>
  );
}
