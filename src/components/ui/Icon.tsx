import React from 'react';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
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
  | 'map-pin'
  | 'legend-guide'
  | 'circle-outline'
  | 'alarm-light-outline'
  | 'alert-circle-outline'
  | 'alert-circle'
  | 'alert-octagon';

interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
  themeColor?: keyof typeof Colors.light;
  family?: 'MaterialIcons' | 'MaterialCommunityIcons';
  style?: any;
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
  'legend-guide': 'menu-book',
  'circle-outline': 'circle',
  'alarm-light-outline': 'check-circle',
  'alert-circle-outline': 'warning',
  'alert-circle': 'security',
  'alert-octagon': 'report',
};

export function Icon({ name, size = 24, color, themeColor, family = 'MaterialIcons', style }: IconProps) {
  const scheme = useColorScheme();
  const activeScheme = scheme === 'dark' ? 'dark' : 'light';
  
  let finalColor = color;
  if (!finalColor && themeColor) {
    finalColor = Colors[activeScheme][themeColor] as string;
  }
  if (!finalColor) {
    finalColor = Colors[activeScheme].text as string;
  }

  if (family === 'MaterialCommunityIcons') {
    return <MaterialCommunityIcons name={name as any} size={size} color={finalColor} style={style} />;
  }

  const mappedName = iconMap[name] || 'info';

  return <MaterialIcons name={mappedName as any} size={size} color={finalColor} style={style} />;
}
