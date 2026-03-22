export * from './types/schema';

export const theme = {
  colors: {
    bg: '#0A0A0A',          // 页面背景
    card: '#1F1F1F',        // 卡片背景
    gold: '#E6B800',        // 金色强调/CTA（保留作次要色）
    brand: '#00C896',       // OBSIDIAN品牌绿（主色）
    white: '#FFFFFF',       // 主文字
    gray: '#AAAAAA',        // 次要文字
    border: 'rgba(255,255,255,0.08)',  // 边框/分割线
    danger: '#FF4444',      // 危险/亏损/错误
    success: '#22C55E',     // 成功/盈利/正确
    warning: '#F59E0B',     // 警告
    emotion: {
      calm: '#22C55E',      // 平静=绿
      mild: '#E6B800',      // 轻度=金
      moderate: '#FF8C00',  // 中度=橙
      severe: '#FF4444',    // 重度=红
    },
    // 向后兼容别名（旧代码引用，前端迁移后可删除）
    ink: '#FFFFFF',
    page: '#0A0A0A',
    sub: '#AAAAAA',
    accent: {
      lavender: '#E6B800',
      lime: '#22C55E',
      blue: '#E6B800',
      peach: '#FF8C00',
      orange: '#FF8C00',
    },
  },
  // 向后兼容（旧代码引用，前端迁移后可删除）
  shadows: {
    soft: '0 1px 3px rgba(0,0,0,0.3)',
    float: '0 4px 12px rgba(0,0,0,0.4)',
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
    xxxl: 32,
  },
  radius: {
    sm: 8,     // 按钮
    md: 12,    // 卡片
    lg: 16,    // 弹窗
    full: 9999,
  },
  fontSize: {
    hero: 22,    // weight 800
    title: 18,   // weight 700
    body: 16,    // weight 400
    small: 14,   // weight 400
    caption: 12, // weight 400
  },
} as const;

// 资金管家统一配色（所有 FM 组件共用）
export const FM_COLORS = {
  primary: '#E6B800',
  secondary: '#2D6A4F',
  accent: '#40916C',
  warning: '#E76F51',
  danger: '#E63946',
  profit: '#22C55E',
  loss: '#FF4444',
  bg: '#0A0A0A',
  cardBg: '#1F1F1F',
  inputBg: '#111111',
  textPrimary: '#FFFFFF',
  textSecondary: '#AAAAAA',
  border: 'rgba(255,255,255,0.08)',
  aiBg: '#1A2A1F',
  userBg: '#1A1A2E',
} as const;

export type EmotionLevel = 'calm' | 'mild' | 'moderate' | 'severe';

export const ROLE_DISPLAY_MAP = {
  b_role: '与老朋友',
  strategist: '博弈军师',
  b_role_sub: '睿智温润的老友',
  strategist_sub: '兵法 · 博弈 · 凯利',
} as const;
