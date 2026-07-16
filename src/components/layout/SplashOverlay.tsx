import React, { useState, useRef, useEffect } from 'react';
import { StyleSheet, View, Text, Pressable, useColorScheme } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withDelay,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import { Colors, Radius, Spacing, Typography, Fonts } from '@/constants/theme';
import { Icon } from '@/components/ui/Icon';

interface SplashOverlayProps {
  onComplete: () => void;
}

export function SplashOverlay({ onComplete }: SplashOverlayProps) {
  const scheme = useColorScheme();
  const activeScheme = scheme === 'dark' ? 'dark' : 'light';
  const colors = Colors[activeScheme];

  const [statusText, setStatusText] = useState('Hold to Scan Environment');
  const [isSuccess, setIsSuccess] = useState(false);
  const [activeRipples, setActiveRipples] = useState<{ id: number; color: string }[]>([]);
  const rippleIdRef = useRef(0);

  const progress = useSharedValue(0);
  const ringScale1 = useSharedValue(0.8);
  const ringOpacity1 = useSharedValue(0.5);
  const ringScale2 = useSharedValue(0.8);
  const ringOpacity2 = useSharedValue(0.5);
  const buttonScale = useSharedValue(1);

  const overlayOpacity = useSharedValue(1);

  // Timers for triggering waves and success
  const timer1 = useRef<NodeJS.Timeout | null>(null);
  const timer2 = useRef<NodeJS.Timeout | null>(null);
  const timer3 = useRef<NodeJS.Timeout | null>(null);
  const successTimer = useRef<NodeJS.Timeout | null>(null);
  const holding = useRef(false);

  // Pulse animations for background rings
  useEffect(() => {
    ringScale1.value = withRepeat(
      withTiming(1.3, { duration: 2000, easing: Easing.out(Easing.ease) }),
      -1,
      false
    );
    ringOpacity1.value = withRepeat(
      withTiming(0, { duration: 2000, easing: Easing.out(Easing.ease) }),
      -1,
      false
    );

    // Delay the second ring
    ringScale2.value = withDelay(
      500,
      withRepeat(
        withTiming(1.3, { duration: 2000, easing: Easing.out(Easing.ease) }),
        -1,
        false
      )
    );
    ringOpacity2.value = withDelay(
      500,
      withRepeat(
        withTiming(0, { duration: 2000, easing: Easing.out(Easing.ease) }),
        -1,
        false
      )
    );
  }, [ringOpacity1, ringOpacity2, ringScale1, ringScale2]);

  const spawnRipple = (color: string) => {
    const id = rippleIdRef.current++;
    setActiveRipples((prev) => [...prev, { id, color }]);
    // Auto-remove ripple after animation
    setTimeout(() => {
      setActiveRipples((prev) => prev.filter((r) => r.id !== id));
    }, 1800);
  };

  const handlePressIn = () => {
    if (isSuccess) return;
    holding.current = true;

    setStatusText('Scanning Air Quality...');
    buttonScale.value = withTiming(0.96, { duration: 150 });
    progress.value = withTiming(1, { duration: 3000, easing: Easing.linear });

    // Clear previous ripples
    setActiveRipples([]);

    // Wave 1: Green at 1000ms
    timer1.current = setTimeout(() => {
      if (holding.current) {
        spawnRipple('#22C55E');
      }
    }, 1000);

    // Wave 2: Yellow at 2000ms
    timer2.current = setTimeout(() => {
      if (holding.current) {
        spawnRipple('#FACC15');
      }
    }, 2000);

    // Wave 3: Red at 3000ms
    timer3.current = setTimeout(() => {
      if (holding.current) {
        spawnRipple('#EF4444');
      }
    }, 3000);

    // Success at 3000ms
    successTimer.current = setTimeout(() => {
      if (holding.current) {
        setIsSuccess(true);
        setStatusText('Scan Complete');
        buttonScale.value = withTiming(1, { duration: 150 });
        
        // Final fade out after 800ms to let user see "Scan Complete"
        setTimeout(() => {
          overlayOpacity.value = withTiming(0, { duration: 500 }, (finished) => {
            if (finished) {
              runOnJS(onComplete)();
            }
          });
        }, 800);
      }
    }, 3000);
  };

  const handlePressOut = () => {
    holding.current = false;
    
    // Clear holding timers
    if (timer1.current) clearTimeout(timer1.current);
    if (timer2.current) clearTimeout(timer2.current);
    if (timer3.current) clearTimeout(timer3.current);
    if (successTimer.current) clearTimeout(successTimer.current);

    if (!isSuccess) {
      setStatusText('Hold to Scan Environment');
      buttonScale.value = withTiming(1, { duration: 150 });
      progress.value = withTiming(0, { duration: 200 });
      setActiveRipples([]);
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

  const animatedOverlayStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
  }));

  return (
    <Animated.View style={[styles.container, { backgroundColor: colors.background }, animatedOverlayStyle]}>
      <View style={styles.brandMarkContainer}>
        {/* Animated Background Pulsing Rings */}
        {!isSuccess && (
          <>
            <Animated.View style={[styles.pulseRing, { backgroundColor: colors.primary }, animatedRingStyle1]} />
            <Animated.View style={[styles.pulseRing, { backgroundColor: colors.primary }, animatedRingStyle2]} />
          </>
        )}

        {/* Ripples triggered by hold intervals */}
        {activeRipples.map((ripple) => (
          <RippleWave key={ripple.id} color={ripple.color} />
        ))}

        {/* Central interactive FAB */}
        <Animated.View style={[animatedButtonStyle]}>
          <Pressable
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            style={[
              styles.fab,
              { backgroundColor: isSuccess ? '#22C55E' : colors.primary },
            ]}>
            <Icon name={isSuccess ? 'check' : 'air'} size={48} color="#ffffff" />
          </Pressable>
        </Animated.View>
      </View>

      {/* Progress indicators */}
      <View style={styles.progressSection}>
        <View style={[styles.progressContainer, { backgroundColor: colors.border }, !isSuccess && progress.value === 0 && { opacity: 0 }]}>
          <Animated.View style={[styles.progressBar, { backgroundColor: colors.primary }, animatedProgressStyle]} />
        </View>
        <Text style={[styles.statusText, { color: colors.textSecondary }]}>{statusText}</Text>
      </View>
    </Animated.View>
  );
}

// Single Ripple animation component
function RippleWave({ color }: { color: string }) {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0.4);

  useEffect(() => {
    scale.value = withTiming(2.5, { duration: 1800, easing: Easing.out(Easing.ease) });
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
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  brandMarkContainer: {
    width: 200,
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
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
  fab: {
    width: 96,
    height: 96,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 8,
  },
  progressSection: {
    marginTop: Spacing.six,
    alignItems: 'center',
    gap: Spacing.three,
  },
  progressContainer: {
    width: 120,
    height: 4,
    borderRadius: Radius.full,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    width: '0%',
  },
  statusText: {
    fontFamily: Fonts.sans,
    fontSize: Typography.caption.fontSize,
    fontWeight: Typography.caption.fontWeight,
    lineHeight: Typography.caption.lineHeight,
    textAlign: 'center',
  },
});
