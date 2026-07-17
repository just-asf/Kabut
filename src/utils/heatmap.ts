import { IconName } from '@/components/ui/Icon';

export const MIN_CLEAN_THRESHOLD = 2;

/**
 * Determines whether a heatmap circle should be rendered on the map.
 * The score is computed by the backend and served as the single source of truth.
 * The circle disappears when score is 0 AND cleanVotes >= MIN_CLEAN_THRESHOLD.
 */
export function shouldShowCircle(score: number, cleanVotes: number): boolean {
  if (score > 0) return true;
  if (cleanVotes < MIN_CLEAN_THRESHOLD) return true;
  return false;
}

export type SeverityLevel = 'very_low' | 'light' | 'moderate' | 'elevated' | 'dense';

export interface Severity {
  level: SeverityLevel;
  label: string;
  icon: IconName;
  color: string;
  iconColor: string;
  fillColor: string;
  radius: number;
  minScore: number;
  maxScore: number | null;
  description: string;
}

export interface ThemeColors {
  heatmapClean: string;
  heatmapLight: string;
  heatmapModerate: string;
  heatmapElevated: string;
  heatmapDense: string;
}

export const SEVERITY_LEVELS: {
  level: SeverityLevel;
  label: string;
  icon: IconName;
  colorKey: keyof ThemeColors;
  iconColor: string;
  fillColor: string;
  radius: number;
  minScore: number;
  maxScore: number | null;
  description: string;
}[] = [
  {
    level: 'very_low',
    label: 'Very Low',
    icon: 'circle-outline',
    colorKey: 'heatmapClean',
    iconColor: '#FFFFFF',
    fillColor: 'rgba(120, 120, 120, 0.35)',
    radius: 30,
    minScore: 0,
    maxScore: 2.99,
    description: '1-2 reports',
  },
  {
    level: 'light',
    label: 'Light',
    icon: 'alarm-light-outline',
    colorKey: 'heatmapLight',
    iconColor: '#166534',
    fillColor: 'rgba(34, 197, 94, 0.35)',
    radius: 35,
    minScore: 3,
    maxScore: 6.99,
    description: '3-6 reports',
  },
  {
    level: 'moderate',
    label: 'Moderate',
    icon: 'alert-circle-outline',
    colorKey: 'heatmapModerate',
    iconColor: '#92400E',
    fillColor: 'rgba(250, 204, 21, 0.40)',
    radius: 40,
    minScore: 7,
    maxScore: 9.99,
    description: '7-9 reports',
  },
  {
    level: 'elevated',
    label: 'Elevated',
    icon: 'alert-circle',
    colorKey: 'heatmapElevated',
    iconColor: '#7C2D12',
    fillColor: 'rgba(249, 115, 22, 0.40)',
    radius: 45,
    minScore: 10,
    maxScore: 14.99,
    description: '10-14 reports',
  },
  {
    level: 'dense',
    label: 'Dense',
    icon: 'alert-octagon',
    colorKey: 'heatmapDense',
    iconColor: '#FFFFFF',
    fillColor: 'rgba(239, 68, 68, 0.45)',
    radius: 50,
    minScore: 15,
    maxScore: null,
    description: '15+ reports',
  },
];

/**
 * Returns the unified Severity object based on the score.
 */
export function getSeverityInfo(score: number, themeColors: ThemeColors): Severity {
  const config = SEVERITY_LEVELS.find((lvl) => {
    if (score < lvl.minScore) return false;
    if (lvl.maxScore !== null && score > lvl.maxScore) return false;
    return true;
  }) ?? SEVERITY_LEVELS[0];

  return {
    level: config.level,
    label: config.label,
    icon: config.icon,
    color: themeColors[config.colorKey],
    iconColor: config.iconColor,
    fillColor: config.fillColor,
    radius: config.radius,
    minScore: config.minScore,
    maxScore: config.maxScore,
    description: config.description,
  };
}

/**
 * Returns all configured severity levels fully resolved with active theme colors.
 */
export function getResolvedSeverityLevels(themeColors: ThemeColors): Severity[] {
  return SEVERITY_LEVELS.map((lvl) => ({
    level: lvl.level,
    label: lvl.label,
    icon: lvl.icon,
    color: themeColors[lvl.colorKey],
    iconColor: lvl.iconColor,
    fillColor: lvl.fillColor,
    radius: lvl.radius,
    minScore: lvl.minScore,
    maxScore: lvl.maxScore,
    description: lvl.description,
  }));
}

