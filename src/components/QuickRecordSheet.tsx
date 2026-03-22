import React, { useState } from 'react';
import { quickRecordCollapse } from '../services/extractionService';
import { X } from 'lucide-react';

const TRIGGERS = ['深夜独处', '争吵后', '发工资', '看到广告', '连输', '无聊空虚'];
const THOUGHTS = ['还能翻本', '就最后一次', '不甘心', '麻木了', '反正已经输了'];
const BEHAVIORS = ['充值', '加注', '借钱', '换平台', '线下赌场'];
const CONSEQUENCES = ['全输', '小赢后又输', '及时停手', '越陷越深'];
const HOT_TAGS = ['深夜', '争吵后', '连输3手', '借贷冲动', '酒后', '周末'];

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function QuickRecordSheet({ isOpen, onClose }: Props) {
  const [step, setStep] = useState(0);
  const [triggerScene, setTriggerScene] = useState('');
  const [thought, setThought] = useState('');
  const [behavior, setBehavior] = useState('');
  const [consequence, setConsequence] = useState('');
  const [hotTags, setHotTags] = useState<string[]>([]);
  const [freeNote, setFreeNote] = useState('');

  if (!isOpen) return null;

  const toggleTag = (tag: string) => {
    setHotTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  };

  const handleSubmit = () => {
    quickRecordCollapse({ triggerScene, thought, behavior, consequence, hotTags, freeNote });
    onClose();
  };

  const steps = [
    { title: '触发场景', options: TRIGGERS, value: triggerScene, set: setTriggerScene },
    { title: '当时念头', options: THOUGHTS, value: thought, set: setThought },
    { title: '具体行为', options: BEHAVIORS, value: behavior, set: setBehavior },
    { title: '结果', options: CONSEQUENCES, value: consequence, set: setConsequence },
  ];

  const currentStep = steps[step];

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      backgroundColor: 'rgba(0,0,0,0.4)',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    }}>
      <div className="card-white animate-in slide-in-from-bottom-4" style={{
        width: '100%', maxWidth: '480px',
        borderRadius: 'var(--radius-xl) var(--radius-xl) 0 0',
        padding: '24px',
        maxHeight: '70vh',
        overflowY: 'auto',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <span style={{ fontSize: '16px', fontWeight: 700, color: 'var(--ink)' }}>30秒快速记录</span>
            <span style={{ fontSize: '12px', color: 'var(--sub)', marginLeft: '8px' }}>
              {step < 4 ? `${step + 1}/5` : '补充'}
            </span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
            <X size={20} color="var(--sub)" />
          </button>
        </div>

        {/* Progress bar */}
        <div style={{
          height: '3px', borderRadius: '2px', backgroundColor: 'rgba(0,0,0,0.06)',
          marginBottom: '20px', overflow: 'hidden',
        }}>
          <div style={{
            height: '100%', borderRadius: '2px', backgroundColor: 'var(--ink)',
            width: `${((step + 1) / 6) * 100}%`,
            transition: 'width 0.3s var(--ease-spring)',
          }} />
        </div>

        {/* Step 0-3: Tap selection */}
        {step < 4 && currentStep && (
          <div>
            <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--ink)', marginBottom: '12px' }}>
              {currentStep.title}
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {currentStep.options.map(opt => (
                <button
                  key={opt}
                  className="clickable"
                  onClick={() => {
                    currentStep.set(opt);
                    setStep(step + 1);
                  }}
                  style={{
                    padding: '10px 16px',
                    borderRadius: 'var(--radius-full)',
                    border: currentStep.value === opt ? '2px solid var(--ink)' : '2px solid rgba(0,0,0,0.06)',
                    backgroundColor: currentStep.value === opt ? 'var(--ink)' : 'var(--white)',
                    color: currentStep.value === opt ? '#fff' : 'var(--ink)',
                    fontSize: '13px', fontWeight: 600,
                    transition: 'all 0.15s var(--ease-spring)',
                  }}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 4: Hot tags (multi-select) */}
        {step === 4 && (
          <div>
            <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--ink)', marginBottom: '12px' }}>
              标签（可多选）
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
              {HOT_TAGS.map(tag => (
                <button
                  key={tag}
                  className="clickable"
                  onClick={() => toggleTag(tag)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: 'var(--radius-full)',
                    border: hotTags.includes(tag) ? '2px solid #E65C5C' : '2px solid rgba(0,0,0,0.06)',
                    backgroundColor: hotTags.includes(tag) ? 'var(--accent-peach)' : 'var(--white)',
                    color: hotTags.includes(tag) ? '#c0392b' : 'var(--ink)',
                    fontSize: '12px', fontWeight: 600,
                  }}
                >
                  {tag}
                </button>
              ))}
            </div>
            <button
              className="clickable"
              onClick={() => setStep(5)}
              style={{
                width: '100%', padding: '12px',
                borderRadius: 'var(--radius-full)',
                border: 'none', backgroundColor: 'var(--ink)', color: '#fff',
                fontSize: '14px', fontWeight: 700,
              }}
            >
              下一步
            </button>
          </div>
        )}

        {/* Step 5: Free note + Submit */}
        {step === 5 && (
          <div>
            <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--ink)', marginBottom: '12px' }}>
              补充（可选）
            </p>
            <textarea
              className="input-soft"
              style={{ width: '100%', fontSize: '14px', minHeight: '80px', resize: 'none' }}
              placeholder="想写什么都行，只给自己看..."
              value={freeNote}
              onChange={e => setFreeNote(e.target.value)}
            />
            <div style={{ marginTop: '12px', display: 'flex', gap: '8px' }}>
              <button
                className="btn-primary clickable"
                onClick={handleSubmit}
                style={{ flex: 1, fontSize: '15px' }}
              >
                完成记录
              </button>
            </div>
          </div>
        )}

        {/* Back button */}
        {step > 0 && (
          <button
            className="clickable"
            onClick={() => setStep(step - 1)}
            style={{
              marginTop: '12px', width: '100%', padding: '10px',
              borderRadius: 'var(--radius-full)',
              border: 'none', backgroundColor: 'transparent',
              color: 'var(--sub)', fontSize: '13px', fontWeight: 600,
            }}
          >
            返回上一步
          </button>
        )}
      </div>
    </div>
  );
}
