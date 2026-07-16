<<<<<<< HEAD
import * as Device from 'expo-device';
import { Platform, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link } from 'expo-router';

import { AnimatedIcon } from '@/components/animated-icon';
import { HintRow } from '@/components/hint-row';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { WebBadge } from '@/components/web-badge';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';

function getDevMenuHint() {
  if (Platform.OS === 'web') {
    return <ThemedText type="small">use browser devtools</ThemedText>;
  }
  if (Device.isDevice) {
    return (
      <ThemedText type="small">
        shake device or press <ThemedText type="code">m</ThemedText> in terminal
      </ThemedText>
    );
  }
  const shortcut = Platform.OS === 'android' ? 'cmd+m (or ctrl+m)' : 'cmd+d';
  return (
    <ThemedText type="small">
      press <ThemedText type="code">{shortcut}</ThemedText>
    </ThemedText>
  );
}

export default function HomeScreen() {
  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedView style={styles.heroSection}>
          <AnimatedIcon />
          <ThemedText type="title" style={styles.title}>
            Welcome to&nbsp;Expo
          </ThemedText>
        </ThemedView>

        <ThemedText type="code" style={styles.code}>
          get started
        </ThemedText>

        <ThemedView type="backgroundElement" style={styles.stepContainer}>
          <HintRow
            title="Try editing"
            hint={<ThemedText type="code">src/app/index.tsx</ThemedText>}
          />
          <HintRow title="Dev tools" hint={getDevMenuHint()} />
          <HintRow
            title="Fresh start"
            hint={<ThemedText type="code">npm run reset-project</ThemedText>}
          />
        </ThemedView>

        <Link href="/supabase-test" asChild>
          <Pressable style={styles.testLinkButton}>
            <ThemedText type="smallBold" style={styles.testLinkText}>
              ⚙️ Test Supabase Connection
            </ThemedText>
          </Pressable>
        </Link>

        {Platform.OS === 'web' && <WebBadge />}
      </SafeAreaView>
    </ThemedView>
=======
import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TextInput, Pressable, useColorScheme, Platform, Alert } from 'react-native';
import { Image } from 'expo-image';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import * as Location from 'expo-location';
import { Colors, Radius, Spacing, Typography, Fonts } from '@/constants/theme';
import { OnboardingOverlay } from '@/components/layout/OnboardingOverlay';
import { ReportConfirmModal } from '@/components/layout/ReportConfirmModal';
import { Icon } from '@/components/ui/Icon';
import { useAppStore } from '@/store/useAppStore';

const ONBOARDING_STORAGE_KEY = 'KABUT_ONBOARDING_COMPLETED';
const JAKARTA_CENTER = { latitude: -6.2088, longitude: 106.8456 };

