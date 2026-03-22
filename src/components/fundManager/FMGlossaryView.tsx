import React, { useState } from 'react';
import { ArrowLeft, Search, BookOpen, HelpCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { FM_GLOSSARY, FM_FAQ, EVENT_STATUS_CONFIG, CATEGORY_EMOJI, FAQ_CATEGORY_EMOJI } from '../../constants/fmGlossary';
import { FM_COLORS } from '../../theme';
import type { GlossaryTerm, GlossaryFAQ } from '../../constants/fmGlossary';

interface FMGlossaryViewProps {
  onBack: () => void;
}

type Tab = 'glossary' | 'faq';
type TermCategory = '全部' | GlossaryTerm['category'];
type FAQCategory = '全部' | GlossaryFAQ['category'];

export default function FMGlossaryView({ onBack }: FMGlossaryViewProps) {
  const [tab, setTab] = useState<Tab>('glossary');
  const [searchText, setSearchText] = useState('');
  const [termCategory, setTermCategory] = useState<TermCategory>('全部');
  const [faqCategory, setFaqCategory] = useState<FAQCategory>('全部');
  const [expandedFAQ, setExpandedFAQ] = useState<string | null>(null);

  // 过滤词条
  const filteredTerms = FM_GLOSSARY.filter(t => {
    const matchSearch = !searchText ||
      t.term.includes(searchText) ||
      t.definition.includes(searchText);
    const matchCategory = termCategory === '全部' || t.category === termCategory;
    return matchSearch && matchCategory;
  });

  // 过滤 FAQ
  const filteredFAQ = FM_FAQ.filter(f => {
    const matchSearch = !searchText ||
      f.question.includes(searchText) ||
      f.answer.includes(searchText);
    const matchCategory = faqCategory === '全部' || f.category === faqCategory;
    return matchSearch && matchCategory;
  });

  const termCategories: TermCategory[] = ['全部', '资金相关', '风险指标', '操作行为', '风控规则', '报告状态', '纪律指标'];
  const faqCategories: FAQCategory[] = ['全部', '资金', '风险', '操作', '风控', '报告', '纪律'];

  /** 获取分类显示文本（emoji + 名称） */
  const getTermCatLabel = (cat: TermCategory) => {
    if (cat === '全部') return '📚 全部';
    return `${CATEGORY_EMOJI[cat]} ${cat}`;
  };

  const getFaqCatLabel = (cat: FAQCategory) => {
    if (cat === '全部') return '📚 全部';
    return `${FAQ_CATEGORY_EMOJI[cat]} ${cat}`;
  };

  // 按分类分组展示词条
  const groupedTerms = termCategory === '全部' && !searchText;

  return (
    <div style={{
      background: FM_COLORS.bg,
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', padding: '16px',
        background: FM_COLORS.cardBg, borderBottom: `1px solid ${FM_COLORS.border}`,
        position: 'sticky', top: 0, zIndex: 10,
      }}>
        <button onClick={onBack} style={{
          background: 'none', border: 'none', cursor: 'pointer', padding: 4,
        }}>
          <ArrowLeft size={20} color={FM_COLORS.textPrimary} />
        </button>
        <h2 style={{
          flex: 1, textAlign: 'center', fontSize: 16, fontWeight: 700,
          color: FM_COLORS.textPrimary, margin: 0,
        }}>
          术语说明 & 帮助
        </h2>
        <div style={{ width: 28 }} />
      </div>

      {/* Tab 切换 */}
      <div style={{
        display: 'flex', gap: 0, padding: '12px 16px 0',
        background: FM_COLORS.cardBg,
      }}>
        {[
          { key: 'glossary' as Tab, label: '术语说明', icon: BookOpen },
          { key: 'faq' as Tab, label: '常见问题', icon: HelpCircle },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            style={{
              flex: 1, padding: '10px 0', border: 'none', cursor: 'pointer',
              background: 'none',
              borderBottom: tab === key ? `2px solid ${FM_COLORS.secondary}` : '2px solid transparent',
              color: tab === key ? FM_COLORS.secondary : FM_COLORS.textSecondary,
              fontWeight: tab === key ? 700 : 400, fontSize: 14,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}
          >
            <Icon size={16} />
            {label}
          </button>
        ))}
      </div>

      {/* 搜索 */}
      <div style={{ padding: '12px 16px', background: FM_COLORS.cardBg }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: FM_COLORS.bg, borderRadius: 10, padding: '8px 12px',
        }}>
          <Search size={16} color={FM_COLORS.textSecondary} />
          <input
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            placeholder="搜索术语或问题..."
            style={{
              flex: 1, border: 'none', background: 'none', outline: 'none',
              fontSize: 14, color: FM_COLORS.textPrimary,
            }}
          />
          {searchText && (
            <button
              onClick={() => setSearchText('')}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 12, color: FM_COLORS.textSecondary,
              }}
            >
              清除
            </button>
          )}
        </div>
      </div>

      {/* 内容区 */}
      <div style={{ flex: 1, overflow: 'auto', padding: '0 16px 80px' }}>

        {tab === 'glossary' && (
          <>
            {/* 分类筛选（emoji chips） */}
            <div style={{
              display: 'flex', gap: 6, padding: '8px 0', overflowX: 'auto',
              WebkitOverflowScrolling: 'touch',
            }}>
              {termCategories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setTermCategory(cat)}
                  style={{
                    padding: '6px 12px', borderRadius: 16, border: 'none',
                    fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
                    background: termCategory === cat ? FM_COLORS.secondary : FM_COLORS.cardBg,
                    color: termCategory === cat ? '#fff' : FM_COLORS.textSecondary,
                    boxShadow: termCategory === cat ? 'none' : '0 1px 3px rgba(0,0,0,0.06)',
                  }}
                >
                  {getTermCatLabel(cat)}
                </button>
              ))}
            </div>

            {/* 分组展示（全部视图下按类别分段） */}
            {groupedTerms ? (
              termCategories.filter(c => c !== '全部').map(cat => {
                const catTerms = FM_GLOSSARY.filter(t => t.category === cat);
                if (catTerms.length === 0) return null;
                return (
                  <div key={cat} style={{ marginBottom: 16 }}>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '10px 4px 6px', marginTop: 4,
                    }}>
                      <span style={{ fontSize: 18 }}>{CATEGORY_EMOJI[cat]}</span>
                      <span style={{
                        fontSize: 15, fontWeight: 700, color: FM_COLORS.textPrimary,
                      }}>
                        {cat}
                      </span>
                      <span style={{
                        fontSize: 11, color: FM_COLORS.textSecondary,
                      }}>
                        {catTerms.length} 条
                      </span>
                    </div>
                    {catTerms.map(term => (
                      <React.Fragment key={term.id}><TermCard term={term} /></React.Fragment>
                    ))}
                  </div>
                );
              })
            ) : (
              <>
                {filteredTerms.map(term => (
                  <React.Fragment key={term.id}><TermCard term={term} /></React.Fragment>
                ))}
              </>
            )}

            {!groupedTerms && filteredTerms.length === 0 && (
              <div style={{
                textAlign: 'center', padding: 40, color: FM_COLORS.textSecondary, fontSize: 14,
              }}>
                没有找到匹配的术语
              </div>
            )}

            {/* 事件分类快速参考（在报告状态分类或全部时显示） */}
            {(termCategory === '全部' || termCategory === '报告状态') && !searchText && (
              <div style={{
                background: FM_COLORS.cardBg, borderRadius: 14, padding: 16,
                marginTop: 4, marginBottom: 12, border: `1px solid ${FM_COLORS.border}`,
              }}>
                <div style={{
                  fontSize: 14, fontWeight: 700, color: FM_COLORS.textPrimary,
                  marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8,
                }}>
                  <span style={{ fontSize: 16 }}>⚡</span>
                  状态图标速查
                </div>
                {Object.entries(EVENT_STATUS_CONFIG).map(([key, cfg]) => (
                  <div key={key} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '8px 0',
                    borderBottom: `1px solid ${FM_COLORS.border}`,
                  }}>
                    <span style={{ fontSize: 18, width: 28, textAlign: 'center' }}>{cfg.icon}</span>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: cfg.color }}>
                        {cfg.label}
                      </div>
                      <div style={{ fontSize: 11, color: FM_COLORS.textSecondary }}>
                        {cfg.description}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {tab === 'faq' && (
          <>
            {/* FAQ 分类 */}
            <div style={{
              display: 'flex', gap: 6, padding: '8px 0', overflowX: 'auto',
              WebkitOverflowScrolling: 'touch',
            }}>
              {faqCategories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setFaqCategory(cat)}
                  style={{
                    padding: '6px 12px', borderRadius: 16, border: 'none',
                    fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
                    background: faqCategory === cat ? FM_COLORS.secondary : FM_COLORS.cardBg,
                    color: faqCategory === cat ? '#fff' : FM_COLORS.textSecondary,
                    boxShadow: faqCategory === cat ? 'none' : '0 1px 3px rgba(0,0,0,0.06)',
                  }}
                >
                  {getFaqCatLabel(cat)}
                </button>
              ))}
            </div>

            {/* FAQ 列表 */}
            {filteredFAQ.map(faq => (
              <React.Fragment key={faq.id}><FAQCard
                faq={faq}
                expanded={expandedFAQ === faq.id}
                onToggle={() => setExpandedFAQ(expandedFAQ === faq.id ? null : faq.id)}
              /></React.Fragment>
            ))}

            {filteredFAQ.length === 0 && (
              <div style={{
                textAlign: 'center', padding: 40, color: FM_COLORS.textSecondary, fontSize: 14,
              }}>
                没有找到匹配的问题
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── 词条卡片 ──
function TermCard({ term }: { term: GlossaryTerm }) {
  return (
    <div style={{
      background: FM_COLORS.cardBg, borderRadius: 14, padding: '14px 16px',
      marginBottom: 8, border: `1px solid ${FM_COLORS.border}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        {term.important && <span style={{ fontSize: 12 }}>⭐</span>}
        <span style={{
          fontSize: 15, fontWeight: 700, color: FM_COLORS.textPrimary,
        }}>
          {term.term}
        </span>
      </div>

      <div style={{ fontSize: 13, color: FM_COLORS.textPrimary, lineHeight: 1.6, marginBottom: 6 }}>
        {term.definition}
      </div>

      {term.formula && (
        <div style={{
          fontSize: 12, padding: '6px 10px', borderRadius: 8,
          background: 'rgba(59,130,246,0.08)', color: '#60A5FA', marginBottom: 6,
          fontFamily: 'monospace',
        }}>
          📐 {term.formula}
        </div>
      )}

      {term.example && (
        <div style={{
          fontSize: 12, color: FM_COLORS.textSecondary, lineHeight: 1.5,
          paddingLeft: 10, borderLeft: `3px solid ${FM_COLORS.accent}`,
          background: FM_COLORS.inputBg, borderRadius: '0 6px 6px 0', padding: '6px 10px 6px 10px',
        }}>
          💡 {term.example}
        </div>
      )}
    </div>
  );
}

// ── FAQ 卡片 ──
function FAQCard({ faq, expanded, onToggle }: {
  faq: GlossaryFAQ;
  expanded: boolean;
  onToggle: () => void;
}) {
  const emoji = FAQ_CATEGORY_EMOJI[faq.category] || '❓';

  return (
    <div style={{
      background: FM_COLORS.cardBg, borderRadius: 14,
      marginBottom: 8, border: `1px solid ${FM_COLORS.border}`,
      overflow: 'hidden',
    }}>
      <button
        onClick={onToggle}
        style={{
          width: '100%', padding: '14px 16px', border: 'none',
          background: 'none', cursor: 'pointer', textAlign: 'left',
          display: 'flex', alignItems: 'center', gap: 10,
        }}
      >
        <span style={{ fontSize: 16, flexShrink: 0 }}>{emoji}</span>
        <span style={{
          flex: 1, fontSize: 14, fontWeight: 600, color: FM_COLORS.textPrimary,
          lineHeight: 1.4,
        }}>
          {faq.question}
        </span>
        {expanded ? (
          <ChevronUp size={16} color={FM_COLORS.textSecondary} />
        ) : (
          <ChevronDown size={16} color={FM_COLORS.textSecondary} />
        )}
      </button>

      {expanded && (
        <div style={{
          padding: '0 16px 14px', fontSize: 13, color: FM_COLORS.textSecondary,
          lineHeight: 1.7, borderTop: `1px solid ${FM_COLORS.border}`,
          paddingTop: 12,
        }}>
          {faq.answer}
        </div>
      )}
    </div>
  );
}
