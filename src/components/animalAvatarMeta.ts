import type { AnimalId } from '../engine/types.ts';

export interface AnimalAvatarTheme {
  readonly id: AnimalId;
  readonly label: string;
  readonly bgStart: string;
  readonly bgEnd: string;
  readonly ringHex: string;
}

export const ANIMAL_AVATAR_THEMES: Record<AnimalId, AnimalAvatarTheme> = {
  dog: {
    id: 'dog',
    label: 'Chó Corgi',
    bgStart: '#FDE68A',
    bgEnd: '#D97706',
    ringHex: '#FBBF24',
  },
  cat: {
    id: 'cat',
    label: 'Mèo Xám',
    bgStart: '#CBD5E1',
    bgEnd: '#475569',
    ringHex: '#94A3B8',
  },
  duck: {
    id: 'duck',
    label: 'Vịt Trắng',
    bgStart: '#FEF08A',
    bgEnd: '#EAB308',
    ringHex: '#FACC15',
  },
  shark: {
    id: 'shark',
    label: 'Cá Mập',
    bgStart: '#93C5FD',
    bgEnd: '#1D4ED8',
    ringHex: '#60A5FA',
  },
  dino: {
    id: 'dino',
    label: 'Khủng Long',
    bgStart: '#BEF264',
    bgEnd: '#15803D',
    ringHex: '#4ADE80',
  },
  panda: {
    id: 'panda',
    label: 'Panda',
    bgStart: '#E2E8F0',
    bgEnd: '#334155',
    ringHex: '#94A3B8',
  },
  chicken: {
    id: 'chicken',
    label: 'Gà Trắng',
    bgStart: '#FECDD3',
    bgEnd: '#E11D48',
    ringHex: '#FB7185',
  },
  bunny: {
    id: 'bunny',
    label: 'Thỏ Trắng',
    bgStart: '#FBCFE8',
    bgEnd: '#DB2777',
    ringHex: '#F472B6',
  },
};

export function getAnimalAvatarTheme(animal: AnimalId): AnimalAvatarTheme {
  return ANIMAL_AVATAR_THEMES[animal] ?? ANIMAL_AVATAR_THEMES.dog;
}
