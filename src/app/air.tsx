import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View, Text, Pressable, useColorScheme, BackHandler, ActivityIndicator, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withDelay,
  Easing,
  useReducedMotion,
  withSequence,
} from 'react-native-reanimated';
import { router } from 'expo-router';
import { Colors, Radius, Spacing, Typography, Fonts } from '@/constants/theme';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { useAppStore } from '@/store/useAppStore';
import { triggerSuccessHaptic, triggerFailureHaptic, triggerCooldownHaptic } from '@/utils/haptics';
import { formatRemainingTime } from '@/utils/cooldown';
import { getGridId } from '@/lib/grid';
import { useCooldown } from '@/hooks/useCooldown';

const UPLOAD_MESSAGES = [
  'Getting your location...',
  'Checking GPS accuracy...',
  'Preparing report...',
  'Uploading report...',
  'Analyzing nearby reports...',
  'Updating community map...',
  'Almost done...',
];

export default function AirScanScreen() {
  const scheme = useColorScheme();
  const activeScheme = scheme === 'dark' ? 'dark' : 'light';
  const colors = Colors[activeScheme];

  const { height: windowHeight } = Dimensions.get('window');

  const {
    observationState,
    setObservationState,
    locationError,
    startGpsAcquisition,
    submitObservation,
    resetScan,
  } = useAppStore();

  const [activeRipples, setActiveRipples] = useState<{ id: number; color: string }[]>([]);
  const rippleIdRef = useRef(0);
  const [deniedExplanation, setDeniedExplanation] = useState<string | null>(null);

  const progress = useSharedValue(0);
  const ringScale1 = useSharedValue(0.8);
  const ringOpacity1 = useSharedValue(0.5);
  const ringScale2 = useSharedValue(0.8);
  const ringOpacity2 = useSharedValue(0.5);
  
  const buttonScale = useSharedValue(1);
  const breatheAnim = useSharedValue(1);
  const shakeOffset = useSharedValue(0);

  const reduceMotion = useReducedMotion();

  const [messageIdx, setMessageIdx] = useState(0);

  const location = useAppStore((state) => state.location);
  const gridId = location ? getGridId(location.coords.latitude, location.coords.longitude).gridId : null;

  // Consume global Cooldown hook, synced on active gridId changes
  const { loading: cooldownLoading, formattedTime: cooldownTimeStr, isCooldownActive: isGridCooldownActive } = useCooldown(gridId, 'observation');

  // Trigger background GPS acquisition immediately when screen opens
  useEffect(() => {
    startGpsAcquisition();
  }, []);

  // Breathing animation for button and pulse background rings in IDLE state
  useEffect(() => {
    if (observationState === 'IDLE' && !isGridCooldownActive && !cooldownLoading && !reduceMotion) {
      // Idle Breathing
      breatheAnim.value = withRepeat(
        withTiming(1.02, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
        -1,
        true
      );

      // Pulse background rings
      ringScale1.value = withRepeat(
        withTiming(1.35, { duration: 2200, easing: Easing.out(Easing.ease) }),
        -1,
        false
      );
      ringOpacity1.value = withRepeat(
        withTiming(0, { duration: 2200, easing: Easing.out(Easing.ease) }),
        -1,
        false
      );

      ringScale2.value = withDelay(
        550,
        withRepeat(
          withTiming(1.35, { duration: 2200, easing: Easing.out(Easing.ease) }),
          -1,
          false
        )
      );
      ringOpacity2.value = withDelay(
        550,
        withRepeat(
          withTiming(0, { duration: 2200, easing: Easing.out(Easing.ease) }),
          -1,
          false
        )
      );
    } else {
      breatheAnim.value = withTiming(1, { duration: 200 });
      ringScale1.value = 0.8;
      ringOpacity1.value = 0;
      ringScale2.value = 0.8;
      ringOpacity2.value = 0;
    }
  }, [observationState, isGridCooldownActive, cooldownLoading, reduceMotion]);

  // Upload progress message rotation
  useEffect(() => {
    const isUploading =
      observationState === 'GPS' ||
      observationState === 'VALIDATION' ||
      observationState === 'UPLOAD' ||
      observationState === 'WAIT_RESPONSE' ||
      observationState === 'REFRESH_HEATMAP';

    if (isUploading) {
      setMessageIdx(0);
      const interval = setInterval(() => {
        setMessageIdx((prev) => {
          if (prev < UPLOAD_MESSAGES.length - 1) {
            return prev + 1;
          }
          clearInterval(interval);
          return prev;
        });
      }, 430); // ~3000ms split across 7 steps
      return () => clearInterval(interval);
    } else {
      setMessageIdx(0);
    }
  }, [observationState]);

  // Handle hardware back button
  useEffect(() => {
    const onBackPress = () => {
      const isIdleOrFailed = observationState === 'IDLE' || observationState === 'FAILED';
      if (isIdleOrFailed) {
        handleCancel();
        return true;
      }
      return true; // Block back button during active upload
    };

    const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => subscription.remove();
  }, [observationState]);

  const spawnRipple = (color: string) => {
    const id = rippleIdRef.current++;
    setActiveRipples((prev) => [...prev, { id, color }]);
    setTimeout(() => {
      setActiveRipples((prev) => prev.filter((r) => r.id !== id));
    }, 1800);
  };

  const triggerShake = () => {
    shakeOffset.value = 0;
    shakeOffset.value = withSequence(
      withTiming(-10, { duration: 50 }),
      withTiming(10, { duration: 50 }),
      withTiming(-10, { duration: 50 }),
      withTiming(10, { duration: 50 }),
      withTiming(0, { duration: 50 })
    );
  };

  const handleTapReport = async () => {
    if (observationState !== 'IDLE' || isGridCooldownActive || cooldownLoading) return;

    setDeniedExplanation(null);
    progress.value = 0;
    progress.value = withTiming(1, { duration: 3000, easing: Easing.linear });
    buttonScale.value = withTiming(0.9, { duration: 150 });

    spawnRipple(colors.primary);

    const startTime = Date.now();
    const uploadPromise = submitObservation();

    try {
      const success = await uploadPromise;
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, 3000 - elapsed);

      if (remaining > 0) {
        await new Promise((resolve) => setTimeout(resolve, remaining));
      }

      buttonScale.value = withTiming(1, { duration: 150 });

      if (success) {
        triggerSuccessHaptic();
        setObservationState('SUCCESS');
        setTimeout(() => {
          resetScan();
          router.back();
        }, 3000);
      } else {
        triggerFailureHaptic();
        triggerShake();
        if (useAppStore.getState().locationError) {
          setDeniedExplanation(useAppStore.getState().locationError);
        }
      }
    } catch (err) {
      triggerFailureHaptic();
      triggerShake();
      buttonScale.value = withTiming(1, { duration: 150 });
    }
  };

  const handleRetry = () => {
    handleTapReport();
  };

  const handleCancel = () => {
    resetScan();
    router.back();
  };

  // Status text resolver
  const getStatusText = () => {
    if (cooldownLoading) {
      return 'Checking cooldown status...';
    }
    if (observationState === 'IDLE') {
      return isGridCooldownActive ? 'Already submitted. Please wait.' : 'Press to scan environment';
    }
    if (
      observationState === 'GPS' ||
      observationState === 'VALIDATION' ||
      observationState === 'UPLOAD' ||
      observationState === 'WAIT_RESPONSE' ||
      observationState === 'REFRESH_HEATMAP'
    ) {
      return UPLOAD_MESSAGES[messageIdx];
    }
    if (observationState === 'SUCCESS') {
      return 'Completed!';
    }
    if (observationState === 'FAILED') {
      return locationError || 'Upload failed. Please check internet connection.';
    }
    return 'Press to scan environment';
  };

  // Animated styles
  const animatedRingStyle1 = useAnimatedStyle(() => ({
    transform: [{ scale: ringScale1.value }],
    opacity: ringOpacity1.value,
  }));

  const animatedRingStyle2 = useAnimatedStyle(() => ({
    transform: [{ scale: ringScale2.value }],
    opacity: ringOpacity2.value,
  }));

  const animatedProgressStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));

  const animatedButtonStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: breatheAnim.value * buttonScale.value },
      { translateX: shakeOffset.value },
    ],
  }));

  const showCloseButton = observationState === 'IDLE' || observationState === 'FAILED';

  const getButtonBgColor = () => {
    if (cooldownLoading || isGridCooldownActive) return colors.neutral200;
    if (observationState === 'SUCCESS') return '#22C55E';
    if (observationState === 'FAILED') return colors.danger;
    return colors.primary;
  };

  const getButtonIcon = () => {
    if (observationState === 'SUCCESS') {
      return <Icon name="check" size={48} color="#ffffff" />;
    }
    if (observationState === 'FAILED') {
      return <Icon name="close" size={48} color="#ffffff" />;
    }
    return <Icon name="air" size={48} color={(isGridCooldownActive || cooldownLoading) ? colors.neutral400 : '#ffffff'} />;
  };

  const isUploadingState =
    observationState === 'GPS' ||
    observationState === 'VALIDATION' ||
    observationState === 'UPLOAD' ||
    observationState === 'WAIT_RESPONSE' ||
    observationState === 'REFRESH_HEATMAP';

  return (
    <View style={[styles.container, { backgroundColor: colors.background, height: windowHeight }]}>
      {/* Top Bar with Cancel / Back Button — Persistent container to prevent layout shifts */}
      <View style={styles.topBar}>
        {showCloseButton ? (
          <Pressable
            onPress={handleCancel}
            style={({ pressed }) => [
              styles.closeButton,
              { backgroundColor: colors.backgroundElement },
              pressed && { opacity: 0.7 }
            ]}
            accessibilityRole="button"
            accessibilityLabel="Go back to Main Map"
          >
            <Icon name="arrow-back" size={24} themeColor="text" />
          </Pressable>
        ) : (
          <View style={[styles.closeButton, { opacity: 0 }]} />
        )}
        <Text style={[styles.topTitle, { color: colors.text }]}>Air Report</Text>
      </View>

      {/* Main Scanner Container */}
      <View style={styles.centerArea}>
        <View style={styles.brandMarkContainer}>
          {/* Countdown above the Air button in cooldown */}
          {observationState === 'IDLE' && isGridCooldownActive && cooldownTimeStr && (
            <View style={styles.cooldownContainer}>
              <Text style={[styles.cooldownText, { color: colors.danger }]}>
                {cooldownTimeStr}
              </Text>
            </View>
          )}

          {/* Animated Background Pulsing Rings */}
          {(observationState === 'IDLE' || observationState === 'HOLDING') && !isGridCooldownActive && !cooldownLoading && (
            <>
              <Animated.View style={[styles.pulseRing, { backgroundColor: colors.primary }, animatedRingStyle1]} />
              <Animated.View style={[styles.pulseRing, { backgroundColor: colors.primary }, animatedRingStyle2]} />
            </>
          )}

          {/* Ripples triggered by milestones */}
          {activeRipples.map((ripple) => (
            <RippleWave key={ripple.id} color={ripple.color} />
          ))}

          {/* Central Interactive Scanning Button */}
          <Animated.View style={[animatedButtonStyle]}>
            <Pressable
              onPress={handleTapReport}
              disabled={observationState !== 'IDLE' || isGridCooldownActive || cooldownLoading}
              style={[
                styles.scanFab,
                { 
                  backgroundColor: getButtonBgColor(),
                  opacity: observationState !== 'IDLE' && !isUploadingState && observationState !== 'SUCCESS' && !isGridCooldownActive && !cooldownLoading ? 0.6 : 1
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Tap to scan environment"
            >
              {isUploadingState || cooldownLoading ? (
                <ActivityIndicator size="large" color="#ffffff" />
              ) : (
                getButtonIcon()
              )}
            </Pressable>
          </Animated.View>
        </View>

        {/* Progress Display Section */}
        <View style={styles.progressSection}>
          {/* Linear Progress Bar during upload */}
          {isUploadingState && (
            <View style={[styles.progressContainer, { backgroundColor: colors.border }]}>
              <Animated.View style={[styles.progressBar, { backgroundColor: colors.primary }, animatedProgressStyle]} />
            </View>
          )}

          {/* Status Label */}
          <Text style={[styles.statusText, { color: colors.text }]}>{getStatusText()}</Text>

          {/* Location Denied Explanation Section */}
          {deniedExplanation && (
            <Text style={[styles.explanationText, { color: colors.textSecondary }]}>
              {deniedExplanation}
            </Text>
          )}
        </View>
      </View>

      {/* Action panel for FAILED/Retry states */}
      {observationState === 'FAILED' && (
        <View style={styles.failedActions}>
          <View style={styles.buttonWrapper}>
            <Button
              label="Cancel"
              onPress={handleCancel}
              variant="outlined"
              style={styles.actionButton}
            />
          </View>
          <View style={styles.buttonWrapper}>
            <Button
              label="Retry"
              onPress={handleRetry}
              variant="filled"
              style={styles.actionButton}
            />
          </View>
        </View>
      )}
    </View>
  );
}

// Ripple Component
function RippleWave({ color }: { color: string }) {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0.4);

  useEffect(() => {
    scale.value = withTiming(2.6, { duration: 1800, easing: Easing.out(Easing.ease) });
    opacity.value = withTiming(0, { duration: 1800, easing: Easing.out(Easing.ease) });
  }, [opacity, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        styles.ripple,
        { backgroundColor: color },
        animatedStyle,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: Spacing.five,
    justifyContent: 'space-between',
    paddingBottom: Spacing.eight,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 54,
    gap: Spacing.four,
    width: '100%',
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topTitle: {
    fontFamily: Fonts.sans,
    fontSize: Typography.h3.fontSize,
    fontWeight: Typography.h3.fontWeight,
  },
  centerArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandMarkContainer: {
    width: 220,
    height: 220,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginBottom: Spacing.six,
  },
  cooldownContainer: {
    position: 'absolute',
    top: -30,
    alignSelf: 'center',
    alignItems: 'center',
  },
  cooldownText: {
    fontFamily: Fonts.sans,
    fontSize: Typography.bodyLg.fontSize,
    fontWeight: 'bold',
  },
  pulseRing: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: Radius.full,
    opacity: 0,
  },
  ripple: {
    position: 'absolute',
    width: 96,
    height: 96,
    borderRadius: Radius.full,
  },
  scanFab: {
    width: 96,
    height: 96,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.16,
    shadowRadius: 24,
    elevation: 8,
  },
  progressSection: {
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: Spacing.five,
    gap: Spacing.three,
  },
  progressContainer: {
    width: 140,
    height: 4,
    borderRadius: Radius.full,
    overflow: 'hidden',
    marginBottom: Spacing.two,
  },
  progressBar: {
    height: '100%',
    width: '0%',
  },
  statusText: {
    fontFamily: Fonts.sans,
    fontSize: Typography.bodyLg.fontSize,
    fontWeight: Typography.bodyLg.fontWeight,
    textAlign: 'center',
    lineHeight: Typography.bodyLg.lineHeight,
  },
  explanationText: {
    fontFamily: Fonts.sans,
    fontSize: Typography.caption.fontSize,
    textAlign: 'center',
    marginTop: Spacing.two,
    lineHeight: Typography.caption.lineHeight,
    maxWidth: 260,
  },
  failedActions: {
    flexDirection: 'row',
    gap: Spacing.four,
    width: '100%',
  },
  buttonWrapper: {
    flex: 1,
  },
  actionButton: {
    borderRadius: Radius.full,
  },
});

