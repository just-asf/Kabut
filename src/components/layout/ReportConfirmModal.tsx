import React from 'react';
import { StyleSheet, View, Text, Modal, Pressable, useColorScheme } from 'react-native';
import { Colors, Radius, Spacing, Typography, Fonts } from '@/constants/theme';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';

interface ReportConfirmModalProps {
  visible: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  loading?: boolean;
}

export function ReportConfirmModal({ visible, onCancel, onConfirm, loading = false }: ReportConfirmModalProps) {
  const scheme = useColorScheme();
  const activeScheme = scheme === 'dark' ? 'dark' : 'light';
  const colors = Colors[activeScheme];

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={loading ? undefined : onCancel}
    >
      <View style={styles.backdrop}>
        {/* Click outside to dismiss (optional, but standard UX) */}
        <Pressable 
          style={StyleSheet.absoluteFillObject} 
          onPress={loading ? undefined : onCancel}
          accessible={true}
          accessibilityLabel="Dismiss report confirm dialog"
          accessibilityRole="button"
        />
        
        {/* Modal content card */}
        <View 
          style={[styles.modalCard, { backgroundColor: colors.backgroundElement }]}
          accessible={true}
          accessibilityRole="alert"
        >
          <View style={styles.content}>
            <View style={styles.iconContainer} accessible={false}>
              <Icon name="warning" size={48} color={colors.primary} />
            </View>
            <Text style={[styles.title, { color: colors.text }]}>Are you sure?</Text>
            <Text style={[styles.bodyText, { color: colors.textSecondary }]}>
              You're about to report that this place is currently smoke-free. Your report will help update the live air status for other users.
            </Text>
          </View>
          
          <View style={styles.buttonRow}>
            <View style={styles.buttonWrapper}>
              <Button 
                label="Cancel" 
                onPress={onCancel} 
                variant="outlined" 
                disabled={loading}
                accessibilityLabel="Cancel reporting smoke-free zone"
                style={styles.pillButton}
              />
            </View>
            <View style={styles.buttonWrapper}>
              <Button 
                label="Confirm" 
                onPress={onConfirm} 
                variant="filled" 
                disabled={loading}
                loading={loading}
                accessibilityLabel="Confirm reporting smoke-free zone"
                style={styles.pillButton}
              />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(28,31,22,0.4)', // Dark semi-translucent backdrop
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
  },
  modalCard: {
    width: 340,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 12,
  },
  content: {
    padding: Spacing.five,
    alignItems: 'center',
  },
  iconContainer: {
    marginBottom: Spacing.three,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontFamily: Fonts.sans,
    fontSize: Typography.h2.fontSize,
    fontWeight: Typography.h2.fontWeight,
    lineHeight: Typography.h2.lineHeight,
    textAlign: 'center',
    marginBottom: Spacing.three,
  },
  bodyText: {
    fontFamily: Fonts.sans,
    fontSize: Typography.body.fontSize,
    fontWeight: Typography.bodyLg.fontWeight,
    lineHeight: Typography.bodyLg.lineHeight,
    textAlign: 'center',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: Spacing.three,
    paddingHorizontal: Spacing.five,
    paddingBottom: Spacing.five,
  },
  buttonWrapper: {
    flex: 1,
  },
  pillButton: {
    borderRadius: Radius.full,
  },
});
