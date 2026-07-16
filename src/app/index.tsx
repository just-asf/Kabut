import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TextInput, Pressable, useColorScheme, Platform, Alert } from 'react-native';
import { Image } from 'expo-image';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import * as Location from 'expo-location';
import { Colors, Radius, Spacing, Typography, Fonts } from '@/constants/theme';
import { SplashOverlay } from '@/components/layout/SplashOverlay';
import { OnboardingOverlay } from '@/components/layout/OnboardingOverlay';
import { ReportConfirmModal } from '@/components/layout/ReportConfirmModal';
import { Icon } from '@/components/ui/Icon';

const ONBOARDING_STORAGE_KEY = 'KABUT_ONBOARDING_COMPLETED';

export default function HomeScreen() {
  const scheme = useColorScheme();
  const activeScheme = scheme === 'dark' ? 'dark' : 'light';
  const colors = Colors[activeScheme];

  const [showSplash, setShowSplash] = useState(true);
  const [isOnboarded, setIsOnboarded] = useState(false);
  const [showReportConfirm, setShowReportConfirm] = useState(false);
  
  // GPS Location States
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  
  // Reporting Throttling State
  const [reporting, setReporting] = useState(false);

  // Check if user has completed onboarding previously
  useEffect(() => {
    async function loadOnboardingState() {
      try {
        const value = await AsyncStorage.getItem(ONBOARDING_STORAGE_KEY);
        if (value === 'true') {
          setIsOnboarded(true);
        }
      } catch (err) {
        console.error('Failed to load onboarding state:', err);
      }
    }
    loadOnboardingState();
  }, []);

  // Fetch real coordinates upon onboarding completion
  useEffect(() => {
    if (isOnboarded) {
      async function requestLocation() {
        try {
          const { status } = await Location.requestForegroundPermissionsAsync();
          if (status !== 'granted') {
            setLocationError('Location permission denied');
            return;
          }
          const loc = await Location.getCurrentPositionAsync({});
          setLocation(loc);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          setLocationError(msg);
          console.warn('Failed to fetch location:', msg);
        }
      }
      requestLocation();
    }
  }, [isOnboarded]);

  const handleSplashComplete = () => {
    setShowSplash(false);
  };

  const handleOnboardingComplete = async () => {
    try {
      await AsyncStorage.setItem(ONBOARDING_STORAGE_KEY, 'true');
      setIsOnboarded(true);
    } catch (err) {
      console.error('Failed to save onboarding state:', err);
    }
  };

  const handleFABPress = () => {
    setShowReportConfirm(true);
  };

  const handleConfirmReport = () => {
    setReporting(true);
    // Simulate API request delay to throttle double-tap submissions
    setTimeout(() => {
      setReporting(false);
      setShowReportConfirm(false);
      if (Platform.OS === 'web') {
        alert('Success: Zone reported as smoke-free! Air quality indicators updated.');
      } else {
        Alert.alert(
          'Report Submitted', 
          'Thank you! Your report has been logged and the live air map has been updated.'
        );
      }
    }, 1500);
  };

  const handleProfilePress = () => {
    router.push('/supabase-test');
  };

  // 1. Render Splash hold-to-scan gesture overlay initially
  if (showSplash) {
    return <SplashOverlay onComplete={handleSplashComplete} />;
  }

  // 2. Render Onboarding slider overlays if not yet complete
  if (!isOnboarded) {
    return <OnboardingOverlay onComplete={handleOnboardingComplete} />;
  }

  // 3. Render Main Map dashboard view once onboarded
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Base Map Image Layer */}
      <Image
        source="https://lh3.googleusercontent.com/aida-public/AB6AXuDUR3fVXmY8YxF-SaNI3wjHICuOE80xxqNE1I33BZDhMPUj8ueMvZ9eX1b26kpfXhVZAQpJ0pN63hNW1Ase4PQ4V_sEI23lv0wNyCCnw0XZ_L-hxX-TgDGtYr1rfJvWx1q7U8WMPZTZZBv2b0W4o6U_hMGxNfvl5--hwb2FJIHwefw1WuRrnipVGTavuCwkAoz8ViA87lUTLOrLQ9BfsRpFkeP0z-Wzl9zDZDkL9j24YJcAbbIKOyzSZn0c7W_bOBKbe4UcZr5w2fw6"
        style={styles.mapImage}
        contentFit="cover"
        accessible={true}
        accessibilityLabel="Indonesian city map detailing live secondhand smoke air quality index zones."
      />
      <View style={styles.mapOverlay} />

      {/* Floating Map Indicators (Simulating live heatmap zones) */}
      
      {/* Sedang (Moderate - Yellow) */}
      <View 
        style={[styles.heatmapCircle, { top: 220, left: 40, backgroundColor: colors.heatmapModerate + '33', borderColor: colors.heatmapModerate }]}
        accessible={true}
        accessibilityLabel="Moderate secondhand smoke hazard zone."
      >
        <Icon name="warning" size={32} color={colors.tertiary} />
        <View style={[styles.badge, { backgroundColor: colors.backgroundElement }]}>
          <Text style={[styles.badgeText, { color: colors.tertiary }]}>Sedang</Text>
        </View>
      </View>

      {/* Bahaya (Dense - Red) */}
      <View 
        style={[styles.heatmapCircle, { top: 430, left: 160, backgroundColor: colors.heatmapDense + '33', borderColor: colors.heatmapDense }]}
        accessible={true}
        accessibilityLabel="Danger secondhand smoke hazard zone."
      >
        <Icon name="report-problem" size={32} color={colors.danger} />
        <View style={[styles.badge, { backgroundColor: colors.backgroundElement }]}>
          <Text style={[styles.badgeText, { color: colors.danger }]}>Bahaya</Text>
        </View>
      </View>

      {/* Ekstrim (Extreme - Black/Inverse) */}
      <View 
        style={[styles.heatmapCircle, { top: 300, right: 30, backgroundColor: 'rgba(28,31,22,0.4)', borderColor: colors.text }]}
        accessible={true}
        accessibilityLabel="Extreme secondhand smoke hazard zone."
      >
        <Icon name="block" size={32} color="#ffffff" />
        <View style={[styles.badge, { backgroundColor: colors.text }]}>
          <Text style={[styles.badgeText, { color: colors.background }]}>Ekstrim</Text>
        </View>
      </View>

      {/* Floating Header UI */}
      <View style={styles.floatingHeader}>
        {/* Glassmorphic Search Bar */}
        <View style={[styles.searchBar, { backgroundColor: activeScheme === 'dark' ? 'rgba(27,31,22,0.8)' : 'rgba(255,255,255,0.8)', borderColor: colors.border }]}>
          <Icon name="search" size={20} themeColor="primary" />
          <TextInput
            placeholder={location ? `Near ${location.coords.latitude.toFixed(4)}, ${location.coords.longitude.toFixed(4)}` : "Search location"}
            placeholderTextColor={colors.textSecondary}
            style={[styles.searchInput, { color: colors.text }]}
            accessibilityRole="search"
            accessibilityLabel="Search locations input field"
            editable={false} // Readonly display in prototype
          />
        </View>

        {/* Profile / Settings Button (Triggers supabase connection test) */}
        <Pressable
          onPress={handleProfilePress}
          style={({ pressed }) => [
            styles.profileButton,
            { borderColor: colors.secondary },
            pressed && { transform: [{ scale: 0.95 }] },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Open settings and connection test diagnostics screen"
        >
          <View style={[styles.profileInner, { backgroundColor: colors.backgroundElement }]}>
            <Icon name="person" size={24} themeColor="textSecondary" />
          </View>
        </Pressable>
      </View>

      {/* Primary reporting FAB */}
      <Pressable
        onPress={handleFABPress}
        style={({ pressed }) => [
          styles.fab,
          { backgroundColor: colors.primary },
          pressed && { transform: [{ scale: 0.95 }] },
        ]}
        accessibilityRole="button"
        accessibilityLabel="Report current location as smoke-free"
      >
        <Icon name="air" size={28} color="#ffffff" />
      </Pressable>

      {/* Report confirmation modal */}
      <ReportConfirmModal
        visible={showReportConfirm}
        onCancel={reporting ? () => {} : () => setShowReportConfirm(false)}
        onConfirm={handleConfirmReport}
        loading={reporting}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
  },
  mapImage: {
    ...StyleSheet.absoluteFillObject,
  },
  mapOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(250,250,247,0.1)',
  },
  floatingHeader: {
    position: 'absolute',
    top: 50,
    left: Spacing.four,
    right: Spacing.four,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  searchBar: {
    flex: 1,
    height: 48,
    borderRadius: Radius.full,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    gap: Spacing.two,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 4,
  },
  searchInput: {
    flex: 1,
    height: '100%',
    fontFamily: Fonts.sans,
    fontSize: Typography.body.fontSize,
  },
  profileButton: {
    width: 44,
    height: 44,
    borderRadius: Radius.full,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileInner: {
    width: '100%',
    height: '100%',
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heatmapCircle: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: Radius.full,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    bottom: 24,
    paddingHorizontal: Spacing.two,
    paddingVertical: 2,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontFamily: Fonts.sans,
    fontSize: Typography.caption.fontSize,
    fontWeight: '700',
  },
  fab: {
    position: 'absolute',
    bottom: 40,
    left: '50%',
    marginLeft: -32, // w-64 is 64 width, so offset is half (32) to align center
    width: 64,
    height: 64,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 8,
  },
});
