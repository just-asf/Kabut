import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Text, Modal, Pressable, useColorScheme, Animated, ActivityIndicator } from 'react-native';
import { Colors, Radius, Spacing, Typography, Fonts } from '@/constants/theme';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { useAppStore } from '@/store/useAppStore';
import { getGridId } from '@/lib/grid';
import { triggerSuccessHaptic, triggerFailureHaptic, triggerCooldownHaptic } from '@/utils/haptics';
import { formatRemainingTime } from '@/utils/cooldown';
import { useCooldown } from '@/hooks/useCooldown';

interface ReportConfirmModalProps {
  visible: boolean;
  onCancel: () => void;
}

export function ReportConfirmModal({ visible, onCancel }: ReportConfirmModalProps) {
  const scheme = useColorScheme();
  const activeScheme = scheme === 'dark' ? 'dark' : 'light';
  const colors = Colors[activeScheme];

  const location = useAppStore((state) => state.location);
  const gridId = location ? getGridId(location.coords.latitude, location.coords.longitude).gridId : null;

  // Consume global Cooldown Hook, synced on visible gridId changes
  const { loading: cooldownLoading, formattedTime: timeLeftStr, isCooldownActive } = useCooldown(visible ? gridId : null, 'cleanVote');
  const confirmDisabled = cooldownLoading || isCooldownActive;

  const [status, setStatus] = useState<'CONFIRM' | 'LOADING' | 'SUCCESS' | 'COOLDOWN' | 'FAILURE'>('CONFIRM');
  const [cooldownRemaining, setCooldownRemaining] = useState('');

  const scaleAnim = useRef(new Animated.Value(0)).current;

  // Reset modal state on open
  useEffect(() => {
    if (visible) {
      setStatus('CONFIRM');
      scaleAnim.setValue(0);
    }
  }, [visible]);

  // Spring animation for success/failure/cooldown transitions
  useEffect(() => {
    if (status === 'SUCCESS' || status === 'COOLDOWN' || status === 'FAILURE') {
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 4,
        useNativeDriver: true,
      }).start();
    }
  }, [status]);

  const handleConfirm = async () => {
    if (!gridId) return;
    setStatus('LOADING');
    try {
      const success = await useAppStore.getState().submitCleanVote(gridId);
      if (success) {
        setStatus('SUCCESS');
        triggerSuccessHaptic();
        setTimeout(() => {
          onCancel();
        }, 3000);
      }
    } catch (err: any) {
      console.warn('Clean vote error:', err);
      const cooldowns = useAppStore.getState().cleanVoteCooldowns;
      const exp = cooldowns[gridId];
      if (exp) {
        const diff = exp - Date.now();
        setCooldownRemaining(formatRemainingTime(diff > 0 ? diff : 3600 * 1000));
        setStatus('COOLDOWN');
        triggerCooldownHaptic();
        setTimeout(() => {
          onCancel();
        }, 3000);
      } else {
        setStatus('FAILURE');
        triggerFailureHaptic();
      }
    }
  };

  const handleBackdropPress = () => {
    if (status !== 'LOADING') {
      onCancel();
    }
  };

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={status === 'LOADING' ? undefined : onCancel}
    >
      <Pressable 
        style={styles.backdrop} 
        onPress={handleBackdropPress}
        accessible={true}
        accessibilityLabel={
          status === 'SUCCESS'
            ? "Clean vote submitted successfully"
            : status === 'COOLDOWN'
            ? "Already submitted cooldown warning"
            : "Clean vote confirmation dialog"
        }
        accessibilityRole="button"
      >
        <Pressable 
          style={[styles.modalCard, { backgroundColor: colors.backgroundElement }]}
          accessible={true}
          accessibilityRole="alert"
          onPress={(e) => e.stopPropagation()}
        >
          {status === 'CONFIRM' && (
            <>
              <View style={styles.content}>
                <View style={styles.iconContainer} accessible={false}>
                  <Icon name="warning" size={48} color={colors.primary} />
                </View>
                <Text style={[styles.title, { color: colors.text }]}>Are you sure?</Text>
                
                {cooldownLoading ? (
                  <View style={{ alignItems: 'center', marginTop: Spacing.two }}>
                    <ActivityIndicator size="small" color={colors.primary} style={{ marginBottom: Spacing.two }} />
                    <Text style={[styles.bodyText, { color: colors.textSecondary }]}>
                      Checking cooldown status...
                    </Text>
                  </View>
                ) : isCooldownActive ? (
                  <Text style={[styles.bodyText, { color: colors.danger, fontWeight: 'bold' }]}>
                    Already submitted. Try again in: {timeLeftStr}
                  </Text>
                ) : (
                  <Text style={[styles.bodyText, { color: colors.textSecondary }]}>
                    You're about to report that this place is currently smoke-free. Your report will help update the live air status for other users.
                  </Text>
                )}
              </View>
              
              <View style={styles.buttonRow}>
                <View style={styles.buttonWrapper}>
                  <Button 
                    label="Cancel" 
                    onPress={onCancel} 
                    variant="outlined" 
                    accessibilityLabel="Cancel reporting smoke-free zone"
                    style={styles.pillButton}
                  />
                </View>
                <View style={styles.buttonWrapper}>
                  <Button 
                    label="Confirm" 
                    onPress={handleConfirm} 
                    variant="filled" 
                    disabled={confirmDisabled}
                    accessibilityLabel="Confirm reporting smoke-free zone"
                    style={styles.pillButton}
                  />
                </View>
              </View>
            </>
          )}

          {status === 'LOADING' && (
            <View style={styles.content}>
              <ActivityIndicator size="large" color={colors.primary} style={{ marginBottom: Spacing.four }} />
              <Text style={[styles.title, { color: colors.text }]}>Submitting Vote...</Text>
              <Text style={[styles.bodyText, { color: colors.textSecondary }]}>
                Please wait while we register your smoke-free report.
              </Text>
            </View>
          )}

          {status === 'SUCCESS' && (
            <View style={styles.content}>
              <Animated.View style={[styles.iconContainer, { transform: [{ scale: scaleAnim }] }]}>
                <Icon name="check-circle" size={56} color={colors.primary} />
              </Animated.View>
              <Text style={[styles.title, { color: colors.text, marginTop: Spacing.three }]}>
                ✓
              </Text>
              <Text style={[styles.bodyText, { color: colors.text, marginTop: Spacing.two, fontWeight: '600' }]}>
                Clean vote submitted successfully.
              </Text>
            </View>
          )}

          {status === 'COOLDOWN' && (
            <View style={styles.content}>
              <Animated.View style={[styles.iconContainer, { transform: [{ scale: scaleAnim }] }]}>
                <Icon name="close" size={56} color={colors.danger} />
              </Animated.View>
              <Text style={[styles.title, { color: colors.danger, marginTop: Spacing.three }]}>
                Red X
              </Text>
              <Text style={[styles.bodyText, { color: colors.text, marginTop: Spacing.two, fontWeight: '600' }]}>
                Already submitted.
              </Text>
              <Text style={[styles.bodyText, { color: colors.textSecondary, marginTop: Spacing.one }]}>
                Try again in: {cooldownRemaining}
              </Text>
            </View>
          )}

          {status === 'FAILURE' && (
            <View style={styles.content}>
              <Animated.View style={[styles.iconContainer, { transform: [{ scale: scaleAnim }] }]}>
                <Icon name="close" size={56} color={colors.danger} />
              </Animated.View>
              <Text style={[styles.title, { color: colors.danger, marginTop: Spacing.three }]}>
                Red X
              </Text>
              <Text style={[styles.bodyText, { color: colors.text, marginTop: Spacing.two, fontWeight: '600' }]}>
                Unexpected error.
              </Text>
              <Text style={[styles.bodyText, { color: colors.textSecondary, marginTop: Spacing.one }]}>
                Please try again later.
              </Text>
              <Button
                label="Close"
                onPress={onCancel}
                variant="outlined"
                style={[styles.pillButton, { marginTop: Spacing.four, width: 120 }]}
              />
            </View>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(28,31,22,0.4)',
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


