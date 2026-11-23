import type { CardType, Color } from '../../engine/types';

export interface CardMeta {
  type: CardType;
  name: string;
  shortLabel: string;
  description: string;
  isWild: boolean;
  phase: 'MVP' | 'v1.0';
}

export interface ColorTheme {
  id: Color;
  label: string;
  shapeName: string;
  shapeSymbol: '●' | '■' | '▲' | '★';
  /** Main card surface gradient start */
  primary: string;
  /** Main card surface gradient end */
  secondary: string;
  /** High-contrast deep tone (>= 4.5:1 with white text) */
  dark: string;
  /** Soft tint for highlights and subtle accents */
  light: string;
  /** Accessible foreground ink on primary/light surfaces */
  ink: string;
  /** Foreground color for corner index on card surface */
  cornerText: string;
  /** Pill background for high-contrast Vietnamese label */
  pillBg: string;
  /** Pill text color (always >= 4.5:1 against pillBg) */
  pillText: string;
  /** Glow ring color for activeWildColor / playable highlight */
  glow: string;
}

export const COLOR_THEME: Record<Color, ColorTheme> = {
  pink: {
    id: 'pink',
    label: 'Hồng',
    shapeName: 'Tròn',
    shapeSymbol: '●',
    primary: '#EC4899',
    secondary: '#DB2777',
    dark: '#9D174D',
    light: '#FCE7F3',
    ink: '#9D174D',
    cornerText: '#FFFFFF',
    pillBg: '#831843',
    pillText: '#FFFFFF',
    glow: 'rgba(236, 72, 153, 0.7)',
  },
  blue: {
    id: 'blue',
    label: 'Xanh dương',
    shapeName: 'Vuông',
    shapeSymbol: '■',
    primary: '#3B82F6',
    secondary: '#2563EB',
    dark: '#1E40AF',
    light: '#DBEAFE',
    ink: '#1D4ED8',
    cornerText: '#FFFFFF',
    pillBg: '#1E3A8A',
    pillText: '#FFFFFF',
    glow: 'rgba(59, 130, 246, 0.7)',
  },
  green: {
    id: 'green',
    label: 'Xanh lá',
    shapeName: 'Tam giác',
    shapeSymbol: '▲',
    primary: '#10B981',
    secondary: '#059669',
    dark: '#065F46',
    light: '#D1FAE5',
    ink: '#047857',
    cornerText: '#FFFFFF',
    pillBg: '#064E3B',
    pillText: '#FFFFFF',
    glow: 'rgba(16, 185, 129, 0.7)',
  },
  yellow: {
    id: 'yellow',
    label: 'Vàng',
    shapeName: 'Sao',
    shapeSymbol: '★',
    primary: '#F59E0B',
    secondary: '#D97706',
    dark: '#78350F',
    light: '#FEF3C7',
    ink: '#78350F',
    cornerText: '#451A03',
    pillBg: '#78350F',
    pillText: '#FFFBEB',
    glow: 'rgba(245, 158, 11, 0.75)',
  },
};

export const WILD_THEME = {
  primary: '#2E1065',
  secondary: '#1E1B4B',
  dark: '#0F0A2E',
  ink: '#F8FAFC',
  pillBg: '#0F172A',
  pillText: '#F8FAFC',
  accent: '#A855F7',
} as const;

export const CARD_META: Record<CardType, CardMeta> = {
  basic: {
    type: 'basic',
    name: 'Lá Số',
    shortLabel: 'Số',
    description: 'Đánh ghép cùng màu hoặc cùng số 0–9.',
    isWild: false,
    phase: 'MVP',
  },
  arrow: {
    type: 'arrow',
    name: 'Mũi Tên',
    shortLabel: 'Mũi Tên',
    description: 'Lá ký hiệu đặc biệt, ghép cùng màu hoặc cùng loại.',
    isWild: false,
    phase: 'MVP',
  },
  freeze: {
    type: 'freeze',
    name: 'Kem Đá',
    shortLabel: 'Kem Đá',
    description: 'Đóng băng khiến người kế tiếp bị mất lượt.',
    isWild: false,
    phase: 'MVP',
  },
  boomerang: {
    type: 'boomerang',
    name: 'Vòng Xoay',
    shortLabel: 'Vòng Xoay',
    description: 'Đảo ngược chiều đánh của bàn chơi.',
    isWild: false,
    phase: 'MVP',
  },
  shovel: {
    type: 'shovel',
    name: 'Xẻng Tuyết',
    shortLabel: 'Xẻng +2',
    description: 'Người kế rút +2 lá (có thể cộng dồn bằng Xẻng khác).',
    isWild: false,
    phase: 'MVP',
  },
  crossbow: {
    type: 'crossbow',
    name: 'Nỏ Thần',
    shortLabel: 'Nỏ Thần',
    description: 'Chọn 1 đối thủ và bắn thêm 1 lá Mũi Tên vào tay họ.',
    isWild: false,
    phase: 'v1.0',
  },
  taser: {
    type: 'taser',
    name: 'Tia Chớp',
    shortLabel: 'Tia Chớp',
    description: 'Wild: chọn màu, người kế rút đến khi ra đúng màu hoặc Wild.',
    isWild: true,
    phase: 'MVP',
  },
  banana: {
    type: 'banana',
    name: 'Vỏ Chuối',
    shortLabel: 'Vỏ Chuối',
    description: 'Wild: chọn màu và giấu vào chồng rút; ai rút trúng phạt +3.',
    isWild: true,
    phase: 'MVP',
  },
  bomb: {
    type: 'bomb',
    name: 'Bom Kẹo',
    shortLabel: 'Bom Kẹo',
    description: 'Wild: chọn màu, gắn ngòi nổ hẹn giờ phạt +4 khi phát nổ.',
    isWild: true,
    phase: 'v1.0',
  },
  egg: {
    type: 'egg',
    name: 'Trứng Bất Ngờ',
    shortLabel: 'Trứng ?',
    description: 'Wild: đánh lên mọi lá, nở ngẫu nhiên thành một hiệu ứng.',
    isWild: true,
    phase: 'v1.0',
  },
  potion: {
    type: 'potion',
    name: 'Thuốc Tàng Hình',
    shortLabel: 'Tàng Hình',
    description: 'Wild: phản đòn khi bị nhắm, chuyển hiệu ứng sang người kế.',
    isWild: true,
    phase: 'v1.0',
  },
};

export const COLORED_CARD_TYPES: CardType[] = [
  'basic',
  'arrow',
  'freeze',
  'boomerang',
  'shovel',
  'crossbow',
];

export const WILD_CARD_TYPES: CardType[] = [
  'taser',
  'banana',
  'bomb',
  'egg',
  'potion',
];
