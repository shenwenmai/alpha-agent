# 博弈系统 — Agent 角色架构设计文档

> 版本：v0.1（讨论稿）
> 日期：2026-03-20
> 状态：设计中，未实现

---

## 一、产品定位

**博弈系统 = 玩家（赌客）操作系统的风控内核**

我们不指导下注的点。我们是比人类更精密的风控专家团队。

```
不管：押庄押闲 / 下注打法 / 何时入注
只管：资金状态 / 行为状态 / 风险边界 / 纪律执行
```

核心价值：玩家进场前、实战中、离场后都有一支精密团队在盯着他的操作。

---

## 二、系统架构总览

```
┌─────────────────────────────────────────────────────┐
│                   数据输入层                          │
│  进场前：自检评级 + SessionPlan                       │
│  实战中：每手 FMEvent（赢/输/金额/注码）              │
│  行为层：实际注码 vs 计划注码 + 是否遵从上一条建议      │
└──────────────────────┬──────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────┐
│              三 Agent 并行分析层                      │
│                                                     │
│  ┌───────────────┐  ┌──────────────┐  ┌──────────┐  │
│  │ 保守派·风险官  │  │ 平衡派·行为官 │  │激进派·推演官│ │
│  │ (价值网络)    │  │ (策略网络)   │  │ (MCTS)   │  │
│  └───────────────┘  └──────────────┘  └──────────┘  │
└──────────────────────┬──────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────┐
│              规则合议引擎                             │
│  否决优先 → 分歧处理 → 主导权判断 → 最终指令           │
└──────────────────────┬──────────────────────────────┘
                       ↓
        ┌──────────────┴──────────────┐
        ↓                             ↓
┌──────────────────┐       ┌──────────────────────────┐
│   实战输出        │       │      复盘输出              │
│  指令 + 关键指标  │       │  三角色完整圆桌 + 指令回溯  │
└──────────────────┘       └──────────────────────────┘
```

---

## 三、数据输入层

### 3.1 自检系统（已实现，完整纳入Agent输入）

**28个信号，5个维度，加权评分（权重1-5级）：**

| 维度 | 信号数 | 致命信号（权重5） | 归属Agent |
|---|---|---|---|
| 身体 | 6 | body_3（思想无法集中）/ body_5（突闪头晕目眩） | 保守派基准 |
| 环境 | 7 | 无 | 行为官辅助 |
| 赌场 | 2 | 无 | 保守派基准 |
| 精神 | 7 | mental_1（急躁易怒）/ mental_3（没有节制） | 行为官核心 |
| 时间与状态 | 6 | state_4（以小博大连续大注） | 行为官核心 |

**进场前自检**：15个项目（含赌场维度）
**即时自检**：22个项目（不含赌场，含环境实时信号）

**注**：`RiskEvalInput` 已有 `selfCheckRiskLevel` + `selfCheckHandsAgo` 两个字段，自检结果已喂入三维引擎。Agent直接读取此输出，无需重复计算。

### 3.2 进场前基准（影响全场Agent阈值）

```typescript
interface PreEntryContext {
  risk_level: 'safe' | 'caution' | 'warning' | 'danger';
  weighted_score: number;       // 加权总分
  lethal_signals: string[];     // 勾选的致命信号ID（权重≥5）
  checked_ids: string[];        // 所有勾选信号

  // 基准系数调整规则：
  // safe     → 阈值不变（标准模式）
  // caution  → 所有阈值收紧10%
  // warning  → 所有阈值收紧25%，激进派发言权降低
  // danger   → 所有阈值收紧40%，进场本身已是警告
}
```

**信号到Agent的直接映射：**

```
保守派 ← body_3 / body_5（致命，直接触发否决建议）
         casino_1 / casino_2（历史负向锚定，收紧生存边际计算）

行为官 ← mental_6（不听劝告 → 忽视型检测加权×1.5）
         mental_3 + state_4（没有节制+以小博大 → 违规加码预警升级）
         mental_1 + mental_5（急躁+拼命三郎 → 追损型预警前置触发）
         mental_7（得意忘形 → 激活 overconfidence_rally 场景监控）

推演官 ← 即时自检中任何致命信号 → collapseProb 上调修正系数1.3
         env_7（很蹊跷的输牌 → 上头信号，崩盘路径权重加重）
```

### 3.2 每手行为数据（新增，现有系统缺失）

