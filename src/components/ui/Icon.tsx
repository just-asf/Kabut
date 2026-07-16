import React from 'react';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors } from '@/constants/theme';
import { useColorScheme } from 'react-native';

export type IconName =
  | 'search'
  | 'air'
  | 'warning'
  | 'report-problem'
  | 'block'
  | 'my-location'
  | 'home'
  | 'person'
  | 'campaign'
  | 'arrow-forward'
  | 'close'
  | 'arrow-back'
  | 'info'
  | 'check'
  | 'check-circle'
  | 'filter-list'
  | 'map-pin';

interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
  themeColor?: keyof typeof Colors.light;
}

// Map custom layout-specific icon names to actual MaterialIcon names
const iconMap: Record<IconName, keyof typeof MaterialIcons.glyphMap> = {
  'search': 'search',
  'air': 'air',
  'warning': 'warning',
  'report-problem': 'report-problem',
  'block': 'block',
  'my-location': 'my-location',
  'home': 'home',
  'person': 'person',
  'campaign': 'campaign',
  'arrow-forward': 'arrow-forward',
  'close': 'close',
  'arrow-back': 'arrow-back',
  'info': 'info',
  'check': 'check',
  'check-circle': 'check-circle',
  'filter-list': 'filter-list',
  'map-pin': 'place',
};

export function Icon({ name, size = 24, color, themeColor }: IconProps) {
  const scheme = useColorScheme();
  const activeScheme = scheme === 'dark' ? 'dark' : 'light';
  
  let finalColor = color;
  if (!finalColor && themeColor) {
    finalColor = Colors[activeScheme][themeColor] as string;
  }
  if (!finalColor) {
    finalColor = Colors[activeScheme].text as string;
  }

  const mappedName = iconMap[name] || 'info';

  return <MaterialIcons name={mappedName} size={size} color={finalColor} />;
}
