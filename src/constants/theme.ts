import '@/global.css';
import { Platform } from 'react-native';

export const Colors = {
  light: {
    // Core brand stops
    primary: '#769826',
    secondary: '#A1CB35',
    accentMid: '#FFDE4E',
    accentStrong: '#FF9D4D',
    tertiary: '#6f5d00',

    // Heatmap signal scale
    heatmapClean: '#E4E5DE',
    heatmapLight: '#9FCB4E',
    heatmapModerate: '#F5C93B',
    heatmapElevated: '#F2914A',
    heatmapDense: '#E0524A',

    // Semantic roles
    success: '#769826',
    warning: '#FFDE4E',
    danger: '#D64545',

    // Neutrals
    neutral0: '#FFFFFF',
    neutral50: '#F7F8F5',
    neutral100: '#EEEFE9',
    neutral200: '#DEE0D6',
    neutral400: '#9A9D8C',
    neutral600: '#5B5E4F',
    neutral900: '#1C1F16',

    // Theme surfaces
    text: '#1C1F16',
    background: '#FAFAF7',
    backgroundElement: '#FFFFFF', // Surface 1
    backgroundSelected: '#EEEFE9', // Surface 2
    border: '#E4E5DE',
    textSecondary: '#5B5E4F',
  },
  dark: {
    // Core brand stops
    primary: '#769826',
    secondary: '#A1CB35',
    accentMid: '#FFDE4E',
    accentStrong: '#FF9D4D',
    tertiary: '#6f5d00',

    // Heatmap signal scale
    heatmapClean: '#E4E5DE',
    heatmapLight: '#9FCB4E',
    heatmapModerate: '#F5C93B',
    heatmapElevated: '#F2914A',
    heatmapDense: '#E0524A',

    // Semantic roles
    success: '#769826',
    warning: '#FFDE4E',
    danger: '#D64545',

    // Neutrals (dark equivalents or reuses)
    neutral0: '#12140F',
    neutral50: '#1B1F16',
    neutral100: '#242A1D',
    neutral200: 'rgba(255,255,255,0.08)',
    neutral400: '#9A9D8C',
    neutral600: '#B9BDAC',
    neutral900: '#F3F5EE',

    // Theme surfaces
    text: '#F3F5EE',
    background: '#12140F',
    backgroundElement: '#1B1F16', // Surface 1
    backgroundSelected: '#242A1D', // Surface 2
    border: 'rgba(255,255,255,0.08)',
    textSecondary: '#B9BDAC',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    sans: 'Plus Jakarta Sans',
    serif: 'ui-serif',
    rounded: 'Plus Jakarta Sans',
    mono: 'JetBrains Mono',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Typography = {
  display: {
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '700' as const,
  },
  h1: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '700' as const,
  },
  h2: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '600' as const,
  },
  h3: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '600' as const,
  },
  bodyLg: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '400' as const,
  },
  body: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '400' as const,
  },
  caption: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500' as const,
  },
  button: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '600' as const,
  },
  mono: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '400' as const,
  },
};

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 12,
  four: 16,
  five: 24,
  six: 32,
  seven: 48,
  eight: 64,
} as const;

export const Radius = {
  xs: 6,
  sm: 10,
  md: 16,
  lg: 24,
  full: 999,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