```typescript
interface HandBehavior {
  // 现有字段（FMEvent已有）
  amount: number;           // 赢/输金额
  bet_unit: number;         // 本手注码

  // 需新增的行为字段
  bet_deviation_pct: number;      // 实际注码偏离基码的百分比
                                  // >0 = 加注，<0 = 缩注
  is_violation: boolean;          // 是否违反plan.max_bet_unit
  is_timid: boolean;              // 注码 < plan.base_unit * 0.5（畏缩信号）
  followed_last_advice: boolean | null; // 是否遵从了上一条建议
                                        // null = 第一手或无建议
}
```

### 3.3 现有引擎输出（直接复用）

`FMEvent.risk_snapshot` 已包含以下字段，Agent直接读取：

```typescript
risk_snapshot: {
  survivalProb: number;    // 生存概率 → 保守派核心输入
  etpProb: number;         // 情绪转折概率 → 平衡派核心输入
  collapseProb: number;    // 崩盘概率 → 激进派核心输入
  toxicCombos: string[];   // 当手触发的毒药组合
  keyMoments: string[];    // 当手触发的关键时刻
  level: string;           // L0-L4
  tier: string;            // 风险档位
}
```

---

## 四、三 Agent 规格定义

### Agent 1 — 保守派·风险官

**对标**：AlphaGo 价值网络（Value Network）
**核心问题**：现在的盘面，我们还安全吗？

**监控数据**：
- `metrics.distance_to_stop_loss` — 距止损距离
- `metrics.net_pnl` — 净盈亏
- `metrics.net_loss_hands` — 净输手数
- `risk_snapshot.survivalProb` — 生存概率
- `metrics.is_in_lock_profit_zone` — 是否进入锁盈区

**分析框架**：
1. 计算生存安全边际 = `distance_to_stop_loss / plan.base_unit`（还能承受几手基码的亏损）
2. 判断盘面顺逆风：`net_pnl > 0` = 顺风，`net_pnl < 0` = 逆风
3. 锁盈状态检查：进入锁盈区后，任何回撤都需要发声

**否决触发条件**：
- `survivalProb < 0.3`（生存概率低于30%）
- `distance_to_stop_loss <= plan.base_unit * 2`（距止损不足2手基码）
- 锁盈区内回撤超过50%

**输出结构**：
```
{
  safety_status: 'safe' | 'caution' | 'critical',
  survival_margin: number,     // 还能承受几手
  survival_prob: number,       // 0-1
  veto: boolean,
  veto_reason?: string,
  assessment: string           // LLM生成的1-2句分析
}
```

**风格**：冷静、精准、不废话。只说数字和事实。

---

### Agent 2 — 平衡派·行为官

**对标**：AlphaGo 策略网络（Policy Network）
**核心问题**：玩家的行为，和理性基准相比，偏移了多少？

**监控数据**：
- `hand.bet_deviation_pct` — 本手注码偏差率
- `metrics.current_loss_streak` / `current_win_streak` — 连输/连赢串
- `hand.followed_last_advice` — 是否遵从上一条建议
- `hand.is_violation` — 是否违规加码
- `hand.is_timid` — 是否畏缩
- `risk_snapshot.etpProb` — 情绪转折概率

**分析框架**：
1. 计算行为偏差指数：连续违规次数 × 偏差幅度
2. 识别行为模式：
   - 追损型：连输后注码升高
   - 冲动型：单手注码偏差 > 200%
   - 畏缩型：盈利状态下注码持续低于基码50%
   - 忽视型：连续3+次不遵从建议
3. 推荐"标准动作"：回归基码 / 降注一级 / 观望一手

**否决触发条件**：
- 连续2手违规加码（`unauthorized_raise_count >= 2`）
- 注码偏差超过基准300%
- 连续3次忽略建议后当前处于亏损状态

**输出结构**：
```
{
  behavior_status: 'normal' | 'deviating' | 'critical',
  behavior_pattern: string | null,   // 追损型/冲动型/畏缩型/忽视型
  deviation_index: number,           // 0-10
  recommended_action: string,        // 回归基码/降注/观望/继续
  veto: boolean,
  assessment: string                 // LLM生成的1-2句分析
}
```

**风格**：客观、直接、像一面镜子。描述行为而不评判人。

---

### Agent 3 — 激进派·推演官

**对标**：AlphaGo MCTS（蒙特卡洛树搜索）
**核心问题**：按当前趋势继续，前方10手会走到哪里？

**监控数据**：
- `metrics.elapsed_minutes` + `metrics.hands_per_hour` — 时间疲劳系数
- 缠斗累计次数（`grindingState.isGrinding`）
- `risk_snapshot.collapseProb` — 崩盘概率
- 连输/连赢趋势方向
- `preEntryContext.risk_level` — 进场前基准状态

