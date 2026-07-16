import React, { useState } from 'react';
import { StyleSheet, View, Text, useColorScheme, Dimensions, Pressable } from 'react-native';
import Animated, { FadeIn, FadeOut, Layout, useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { Image } from 'expo-image';
import { Colors, Radius, Spacing, Typography, Fonts } from '@/constants/theme';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';

interface OnboardingOverlayProps {
  onComplete: () => void;
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export function OnboardingOverlay({ onComplete }: OnboardingOverlayProps) {
  const scheme = useColorScheme();
  const activeScheme = scheme === 'dark' ? 'dark' : 'light';
  const colors = Colors[activeScheme];

  const [currentIndex, setCurrentIndex] = useState(0);
  const overlayOpacity = useSharedValue(1);

  const handleNext = () => {
    if (currentIndex < 2) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      overlayOpacity.value = withTiming(0, { duration: 500 }, (finished) => {
        if (finished) {
          // Complete onboarding
          onComplete();
        }
      });
    }
  };

  const animatedOverlayStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
  }));

  return (
    <Animated.View style={[styles.container, { backgroundColor: colors.backgroundElement }, animatedOverlayStyle]}>
      <View style={styles.mainContent}>
        {currentIndex === 0 && (
          <Animated.View key="slide0" entering={FadeIn.duration(300)} exiting={FadeOut.duration(300)} style={styles.slide}>
            <View style={styles.illustrationWrapper}>
              <View style={[styles.blob, { backgroundColor: colors.primary + '1a' }]} />
              <Image
                source="https://lh3.googleusercontent.com/aida/AP1WRLuVO1wQAkvLH4zLF94EeQwu1PqwBRsb_lcVGozpEvqCjUu05gSQxchTKAaCK2yOqa5LpowyIiMv_iNNvek6qBVBQlgjgBtz3zFsF1l0rZBfi598psdqxQmtQXlnloKgkEe579_MU05q4NWNIA2GYF_v0Jk2eixb-IQFSOcwBF8E1Iqh6mzsUGVZ5H3BrqBelZX6410Sr0WH3ebwS82KmoBBhFPwK8DYNeh-u9TPj3rmVXm7CY-vUuKi1ODq"
                style={styles.illustration}
                contentFit="contain"
                accessible={true}
                accessibilityLabel="Illustration of a person walking near a cafe in a clean environment."
              />
            </View>
            <View style={styles.textWrapper}>
              <Text style={[styles.title, { color: colors.text }]}>Find Your Comfort Zone</Text>
              <Text style={[styles.desc, { color: colors.textSecondary }]}>
                Discover places with cleaner air and choose the environment that feels right for you.
              </Text>
            </View>
          </Animated.View>
        )}

        {currentIndex === 1 && (
          <Animated.View key="slide1" entering={FadeIn.duration(300)} exiting={FadeOut.duration(300)} style={styles.slide}>
            <View style={styles.illustrationWrapper}>
              <View style={[styles.blob, { backgroundColor: colors.primary + '1a' }]} />
              <Image
                source="https://lh3.googleusercontent.com/aida/AP1WRLvSf9q2DWVuqyHkvh_SaB1Xbp3_Lk7q9fIjBctGaTKYTRjm0WBBhNOn4xvtgAfKVu3QFhJYuEu-S2fsnuHI_8O3hPVwsbvW4_vmGgUeM3b0FupqPNu68dBYcc9DRAMd5GDVJmqM5j-O9vleThnOYusNV-32J-K2Qo1JD4bc4Y-BxdcbmpRtP5-VZ6N3Q7kb37_zzhROKxcrHU1XZZysuDMPNf7AGmCPufo4DKTtArxrZgPWlZGASlndD3HR"
                style={styles.illustration}
                contentFit="contain"
                accessible={true}
                accessibilityLabel="Illustration of active community crowdsourcing smoke-free spaces."
              />
            </View>
            <View style={styles.textWrapper}>
              <Text style={[styles.title, { color: colors.text }]}>Powered by community.</Text>
              <Text style={[styles.desc, { color: colors.textSecondary }]}>
                Community reports keep air conditions accurate and updated in real time. Help others by sharing what you see.
              </Text>
            </View>
          </Animated.View>
        )}

        {currentIndex === 2 && (
          <Animated.View key="slide2" entering={FadeIn.duration(300)} exiting={FadeOut.duration(300)} style={styles.slide}>
            <View style={styles.mockMapWrapper} accessible={true} accessibilityLabel="Mock map screen preview showcasing search parameters and floating hazard index details.">
              {/* Stylized Mock Map Background */}
              <Image
                source="https://lh3.googleusercontent.com/aida-public/AB6AXuCISXS3V_wrmquH0pYroE1gbbsNsWb1hv0pMmc70EwaXC1GsteU187ZTjGoLo9hfqanTbdYqu-z7JwXApr6HR0EWGPAeDZOPa5ww-J32oy7zq12Z6M-J9fgy_Fjv7hvhoANsEOS8ajVWJM1Nuh0mX3r73U-cFow1oU3lu9Zmsny6m7TgrGWX-_CgQuepzqWkVHMe3h8sorfqgynxSVqdfBZMXQfmCx2_ruiJtI19eiyrh2p57aliSDG1o9Mt6527wy2EZslX0CkZYkb"
                style={styles.mockMapImage}
                contentFit="cover"
              />
              {/* Glassmorphic Search Bar */}
              <View style={[styles.mockSearchBar, { backgroundColor: activeScheme === 'dark' ? 'rgba(27,31,22,0.55)' : 'rgba(255,255,255,0.55)', borderColor: activeScheme === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.6)' }]}>
                <Icon name="search" size={20} themeColor="textSecondary" />
                <Text style={[styles.mockSearchText, { color: colors.textSecondary }]}>Search locations...</Text>
              </View>

              {/* Heatmap indicators overlay */}
              <View style={[styles.mockHeatmapPin, { top: '30%', left: '20%' }]}>
                <View style={[styles.mockHeatmapInner, { backgroundColor: colors.heatmapLight + '4d', borderColor: colors.heatmapLight }]} />
              </View>

              <View style={[styles.mockHeatmapPin, { top: '48%', right: '25%' }]}>
                <View style={[styles.mockHeatmapInner, { backgroundColor: colors.heatmapModerate + '4d', borderColor: colors.heatmapModerate }]} />
              </View>

              <View style={[styles.mockHeatmapPin, { bottom: '35%', left: '35%' }]}>
                <View style={[styles.mockHeatmapInner, { backgroundColor: colors.heatmapDense + '4d', borderColor: colors.heatmapDense }]} />
              </View>

              {/* Current Location blue dot */}
              <View style={[styles.mockLocationPin, { top: '58%', left: '44%' }]}>
                <View style={[styles.mockLocationOuter, { backgroundColor: colors.secondary + '66' }]}>
                  <View style={[styles.mockLocationInner, { backgroundColor: colors.secondary }]} />
                </View>
              </View>

              {/* GPS button */}
              <View style={[styles.mockGpsButton, { backgroundColor: colors.backgroundElement }]}>
                <Icon name="my-location" size={20} themeColor="text" />
              </View>

              {/* Mock navigation bar */}
              <View style={[styles.mockNavBar, { backgroundColor: colors.backgroundElement, borderTopColor: colors.border }]}>
                <Icon name="home" size={20} color={colors.textSecondary} />
                <Icon name="air" size={20} color={colors.primary} />
                <Icon name="person" size={20} color={colors.textSecondary} />
              </View>
            </View>

            <View style={styles.textWrapper}>
              <Text style={[styles.title, { color: colors.text }]}>Ready to explore?</Text>
              <Text style={[styles.desc, { color: colors.textSecondary }]}>
                Start exploring nearby places with live air comfort status and choose the environment that suits you best.
              </Text>
            </View>
          </Animated.View>
        )}
      </View>

      <View style={styles.footer}>
        {/* Page dot indicator */}
        <View style={styles.pagination} accessible={true} accessibilityLabel={`Page indicator. Slide ${currentIndex + 1} of 3.`}>
          {[0, 1, 2].map((idx) => (
            <View
              key={idx}
              style={[
                styles.dot,
                { backgroundColor: idx === currentIndex ? colors.primary : colors.neutral400 },
                idx === currentIndex && { width: 16 },
              ]}
            />
          ))}
        </View>

        {/* Next / Get Started button */}
        <Button
          label={currentIndex === 2 ? 'Get Started' : 'Next'}
          onPress={handleNext}
          variant="filled"
          accessibilityLabel={currentIndex === 2 ? 'Get started and open air comfort map' : 'Go to next onboarding slide'}
        >
          {currentIndex < 2 && <Icon name="arrow-forward" size={18} color="#ffffff" />}
        </Button>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 900,
    flexDirection: 'column',
  },
  mainContent: {
    flex: 1,
    width: '100%',
  },
  slide: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  illustrationWrapper: {
    flex: 1.2,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    padding: Spacing.five,
  },
  blob: {
    position: 'absolute',
    width: 250,
    height: 250,
    borderRadius: Radius.full,
  },
  illustration: {
    width: '100%',
    height: '70%',
    zIndex: 10,
  },
  textWrapper: {
    flex: 0.8,
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: Spacing.five,
    justifyContent: 'flex-start',
  },
  title: {
    fontFamily: Fonts.sans,
    fontSize: Typography.h2.fontSize,
    fontWeight: Typography.display.fontWeight,
    lineHeight: Typography.display.lineHeight,
    textAlign: 'center',
    marginBottom: Spacing.three,
  },
  desc: {
    fontFamily: Fonts.sans,
    fontSize: Typography.bodyLg.fontSize,
    fontWeight: Typography.bodyLg.fontWeight,
    lineHeight: Typography.bodyLg.lineHeight,
    textAlign: 'center',
    maxWidth: 290,
  },
  mockMapWrapper: {
    flex: 1.4,
    width: '90%',
    marginTop: Spacing.six,
    borderRadius: Radius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
    position: 'relative',
  },
  mockMapImage: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.8,
  },
  mockSearchBar: {
    position: 'absolute',
    top: Spacing.four,
    left: Spacing.four,
    right: Spacing.four,
    height: 38,
    borderRadius: Radius.full,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    gap: Spacing.two,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  mockSearchText: {
    fontFamily: Fonts.sans,
    fontSize: Typography.body.fontSize,
    fontWeight: Typography.body.fontWeight,
  },
  mockHeatmapPin: {
    position: 'absolute',
  },
  mockHeatmapInner: {
    width: 64,
    height: 64,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  mockLocationPin: {
    position: 'absolute',
  },
  mockLocationOuter: {
    width: 48,
    height: 48,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mockLocationInner: {
    width: 14,
    height: 14,
    borderRadius: Radius.full,
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  mockGpsButton: {
    position: 'absolute',
    right: Spacing.four,
    bottom: 64,
    width: 36,
    height: 36,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
  },
  mockNavBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 48,
    borderTopWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  footer: {
    width: '100%',
    paddingHorizontal: Spacing.five,
    paddingBottom: Spacing.six,
    gap: Spacing.four,
  },
  pagination: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: Radius.full,
  },
});
