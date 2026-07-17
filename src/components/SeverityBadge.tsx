import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Icon } from '@/components/ui/Icon';
import { Severity } from '@/utils/heatmap';

interface SeverityBadgeProps {
  severity: Severity;
}

export function SeverityBadge({ severity }: SeverityBadgeProps) {
  return (
    <View style={styles.container}>
      <Icon 
        name={severity.icon} 
        size={24} 
        color={severity.iconColor}
        family="MaterialCommunityIcons"
        style={{ includeFontPadding: false, textAlignVertical: 'center', lineHeight: 24, textAlign: 'center' }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    overflow: 'visible',
  },
});