**分析框架**：
1. 计算疲劳系数：`elapsed_minutes / plan.max_duration_minutes`（越高，容错越低）
2. 向后推演：当前趋势延续10手，资金/情绪路径预判
3. 识别临界点：哪一手是最可能的情绪爆发点
4. 判断是否存在"退出窗口"：当前是离开的好时机吗？

**否决触发条件**：
- `collapseProb > 0.6`（10手内崩盘概率超60%）
- 疲劳系数 > 0.9 且当前处于亏损状态
- 进场前 `risk_level = danger` 且当前出现任何亏损

**输出结构**：
```
{
  collapse_prob_10h: number,      // 前方10手崩盘概率 0-1
  fatigue_coefficient: number,   // 疲劳系数 0-1
  critical_hand_estimate: number | null,  // 预计第几手触发ETP
  exit_window: boolean,          // 当前是退出窗口吗
  veto: boolean,
  assessment: string             // LLM生成的1-2句前瞻分析
}
```

**风格**：向前看，不评价当下。永远在推演下一步走向哪里。

---

## 五、规则合议引擎

### 5.1 优先级规则

```
Level 1（最高）：任意Agent触发否决
  → 直接映射到对应指令，不可被其他Agent稀释

Level 2：多Agent一致
  → 直接输出共识指令

Level 3：有分歧，按局势主导
  → 逆风局（net_pnl < 0）：风险官主导
  → 顺风局（net_pnl > 0）：行为官主导
  → ETP临界（etpProb > 0.6）：推演官主导

Level 4：轻微分歧，均衡模式
  → 取三Agent建议的"中位数"
```

### 5.2 最终指令集

| 指令 | 等级 | 触发逻辑 |
|---|---|---|
| ✅ **继续 · 保持节奏** | 正常 | 三Agent均无警告 |
| 📉 **降注一级** | 预警 | 行为官检测偏差 OR 风险官安全边际收窄 |
| ⏸️ **观望一手** | 预警 | 推演官检测短期崩盘概率上升 |
| ❄️ **暂停 · 冷静** | 警告 | 连续忽视建议 OR ETP临界 OR 多指标同时亮灯 |
| 🔒 **锁盈 · 建议离桌** | 强烈建议 | 盈利触达目标 OR 锁盈区大幅回撤 |
| 🛑 **止损 · 必须离桌** | 强制 | 任意Agent触发否决 AND survivalProb < 0.2 |

**金融衍生话术扩展（观望一手的延伸）**：
- "持仓观察" — 不入注，看走势
- "减仓一半" — 降注50%继续观察
- "空仓等信号" — 连续跳过2-3手
- "收益已锁定，仓位归零" — 离桌指令的金融化表达

---

## 六、场景覆盖

### 6.1 现有33个场景（全部保留，改为Agent分析输入）

现有场景继续作为场景识别的标签，但不再直接触发固定话术。
场景标签作为Agent的上下文输入，帮助Agent理解当前处于哪种风险模式。

### 6.2 新增场景（本次设计补充）

| 场景Key | 触发条件 | 主责Agent | 类型 |
|---|---|---|---|
| `overconfidence_rally` | 连赢≥4手 + 注码连续扩大 | 行为官 | 行为偏差 |
| `lock_regret_override` | 锁盈已触发 + 用户仍继续入注 | 风险官 | 违规行为 |
| `entry_deviation` | 第1-3手注码偏离计划≥150% | 行为官 | 违规行为 |
| `rebound_impulse` | 赢→输→下一手注码>基准2倍 | 推演官 | 行为偏差 |
| `observe_spike` | 观望后复入注码翻倍 | 推演官 | 行为偏差 |
| `timid_shrink` | 盈利状态 + 注码持续<基码50% | 行为官 | 畏缩行为 |
| `pre_entry_high_risk` | 进场前自检 warning/danger + 仍入场 | 风险官 | 基准风险 |

### 6.3 行为维度（新增监控，现有系统缺失）

```
违规类（过度）：
  - 单手注码超过 plan.max_bet_unit
  - 连续2手注码偏差 > 200%
  - 忽略系统建议后加注

畏缩类（不足）：
  - 注码 < plan.base_unit × 0.5（盈利状态下）
  - 连续3+手跳过不入注（非主动观望）
  - 锁盈区内过度保守导致错失出局时机

进场前状态类：
  - self_check warning/danger 仍入场
  - 进场计划与历史习惯偏差过大
```

---

## 七、数据存储设计

### 7.1 每手存储（新增字段）

