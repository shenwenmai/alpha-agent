import type { CharacterDefinition, CharacterId, TemperatureConfig, TempPreset } from '../types/room';
import { junshi } from './junshi';
import { aqiang } from './aqiang';
import { gailv } from './gailv';
import { ajie } from './ajie';
import { laoliu } from './laoliu';
import { xiaofang } from './xiaofang';
import { dashiwang } from './dashiwang';
import { kellyprof } from './kellyprof';
import { xiaotian } from './xiaotian';
import { laozhang } from './laozhang';

// 角色注册表
export const CHARACTER_MAP: Record<string, CharacterDefinition> = {
  junshi,
  aqiang,
  gailv,
  ajie,
  laoliu,
  xiaofang,
  dashiwang,
  kellyprof,
  xiaotian,
  laozhang,
};

// 所有可用角色ID列表
export const ALL_CHARACTER_IDS: CharacterId[] = Object.keys(CHARACTER_MAP) as CharacterId[];

// 获取角色定义
export function getCharacter(id: CharacterId): CharacterDefinition | undefined {
  return CHARACTER_MAP[id];
}

// 获取角色默认温度
export function getDefaultTemp(id: CharacterId): TemperatureConfig {
  const char = CHARACTER_MAP[id];
  return char?.defaultTemp ?? { intensity: 5, rationality: 5, verbosity: 5, provocation: 5, empathy: 5 };
}

// 快捷预设定义
export const TEMP_PRESETS: Record<TempPreset, { label: string; emoji: string; description: string; apply: (charId: CharacterId) => TemperatureConfig }> = {
  all_fire: {
    label: '全员开火',
    emoji: '🔥',
    description: '强烈度+挑逗度拉满，最热闹',
    apply: (charId) => {
      const base = getDefaultTemp(charId);
      return { ...base, intensity: 10, provocation: 10 };
    },
  },
  calm: {
    label: '冷静讨论',
    emoji: '🧊',
    description: '理性度拉高，强烈度降低',
    apply: (charId) => {
      const base = getDefaultTemp(charId);
      return { ...base, intensity: 2, rationality: 9, provocation: 2 };
    },
  },
  default: {
    label: '各显本色',
    emoji: '🎭',
    description: '恢复出厂默认值',
    apply: (charId) => getDefaultTemp(charId),
  },
  max_conflict: {
    label: '最大冲突',
    emoji: '💣',
    description: '对立角色强烈度拉满',
    apply: (charId) => {
      const base = getDefaultTemp(charId);
      return { ...base, intensity: 10, provocation: 10, empathy: 1, verbosity: 9 };
    },
  },
  tea: {
    label: '茶话会',
    emoji: '🍵',
    description: '话密度降低，共情度拉高',
    apply: (charId) => {
      const base = getDefaultTemp(charId);
      return { ...base, verbosity: 3, empathy: 9, intensity: 2, provocation: 1 };
    },
  },
};

export { junshi, aqiang, gailv, ajie, laoliu, xiaofang, dashiwang, kellyprof, xiaotian, laozhang };
