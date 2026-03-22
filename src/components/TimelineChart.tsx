import React, { useEffect, useState } from 'react';
import {
  ResponsiveContainer, ComposedChart, Area, Bar, Scatter,
  XAxis, YAxis, Tooltip, Legend, ReferenceLine
} from 'recharts';
import { store, subscribe } from '../services/extractionService';
import { Activity, AlertCircle, TrendingDown, ShieldCheck } from 'lucide-react';

type FilterKey = 'emotion' | 'collapse' | 'loss' | 'saved';

const FILTER_CONFIG: { key: FilterKey; label: string; color: string; icon: any }[] = [
  { key: 'emotion', label: '情绪', color: '#4B7BEC', icon: Activity },
  { key: 'collapse', label: '崩塌', color: '#E65C5C', icon: AlertCircle },
  { key: 'loss', label: '损失', color: '#9B59B6', icon: TrendingDown },
  { key: 'saved', label: '挽回', color: '#27AE60', icon: ShieldCheck },
];

export default function TimelineChart() {
  const [chartData, setChartData] = useState<any[]>([]);
  const [filters, setFilters] = useState<Record<FilterKey, boolean>>({
    emotion: true, collapse: true, loss: true, saved: true,
  });

  useEffect(() => {
    const update = () => {
      const dateMap = new Map<string, any>();
      const toKey = (d: string) =>
        new Date(d).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
      const ensure = (key: string, ts: number) => {
        if (!dateMap.has(key)) dateMap.set(key, { name: key, ts, emotion: null, collapse: 0, loss: 0, saved: 0 });
        return dateMap.get(key)!;
      };

      store.emotions.forEach(e => {
        const key = toKey(e.date);
        const entry = ensure(key, new Date(e.date).getTime());
        entry.emotion = Math.max(entry.emotion || 0, e.intensity);
      });

      store.collapses.forEach(c => {
        const key = toKey(c.date);
        const entry = ensure(key, new Date(c.date).getTime());
        entry.collapse += 1;
      });

      store.financials.forEach(f => {
        const key = toKey(f.date);
        const entry = ensure(key, new Date(f.date).getTime());
        if (f.category === 'loss') {
          entry.loss += f.amount;
        } else {
          entry.saved += f.amount;
        }
      });

      setChartData(Array.from(dateMap.values()).sort((a, b) => a.ts - b.ts));
    };
    update();
    return subscribe(update);
  }, []);

  const toggleFilter = (key: FilterKey) => {
    setFilters(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div>
      {/* Filter Toggles */}
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '12px' }}>
        {FILTER_CONFIG.map(f => {
          const Icon = f.icon;
          const active = filters[f.key];
          return (
            <button
              key={f.key}
              className="clickable"
              onClick={() => toggleFilter(f.key)}
              style={{
                display: 'flex', alignItems: 'center', gap: '5px',
                padding: '6px 12px',
                borderRadius: '20px',
                border: 'none',
                backgroundColor: active ? f.color : 'var(--white)',
                color: active ? '#fff' : 'var(--sub)',
                fontSize: '11px', fontWeight: 700,
                opacity: active ? 1 : 0.5,
                transition: 'all 0.2s ease',
                cursor: 'pointer',
              }}
            >
              <Icon size={12} strokeWidth={2} />
              {f.label}
            </button>
          );
        })}
      </div>

      {/* Chart */}
      <div style={{
        height: '240px',
        backgroundColor: 'var(--white)',
        borderRadius: '16px',
        padding: '16px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
      }}>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#888' }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="emotion" domain={[0, 10]} hide />
              <YAxis yAxisId="money" orientation="right" hide />
              <Tooltip
                contentStyle={{
                  borderRadius: '16px', border: 'none',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                  fontSize: '12px',
                }}
                cursor={{ stroke: 'var(--sub)', strokeWidth: 1, strokeDasharray: '5 5' }}
              />
              {filters.emotion && (
                <Area
                  yAxisId="emotion" type="monotone" dataKey="emotion"
                  stroke="#4B7BEC" fill="#D6E4FF" fillOpacity={0.4} strokeWidth={2}
                  name="情绪强度" connectNulls
                />
              )}
              {filters.emotion && (
                <ReferenceLine yAxisId="emotion" y={8} stroke="#E65C5C" strokeDasharray="3 3" />
              )}
              {filters.loss && (
                <Bar yAxisId="money" dataKey="loss" fill="#9B59B6" opacity={0.7}
                  barSize={12} radius={[6, 6, 0, 0]} name="损失" />
              )}
              {filters.saved && (
                <Bar yAxisId="money" dataKey="saved" fill="#27AE60" opacity={0.7}
                  barSize={12} radius={[6, 6, 0, 0]} name="挽回" />
              )}
              {filters.collapse && (
                <Scatter yAxisId="emotion" dataKey="collapse" fill="#E65C5C"
                  name="崩塌" shape="diamond" />
              )}
              <Legend
                verticalAlign="bottom" height={24}
                iconType="circle" iconSize={8}
                wrapperStyle={{ fontSize: '10px', color: '#888' }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        ) : (
          <div style={{
            height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--sub)', fontSize: '14px',
          }}>
            交流越多，我越懂你。
          </div>
        )}
      </div>
    </div>
  );
}