在 `FMEvent` 的 `risk_snapshot` 中追加：

```typescript
agent_analysis?: {
  // 三Agent各自的分析结果（完整版，供复盘使用）
  conservative: {
    safety_status: string;
    survival_margin: number;
    survival_prob: number;
    veto: boolean;
    veto_reason?: string;
    assessment: string;      // LLM生成文本
  };
  balanced: {
    behavior_status: string;
    behavior_pattern: string | null;
    deviation_index: number;
    recommended_action: string;
    veto: boolean;
    assessment: string;
  };
  aggressive: {
    collapse_prob_10h: number;
    fatigue_coefficient: number;
    critical_hand_estimate: number | null;
    exit_window: boolean;
    veto: boolean;
    assessment: string;
  };

  // 合议结果（实战展示用）
  consensus: {
    directive: string;       // 最终指令文本
    directive_key: string;   // 指令Key（用于UI图标）
    lead_agent: 'conservative' | 'balanced' | 'aggressive';
    dissent?: string;        // 少数意见（有分歧时）
    key_metrics: {
      survival_prob: number;
      collapse_prob: number;
      behavior_deviation: number;
    };
  };
}
```

### 7.2 行为数据（新增字段）

在 `FMEvent` 中追加：

```typescript
behavior?: {
  bet_deviation_pct: number;       // 注码偏差率
  is_violation: boolean;           // 是否违规
  is_timid: boolean;               // 是否畏缩
  followed_last_advice: boolean | null;  // 是否遵从上一条建议
}
```

---

## 八、实战 vs 复盘 输出对比

### 8.1 实战输出（极简）

```
┌─────────────────────────────────┐
│  ⚠️  降注一级                    │
│                                 │
│  生存 74%  崩盘概率 38%          │
│  行为偏差 +180%                  │
│                                 │
│  [稳定] → [偏移]                 │
└─────────────────────────────────┘
```

### 8.2 复盘输出（完整圆桌）

```
═══════════════════════════════════════
  第14手 · 圆桌分析 | 均衡模式
═══════════════════════════════════════

【议题】连输2手后注码升至3倍基码

【风险官】
  生存安全边际：7手。盈亏-320，距止损还有空间。
  本手没有触发否决，但注码偏差需要行为官介入。
  → 当前盘面：稳定偏弱

【行为官】
  输了2手后注码从100升到300，追损模式启动。
  这不是策略调整，是情绪在替你下注。
  偏差指数：6/10。否决信号：已触发。
  → 建议立即回归基码

【推演官】
  疲劳系数0.55，缠斗未触发。当前趋势若延续，
  前方10手崩盘概率41%——处于中等风险区间。
  第17手前后是最可能的情绪爆发点。
  → 尚未到退出窗口，但窗口在靠近

【合议结论】
  行为官否决触发，主导本手决策。
  3:0 建议降注。
  指令：降注一级 · 回归基码

【你的实际操作】
  忽略建议，继续以3倍基码入注 → 本手输

【事后评估】
  本手是该场次的关键行为节点（偏离节点）
═══════════════════════════════════════
```

---

## 九、LLM 调用策略

### 9.1 调用时机（控制成本）

| 场景 | 调用策略 |
|---|---|
| 正常手（无场景/L1） | 不调用LLM，使用规则生成简短结论 |
| 预警手（L2场景） | 调用，生成每个Agent的 `assessment` 字段 |
| 警告手（L3场景） | 调用，完整三Agent分析 |
| 关键手（否决触发/L4） | 调用，完整分析 + 复盘质量优先 |

### 9.2 System Prompt 结构

每个Agent的system prompt包含：
1. 角色定义（风险官/行为官/推演官）
2. 数据输入格式
3. 分析框架（3步）
4. 否决条件（明确列出）
5. 输出格式（JSON）
6. 风格示例（从现有132条话术中选5-8条同类话术作为few-shot）

### 9.3 降级兜底

LLM调用失败或超时时：
- 用规则计算各Agent的结构化输出（数字部分）
- `assessment` 字段从对应场景的现有话术池中随机选取
- 保证实战中系统永不沉默

---

## 十、待定设计项

- [ ] Agent system prompt 完整内容（待写）
- [ ] 7个新场景的完整话术（事实2 + 心理2，供降级兜底用）
- [ ] 进场前高风险场景的具体交互设计
- [ ] 实战输出UI的具体组件设计
- [ ] 复盘圆桌组件的数据结构和展示设计
- [ ] 行为数据字段在 FMRecordingView 的采集方式

---

*本文档随讨论持续更新。实现阶段另起开发文档。*
