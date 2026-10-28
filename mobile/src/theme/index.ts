import tokens from './tokens.json';

export type ColorTokens = {
  bg: string;
  surface: string;
  surface2: string;
  border: string;
  text: string;
  muted: string;
  accent: string;
  accentSoft: string;
  onAccent: string;
  positive: string;
  positiveSoft: string;
  negative: string;
  negativeSoft: string;
  info: string;
};

export type Category =
  | 'food'
  | 'groceries'
  | 'rent'
  | 'utilities'
  | 'travel'
  | 'entertainment'
  | 'shopping'
  | 'health'
  | 'household'
  | 'other';

export type CategoryMeta = { label: string; emoji: string; color: string };

export const CATEGORIES = tokens.categories as Record<Category, CategoryMeta>;
export const CATEGORY_ORDER: Category[] = [
  'food',
  'groceries',
  'rent',
  'utilities',
  'travel',
  'entertainment',
  'shopping',
  'health',
  'household',
  'other',
];

export const AVATAR_PALETTE: string[] = tokens.avatarPalette;
export const GROUP_PALETTE: string[] = tokens.groupPalette;
export const GROUP_EMOJIS: string[] = tokens.groupEmojis;

export const lightColors: ColorTokens = tokens.light;
export const darkColors: ColorTokens = tokens.dark;

export const fonts = {
  regular: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_500Medium',
  semibold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
  mono: 'DMMono_500Medium',
  monoRegular: 'DMMono_400Regular',
} as const;

export const sizes = {
  display: 28,
  h1: 22,
  h2: 17,
  body: 15,
  small: 13,
  micro: 11,
} as const;

export const radii = {
  card: 18,
  control: 12,
  pill: 999,
} as const;

export const spacing = {
  gutter: 16,
  card: 16,
} as const;

export type ThemeMode = 'system' | 'light' | 'dark';
export type ResolvedScheme = 'light' | 'dark';

export type Theme = {
  scheme: ResolvedScheme;
  colors: ColorTokens;
  fonts: typeof fonts;
  sizes: typeof sizes;
  radii: typeof radii;
  spacing: typeof spacing;
  /** Soft card shadow in light mode, nothing in dark (per DESIGN.md). */
  cardShadow: {
    shadowColor?: string;
    shadowOpacity?: number;
    shadowRadius?: number;
    shadowOffset?: { width: number; height: number };
    elevation?: number;
  };
};

export function buildTheme(scheme: ResolvedScheme): Theme {
  return {
    scheme,
    colors: scheme === 'dark' ? darkColors : lightColors,
    fonts,
    sizes,
    radii,
    spacing,
    cardShadow:
      scheme === 'dark'
        ? {}
        : {
            shadowColor: '#000000',
            shadowOpacity: 0.04,
            shadowRadius: 2,
            shadowOffset: { width: 0, height: 1 },
            elevation: 1,
          },
  };
}

export function categoryMeta(category: string): CategoryMeta {
  return CATEGORIES[(category as Category) in CATEGORIES ? (category as Category) : 'other'];
}

/** Add alpha to a #RRGGBB hex colour. */
export function withAlpha(hex: string, alpha: number): string {
  const a = Math.round(Math.min(1, Math.max(0, alpha)) * 255)
    .toString(16)
    .padStart(2, '0');
  return `${hex}${a}`;
}
