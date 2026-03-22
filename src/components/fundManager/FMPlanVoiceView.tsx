import React, { useState, useEffect } from 'react';
import { ArrowLeft, Mic, MicOff, Send, Loader, Sparkles, AlertTriangle, RotateCcw } from 'lucide-react';
import { useSpeechRecognition } from '../../hooks/useSpeechRecognition';
import { FM_COLORS } from '../../theme';
import type { SessionPlan } from '../../types/fundManager';

interface FMPlanVoiceViewProps {
  onBack: () => void;
  onSubmit: (plan: Partial<SessionPlan>) => void;
}

export default function FMPlanVoiceView({ onBack, onSubmit }: FMPlanVoiceViewProps) {
  const {
    transcript, interimTranscript, isListening, isSupported,
    startListening, stopListening, resetTranscript, error: speechError,
  } = useSpeechRecognition('zh-CN');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 不支持语音时显示提示
  if (!isSupported) {
    return (
      <div style={{ padding: '20px 16px 20px', maxWidth: 480, margin: '0 auto' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24,
        }}>
          <button className="clickable" onClick={onBack}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6 }}>
            <ArrowLeft size={20} color={FM_COLORS.textPrimary} />
          </button>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: FM_COLORS.textPrimary }}>
            语音输入
          </h2>
        </div>
        <div style={{
          textAlign: 'center', padding: '40px 20px',
          background: FM_COLORS.cardBg, borderRadius: 20,
          border: `1px solid ${FM_COLORS.border}`,
        }}>
          <MicOff size={40} color={FM_COLORS.textSecondary} style={{ marginBottom: 16 }} />
          <p style={{ fontSize: 15, fontWeight: 600, color: FM_COLORS.textPrimary, margin: '0 0 8px' }}>
            当前浏览器不支持语音识别
          </p>
          <p style={{ fontSize: 13, color: FM_COLORS.textSecondary, margin: 0 }}>
            请使用 Chrome 浏览器，或切换到"自由文字"方式
          </p>
        </div>
      </div>
    );
  }

  const fullText = transcript + interimTranscript;

  const handleParse = async () => {
    if (!transcript.trim()) return;
    stopListening();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/fm-parse-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: transcript.trim() }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `解析失败 (${res.status})`);
      }

      const data = await res.json();
      onSubmit({
        ...data.plan,
        input_method: 'voice',
        raw_input: transcript.trim(),
      });
    } catch (e: any) {
      setError(e.message || '解析失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '20px 16px 120px', maxWidth: 480, margin: '0 auto' }}>
      {/* 顶部 */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24,
      }}>
        <button className="clickable" onClick={onBack}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6 }}>
          <ArrowLeft size={20} color={FM_COLORS.textPrimary} />
        </button>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: FM_COLORS.textPrimary }}>
            语音输入
          </h2>
          <p style={{ fontSize: 12, color: FM_COLORS.textSecondary, margin: 0 }}>
            开口说出你的计划，30秒搞定
          </p>
        </div>
      </div>

      {/* 提示 */}
      <div style={{
        background: `${FM_COLORS.primary}06`, borderRadius: 14,
        padding: '12px 14px', marginBottom: 20,
        border: `1px solid ${FM_COLORS.border}`,
        fontSize: 13, color: FM_COLORS.textSecondary, lineHeight: 1.6,
      }}>
        💡 试试这样说："今天带五千，每手一百，最多输一千五就走，赢两千就收，玩一个半小时"
      </div>

      {/* 录音按钮区域 */}
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <button
          className="clickable"
          onClick={isListening ? stopListening : startListening}
          style={{
            width: 100, height: 100, borderRadius: 50,
            border: 'none', cursor: 'pointer',
            background: isListening
              ? `radial-gradient(circle, ${FM_COLORS.danger}, ${FM_COLORS.danger}cc)`
              : `linear-gradient(135deg, ${FM_COLORS.primary}, ${FM_COLORS.secondary})`,
            color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: isListening
              ? `0 0 0 12px ${FM_COLORS.danger}20, 0 4px 20px ${FM_COLORS.danger}30`
              : '0 4px 20px rgba(230, 184, 0, 0.2)',
            transition: 'all 0.3s ease',
            margin: '0 auto',
          }}
        >
          {isListening ? <MicOff size={36} /> : <Mic size={36} />}
        </button>
        <p style={{
          fontSize: 14, fontWeight: 600, marginTop: 12,
          color: isListening ? FM_COLORS.danger : FM_COLORS.textSecondary,
        }}>
          {isListening ? '正在录音... 点击停止' : '点击开始说话'}
        </p>
      </div>

      {/* 语音识别错误 */}
      {speechError && (
        <div style={{
          background: 'rgba(230,57,70,0.15)', borderRadius: 12, padding: '10px 14px',
          marginBottom: 16, fontSize: 13, color: '#FF6B6B',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <AlertTriangle size={16} /> {speechError}
        </div>
      )}

      {/* 识别文本 */}
      {fullText && (
        <div style={{
          background: FM_COLORS.cardBg, borderRadius: 16,
          border: `1px solid ${FM_COLORS.border}`,
          padding: '16px', marginBottom: 16,
        }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            marginBottom: 10,
          }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: FM_COLORS.textSecondary }}>
              识别结果
            </span>
            <button
              className="clickable"
              onClick={resetTranscript}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 4,
                fontSize: 12, color: FM_COLORS.textSecondary,
              }}
            >
              <RotateCcw size={12} /> 清空
            </button>
          </div>
          <p style={{
            fontSize: 15, color: FM_COLORS.textPrimary,
            margin: 0, lineHeight: 1.6,
          }}>
            {transcript}
            {interimTranscript && (
              <span style={{ color: FM_COLORS.textSecondary, opacity: 0.6 }}>
                {interimTranscript}
              </span>
            )}
          </p>
        </div>
      )}

      {/* API 错误 */}
      {error && (
        <div style={{
          background: 'rgba(230,57,70,0.15)', borderRadius: 12, padding: '10px 14px',
          marginBottom: 16, fontSize: 13, color: '#FF6B6B',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <AlertTriangle size={16} /> {error}
        </div>
      )}

      {/* 解析按钮 */}
      {transcript.trim() && (
        <button
          className="clickable"
          onClick={handleParse}
          disabled={loading}
          style={{
            width: '100%', padding: '14px', borderRadius: 30,
            background: loading ? '#d1d5db'
              : `linear-gradient(135deg, ${FM_COLORS.primary}, ${FM_COLORS.secondary})`,
            color: '#fff', border: 'none',
            fontSize: 16, fontWeight: 700,
            cursor: loading ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}
        >
          {loading ? <Loader size={18} /> : <Sparkles size={18} />}
          {loading ? 'AI 解析中...' : 'AI 解析语音'}
        </button>
      )}
    </div>
  );
}