export default function HomeScreen() {
  const scheme = useColorScheme();
  const activeScheme = scheme === 'dark' ? 'dark' : 'light';
  const colors = Colors[activeScheme];

  const {
    isOnboarded,
    setIsOnboarded,
    observations,
    fetchObservations,
    location,
    setLocation,
    locationError,
    setLocationError,
  } = useAppStore();

  const [showReportConfirm, setShowReportConfirm] = useState(false);
  const [reporting, setReporting] = useState(false);

  // Load onboarding state from storage
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
  }, [setIsOnboarded]);

  // Request location updates
  const requestLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationError('Location permission denied');
        return;
      }
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setLocation(loc);
      setLocationError(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setLocationError(msg);
      console.warn('Failed to fetch location:', msg);
    }
  };

  // Fetch observations and location upon onboarding completion
  useEffect(() => {
    if (isOnboarded) {
      fetchObservations();
      requestLocation();
    }
  }, [isOnboarded]);

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

  // Interaction 1: Observe FAB Confirmation Modal (closes modal, nothing else)
  const handleConfirmReport = () => {
    setReporting(true);
    setTimeout(() => {
      setReporting(false);
      setShowReportConfirm(false);
      if (Platform.OS === 'web') {
        alert('Confirmed: Observe Modal closed.');
      } else {
        Alert.alert('Confirmed', 'Observation Intent Registered.');
      }
    }, 800);
  };

  const handleProfilePress = () => {
    router.push('/supabase-test');
  };

  // Helper projection to map GPS coordinates to screen pixel offsets
  const getCoordinateOffset = (lat: number, lng: number) => {
    // Map center is at x=180, y=300
    const y = 300 - (lat - JAKARTA_CENTER.latitude) * 3500;
    const x = 180 + (lng - JAKARTA_CENTER.longitude) * 3500;
    return { x, y };
  };

  // 1. Render Onboarding slider overlays if not yet complete
  if (!isOnboarded) {
    return <OnboardingOverlay onComplete={handleOnboardingComplete} />;
  }

  // 2. Render Main Map dashboard view once onboarded
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

      {/* Render live reported smoke-free observations dynamically */}
      {observations.map((obs, idx) => {
        const pos = getCoordinateOffset(obs.latitude, obs.longitude);
        // Bounds checking
        if (pos.x < 0 || pos.x > 380 || pos.y < 50 || pos.y > 600) return null;
        
        return (
          <View
            key={obs.id || idx}
            style={[
              styles.heatmapCircle,
              { 
                top: pos.y - 75,
                left: pos.x - 75,
                backgroundColor: colors.heatmapLight + '33',
                borderColor: colors.heatmapLight
              }
            ]}
            accessible={true}
            accessibilityLabel="Geolocated smoke-free reported zone."
          >
            <Icon name="check" size={32} color={colors.primary} />
            <View style={[styles.badge, { backgroundColor: colors.backgroundElement }]}>
              <Text style={[styles.badgeText, { color: colors.primary }]}>Bebas Asap</Text>
            </View>
          </View>
        );
      })}

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
            editable={false}
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
            <Icon name="campaign" size={24} themeColor="textSecondary" />
          </View>
        </Pressable>
      </View>

      {/* Floating GPS Button */}
      <Pressable
        onPress={requestLocation}
        style={({ pressed }) => [
          styles.gpsButton,
          { backgroundColor: colors.backgroundElement, borderColor: colors.border },
          pressed && { opacity: 0.7 }
        ]}
        accessibilityRole="button"
        accessibilityLabel="Refresh current GPS location"
      >
        <Icon name="my-location" size={24} themeColor="text" />
      </Pressable>

      {/* Observe Button (FAB) (Interaction 1 - Confirmation Modal) */}
      <Pressable
        onPress={handleFABPress}
        style={({ pressed }) => [
          styles.fab,
          { backgroundColor: colors.primary },
          pressed && { transform: [{ scale: 0.95 }] },
        ]}
        accessibilityRole="button"
        accessibilityLabel="Confirm observe action dialog"
      >
        <Icon name="warning" size={28} color="#ffffff" />
      </Pressable>

      {/* Bottom Navigation Bar */}
      <View style={[styles.bottomNav, { backgroundColor: colors.backgroundElement, borderTopColor: colors.border }]}>
        {/* Home Tab */}
        <Pressable 
          style={styles.navItem} 
          accessibilityRole="button" 
          accessibilityLabel="Home Map screen active"
        >
          <Icon name="home" size={24} color={colors.primary} />
        </Pressable>

        {/* Center Floating Air Button (Interaction 2 - scan flow) */}
        <Pressable
          onPress={() => router.push('/air')}
          style={({ pressed }) => [
            styles.navItem,
            pressed && { transform: [{ scale: 0.96 }] }
          ]}
          accessibilityRole="button"
          accessibilityLabel="Open Air report observation scanner"
        >
          <Icon name="air" size={24} color={colors.textSecondary} />
        </Pressable>

        {/* Database Test Tab */}
        <Pressable
          onPress={handleProfilePress}
          style={({ pressed }) => [
            styles.navItem,
            pressed && { opacity: 0.7 }
          ]}
          accessibilityRole="button"
          accessibilityLabel="Database connection diagnostics screen"
        >
          <Icon name="person" size={24} color={colors.textSecondary} />
        </Pressable>
      </View>

      {/* Observe confirmation modal */}
      <ReportConfirmModal
        visible={showReportConfirm}
        onCancel={reporting ? () => {} : () => setShowReportConfirm(false)}
        onConfirm={handleConfirmReport}
        loading={reporting}
      />
    </View>
>>>>>>> 2adb8929331c0ac5a7eae9b2e21552dbed5215b8
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
<<<<<<< HEAD
    justifyContent: 'center',
    flexDirection: 'row',
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    alignItems: 'center',
    gap: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.three,
    maxWidth: MaxContentWidth,
  },
  heroSection: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    paddingHorizontal: Spacing.four,
    gap: Spacing.four,
  },
  title: {
    textAlign: 'center',
  },
  code: {
    textTransform: 'uppercase',
  },
  stepContainer: {
    gap: Spacing.three,
    alignSelf: 'stretch',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.four,
    borderRadius: Spacing.four,
  },
  testLinkButton: {
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#208AEF',
    paddingVertical: Spacing.two,
    borderRadius: Spacing.three,
    marginTop: Spacing.two,
    minHeight: 44,
  },
  testLinkText: {
    color: '#ffffff',
=======
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
    zIndex: 20,
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
  gpsButton: {
    position: 'absolute',
    right: Spacing.four,
    bottom: 110,
    width: 48,
    height: 48,
    borderRadius: Radius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    zIndex: 10,
  },
  fab: {
    position: 'absolute',
    bottom: 110,
    left: '50%',
    marginLeft: -32,
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
    zIndex: 10,
  },
  bottomNav: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 72,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    borderTopWidth: 1,
    paddingBottom: Spacing.two,
    zIndex: 10,
  },
  navItem: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    height: '100%',
>>>>>>> 2adb8929331c0ac5a7eae9b2e21552dbed5215b8
  },
});
