import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Text, Modal, Pressable, useColorScheme, Animated, Vibration } from 'react-native';
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

  const [status, setStatus] = useState<'CONFIRM' | 'LOADING' | 'SUCCESS'>('CONFIRM');
  const scaleAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setStatus('CONFIRM');
      scaleAnim.setValue(0);
    }
  }, [visible]);

  useEffect(() => {
    if (visible) {
      if (loading) {
        setStatus('LOADING');
      } else if (status === 'LOADING') {
        setStatus('SUCCESS');
        
        // Trigger success haptic vibration twice (Short -> Pause -> Short)
        Vibration.vibrate(100);
        setTimeout(() => {
          Vibration.vibrate(100);
        }, 200);

        // Auto dismiss after 3 seconds
        const timer = setTimeout(() => {
          onCancel();
        }, 3000);
        return () => clearTimeout(timer);
      }
    }
  }, [loading, visible]);

  useEffect(() => {
    if (status === 'SUCCESS') {
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 4,
        useNativeDriver: true,
      }).start();
    }
  }, [status]);

  const handleBackdropPress = () => {
    if (status === 'SUCCESS') {
      onCancel(); // Allow user to tap anywhere to dismiss success animation early
    } else if (status === 'CONFIRM') {
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
        accessibilityLabel={status === 'SUCCESS' ? "Tap to close success confirmation" : "Dismiss report confirm dialog"}
        accessibilityRole="button"
      >
        {/* Modal content card */}
        <Pressable 
          style={[styles.modalCard, { backgroundColor: colors.backgroundElement }]}
          accessible={true}
          accessibilityRole="alert"
          onPress={(e) => {
            e.stopPropagation(); // Prevent dismissing when clicking card content itself (unless in success state)
            if (status === 'SUCCESS') {
              onCancel(); // In success state, tapping anywhere (even on the card) dismisses it
            }
          }}
        >
          {status === 'SUCCESS' ? (
            <View style={styles.content}>
              <Animated.View style={[styles.iconContainer, { transform: [{ scale: scaleAnim }] }]}>
                <Icon name="check-circle" size={56} color={colors.primary} />
              </Animated.View>
              <Text style={[styles.title, { color: colors.text, marginTop: Spacing.three }]}>
                Observation confirmed
              </Text>
              <Text style={[styles.bodyText, { color: colors.textSecondary, marginTop: Spacing.two }]}>
                Your report has been successfully recorded. Thank you for helping keep the air smoke-free!
              </Text>
            </View>
          ) : (
            <>
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
                    disabled={status === 'LOADING'}
                    accessibilityLabel="Cancel reporting smoke-free zone"
                    style={styles.pillButton}
                  />
                </View>
                <View style={styles.buttonWrapper}>
                  <Button 
                    label="Confirm" 
                    onPress={onConfirm} 
                    variant="filled" 
                    disabled={status === 'LOADING'}
                    loading={status === 'LOADING'}
                    accessibilityLabel="Confirm reporting smoke-free zone"
                    style={styles.pillButton}
                  />
                </View>
              </View>
            </>
          )}
        </Pressable>
      </Pressable>
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
