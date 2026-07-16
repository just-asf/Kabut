import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View, Text, Pressable, useColorScheme, BackHandler, ActivityIndicator, Vibration, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withDelay,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import { router } from 'expo-router';
import { Colors, Radius, Spacing, Typography, Fonts } from '@/constants/theme';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { useAppStore, ObservationState } from '@/store/useAppStore';

export default function AirScanScreen() {
  const scheme = useColorScheme();
  const activeScheme = scheme === 'dark' ? 'dark' : 'light';
  const colors = Colors[activeScheme];

  const { height: windowHeight } = Dimensions.get('window');

  const {
    observationState,
    setObservationState,
    scanProgress,
    setScanProgress,
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

  const holding = useRef(false);
  const timer1 = useRef<NodeJS.Timeout | null>(null);
  const timer2 = useRef<NodeJS.Timeout | null>(null);
  const timer3 = useRef<NodeJS.Timeout | null>(null);
  const successTimer = useRef<NodeJS.Timeout | null>(null);

  // Trigger background GPS acquisition immediately when screen opens
  useEffect(() => {
    startGpsAcquisition();
  }, []);

  // Pulse animations for background rings when IDLE/HOLDING
  useEffect(() => {
    if (observationState === 'IDLE' || observationState === 'HOLDING') {
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
      ringScale1.value = 0.8;
      ringOpacity1.value = 0;
      ringScale2.value = 0.8;
      ringOpacity2.value = 0;
    }
  }, [observationState, ringOpacity1, ringOpacity2, ringScale1, ringScale2]);

  // Handle hardware back button
  useEffect(() => {
    const onBackPress = () => {
      if (observationState === 'IDLE' || observationState === 'FAILED') {
        handleCancel();
        return true;
      }
      // Block backing out during active validation/upload
      return true;
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

  const handlePressIn = () => {
    if (observationState !== 'IDLE') return;
    holding.current = true;
    setDeniedExplanation(null);
    setObservationState('HOLDING');
    buttonScale.value = withTiming(0.95, { duration: 150 });
    progress.value = withTiming(1, { duration: 3000, easing: Easing.linear }, (finished) => {
      if (finished) {
        runOnJS(handleHoldComplete)();
      }
    });

    // Wave 1: Green at 1000ms
    timer1.current = setTimeout(() => {
      if (holding.current) spawnRipple('#22C55E');
    }, 1000);

    // Wave 2: Yellow at 2000ms
    timer2.current = setTimeout(() => {
      if (holding.current) spawnRipple('#FACC15');
    }, 2000);

    // Wave 3: Red at 3000ms
    timer3.current = setTimeout(() => {
      if (holding.current) spawnRipple('#EF4444');
    }, 3000);
  };

  const handlePressOut = () => {
    if (observationState !== 'HOLDING') return;
    holding.current = false;
    clearTimers();

    setObservationState('IDLE');
    buttonScale.value = withTiming(1, { duration: 150 });
    progress.value = withTiming(0, { duration: 250 });
    setScanProgress(0);
    setActiveRipples([]);
  };

  const clearTimers = () => {
    if (timer1.current) clearTimeout(timer1.current);
    if (timer2.current) clearTimeout(timer2.current);
    if (timer3.current) clearTimeout(timer3.current);
    if (successTimer.current) clearTimeout(successTimer.current);
  };

  const handleHoldComplete = async () => {
    holding.current = false;
    buttonScale.value = withTiming(1, { duration: 150 });
    setScanProgress(1);
    
    // Trigger backend upload flow
    const success = await submitObservation();
    if (success) {
      // Trigger success haptic feedback twice (Short vibration -> Pause -> Short vibration)
      Vibration.vibrate(100);
      setTimeout(() => {
        Vibration.vibrate(100);
      }, 200);

      setObservationState('SUCCESS');
      // Show success animation for 3.0s then navigate back
      setTimeout(() => {
        resetScan();
        router.back();
      }, 3000);
    } else {
      // Trigger failure haptic feedback once
      Vibration.vibrate(100);

      // Check if failed due to location permissions
      // Note: useAppStore updates locationError if permission denied
      if (useAppStore.getState().locationError) {
        setDeniedExplanation('Location permission is required to geotag and verify air comfort reports.');
      }
    }
  };

  const handleRetry = async () => {
    setDeniedExplanation(null);
    const success = await submitObservation();
    if (success) {
      // Trigger success haptic feedback twice (Short vibration -> Pause -> Short vibration)
      Vibration.vibrate(100);
      setTimeout(() => {
        Vibration.vibrate(100);
      }, 200);

      setObservationState('SUCCESS');
      setTimeout(() => {
        resetScan();
        router.back();
      }, 3000);
    } else {
      // Trigger failure haptic feedback once
      Vibration.vibrate(100);
    }
  };

  const handleCancel = () => {
    clearTimers();
    resetScan();
    router.back();
  };

  // Sync Reanimated shared value to Zustand scan progress state for UI displays
  useEffect(() => {
    const interval = setInterval(() => {
      if (observationState === 'HOLDING') {
        setScanProgress(progress.value);
      }
    }, 100);
    return () => clearInterval(interval);
  }, [observationState]);

  // Status text resolver
  const getStatusText = () => {
    switch (observationState) {
      case 'HOLDING':
        return `Scanning Air Quality... ${Math.round(scanProgress * 100)}%`;
      case 'GPS':
        return 'Requesting GPS Location...';
      case 'VALIDATION':
        return 'Verifying GPS coordinates accuracy...';
      case 'UPLOAD':
        return 'Publishing live air comfort report...';
      case 'WAIT_RESPONSE':
        return 'Securing connection to Supabase...';
      case 'REFRESH_HEATMAP':
        return 'Updating active heatmap layer...';
      case 'SUCCESS':
        return 'Report Published Successfully!';
      case 'FAILED':
        return locationError || 'Upload failed. Please check internet connection.';
      case 'IDLE':
      default:
        return 'Press and Hold to scan environment';
    }
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
    transform: [{ scale: buttonScale.value }],
  }));

  const showCloseButton = observationState === 'IDLE' || observationState === 'FAILED';

  return (
    <View style={[styles.container, { backgroundColor: colors.background, height: windowHeight }]}>
      {/* Top Bar with Cancel / Back Button */}
      {showCloseButton && (
        <View style={styles.topBar}>
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
          <Text style={[styles.topTitle, { color: colors.text }]}>Air Report</Text>
        </View>
      )}

      {/* Main Hold Gesture Container */}
      <View style={styles.centerArea}>
        <View style={styles.brandMarkContainer}>
          {/* Animated Background Pulsing Rings */}
          {(observationState === 'IDLE' || observationState === 'HOLDING') && (
            <>
              <Animated.View style={[styles.pulseRing, { backgroundColor: colors.primary }, animatedRingStyle1]} />
              <Animated.View style={[styles.pulseRing, { backgroundColor: colors.primary }, animatedRingStyle2]} />
            </>
          )}

          {/* Ripples triggered by hold milestones */}
          {activeRipples.map((ripple) => (
            <RippleWave key={ripple.id} color={ripple.color} />
          ))}

          {/* Central Interactive Scanning Button */}
          <Animated.View style={[animatedButtonStyle]}>
            <Pressable
              onPressIn={handlePressIn}
              onPressOut={handlePressOut}
              disabled={observationState !== 'IDLE'}
              style={[
                styles.scanFab,
                { 
                  backgroundColor: observationState === 'SUCCESS' ? '#22C55E' : colors.primary,
                  opacity: observationState !== 'IDLE' && observationState !== 'HOLDING' && observationState !== 'SUCCESS' ? 0.6 : 1
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Hold to report smoke-free status"
            >
              {observationState === 'SUCCESS' ? (
                <Icon name="check" size={48} color="#ffffff" />
              ) : observationState !== 'IDLE' && observationState !== 'HOLDING' ? (
                <ActivityIndicator size="large" color="#ffffff" />
              ) : (
                <Icon name="air" size={48} color="#ffffff" />
              )}
            </Pressable>
          </Animated.View>
        </View>

        {/* Progress Display Section */}
        <View style={styles.progressSection}>
          {/* Linear Progress Bar for holding */}
          {observationState === 'HOLDING' && (
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
