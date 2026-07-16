import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Text, TextInput, Pressable, useColorScheme, Platform, Alert, Dimensions, ScrollView, Keyboard } from 'react-native';
import { Image } from 'expo-image';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import * as Location from 'expo-location';
import { Colors, Radius, Spacing, Typography, Fonts } from '@/constants/theme';
import { OnboardingOverlay } from '@/components/layout/OnboardingOverlay';
import { ReportConfirmModal } from '@/components/layout/ReportConfirmModal';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { useAppStore } from '@/store/useAppStore';

// Conditional import of react-native-maps for native platforms
let MapView: any = null;
let MapCircle: any = null;
if (Platform.OS !== 'web') {
  try {
    const Maps = require('react-native-maps');
    MapView = Maps.default;
    MapCircle = Maps.Circle;
  } catch (err) {
    console.warn('Failed to load react-native-maps:', err);
  }
}

const ONBOARDING_STORAGE_KEY = 'KABUT_ONBOARDING_COMPLETED';
const JAKARTA_CENTER = { latitude: -6.2088, longitude: 106.8456 };

const MOCK_LOCATIONS = [
  { name: 'Jakarta Central', latitude: -6.2088, longitude: 106.8456 },
  { name: 'Sudirman Business District', latitude: -6.2196, longitude: 106.8166 },
  { name: 'Kemang Entertainment Area', latitude: -6.2736, longitude: 106.8206 },
  { name: 'Kuningan Office Complex', latitude: -6.2244, longitude: 106.8294 },
  { name: 'Menteng Residential Park', latitude: -6.2012, longitude: 106.8322 },
  { name: 'Senayan Sports Plaza', latitude: -6.2225, longitude: 106.7997 }
];

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
    setLocationError,
  } = useAppStore();

  const mapRef = useRef<any>(null);
  const searchInputRef = useRef<TextInput>(null);

  const [showReportConfirm, setShowReportConfirm] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [showEmptyState, setShowEmptyState] = useState(true);
  const [showLegend, setShowLegend] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [mapRegion, setMapRegion] = useState({
    latitude: JAKARTA_CENTER.latitude,
    longitude: JAKARTA_CENTER.longitude,
    latitudeDelta: 0.015,
    longitudeDelta: 0.015,
  });

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

      // Pan map camera to user location
      const region = {
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        latitudeDelta: 0.012,
        longitudeDelta: 0.012,
      };
      setMapRegion(region);
      if (Platform.OS !== 'web' && mapRef.current) {
        mapRef.current.animateToRegion(region, 1000);
      }
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

  // Helper projection to map GPS coordinates to screen pixel offsets for Web mockup map
  const getCoordinateOffset = (lat: number, lng: number) => {
    const y = 300 - (lat - mapRegion.latitude) * 3500;
    const x = 180 + (lng - mapRegion.longitude) * 3500;
    return { x, y };
  };

  // Group Supabase observations into 20x20m grid cells for the heatmap layer
  // Updated with new thresholds: Light: 3, Moderate: 7, Elevated: 10, Dense: 15+
  const getHeatmapCells = () => {
    const now = new Date().getTime();
    const activeObs = observations.filter(obs => {
      const ageMs = now - new Date(obs.created_at).getTime();
      return ageMs < 60 * 60 * 1000; // 60 minutes time-decay
    });

    const cells: { [key: string]: { lat: number; lng: number; count: number } } = {};
    activeObs.forEach(obs => {
      const cellLat = Math.round(obs.latitude / 0.0002) * 0.0002;
      const cellLng = Math.round(obs.longitude / 0.0002) * 0.0002;
      const key = `${cellLat.toFixed(5)},${cellLng.toFixed(5)}`;
      if (!cells[key]) {
        cells[key] = { lat: cellLat, lng: cellLng, count: 0 };
      }
      cells[key].count += 1;
    });

    return Object.values(cells)
      .filter(cell => cell.count >= 3) // Only render if count >= 3 (Light threshold)
      .map(cell => {
        let color: string = colors.heatmapLight;
        let label = 'Light';
        
        if (cell.count >= 15) {
          color = colors.heatmapDense;
          label = 'Dense';
        } else if (cell.count >= 10) {
          color = colors.heatmapElevated;
          label = 'Elevated';
        } else if (cell.count >= 7) {
          color = colors.heatmapModerate;
          label = 'Moderate';
        }
        
        return {
          latitude: cell.lat,
          longitude: cell.lng,
          color,
          count: cell.count,
          label,
        };
      });
  };

  const activeCells = getHeatmapCells();

  const handleSearchSelect = (loc: typeof MOCK_LOCATIONS[0]) => {
    setSearchQuery(loc.name);
    setIsSearching(false);
    Keyboard.dismiss();
    
    const targetRegion = {
      latitude: loc.latitude,
      longitude: loc.longitude,
      latitudeDelta: 0.012,
      longitudeDelta: 0.012,
    };
    setMapRegion(targetRegion);

    if (Platform.OS !== 'web' && mapRef.current) {
      mapRef.current.animateToRegion(targetRegion, 1000);
    }
  };

  const filteredResults = searchQuery.length === 0
    ? MOCK_LOCATIONS.slice(0, 3)
    : MOCK_LOCATIONS.filter(l => l.name.toLowerCase().includes(searchQuery.toLowerCase()));

  // 1. Render Onboarding slider overlays if not yet complete
  if (!isOnboarded) {
    return <OnboardingOverlay onComplete={handleOnboardingComplete} />;
  }

  // 2. Render Main Map dashboard view once onboarded
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      
      {/* Interactive Map Layout */}
      {Platform.OS !== 'web' && MapView ? (
        <MapView
          ref={mapRef}
          style={StyleSheet.absoluteFillObject}
          initialRegion={mapRegion}
          showsUserLocation={true}
          showsMyLocationButton={false}
          onRegionChangeComplete={(r: any) => setMapRegion(r)}
        >
          {/* Heatmap Grid Layer Circles */}
          {activeCells.map((cell, idx) => (
            <MapCircle
              key={idx}
              center={{ latitude: cell.latitude, longitude: cell.longitude }}
              radius={15}
              fillColor={cell.color + '44'}
              strokeColor={cell.color}
              strokeWidth={2}
            />
          ))}
        </MapView>
      ) : (
        // Web Platform Fallback stylized map
        <View style={StyleSheet.absoluteFillObject}>
          <Image
            source="https://lh3.googleusercontent.com/aida-public/AB6AXuDUR3fVXmY8YxF-SaNI3wjHICuOE80xxqNE1I33BZDhMPUj8ueMvZ9eX1b26kpfXhVZAQpJ0pN63hNW1Ase4PQ4V_sEI23lv0wNyCCnw0XZ_L-hxX-TgDGtYr1rfJvWx1q7U8WMPZTZZBv2b0W4o6U_hMGxNfvl5--hwb2FJIHwefw1WuRrnipVGTavuCwkAoz8ViA87lUTLOrLQ9BfsRpFkeP0z-Wzl9zDZDkL9j24YJcAbbIKOyzSZn0c7W_bOBKbe4UcZr5w2fw6"
            style={styles.mapImage}
            contentFit="cover"
            accessible={true}
            accessibilityLabel="Jakarta city map detailing live secondhand smoke air quality index zones."
          />
          <View style={styles.mapOverlay} />
          
          {/* Render Web Heatmap overlay items using offsets */}
          {activeCells.map((cell, idx) => {
            const pos = getCoordinateOffset(cell.latitude, cell.longitude);
            if (pos.x < 0 || pos.x > 380 || pos.y < 50 || pos.y > 600) return null;
            return (
              <View
                key={idx}
                style={[
                  styles.heatmapCircle,
                  {
                    top: pos.y - 75,
                    left: pos.x - 75,
                    backgroundColor: cell.color + '33',
                    borderColor: cell.color,
                  }
                ]}
              >
                <Icon name="air" size={32} color={cell.color} />
                <View style={[styles.badge, { backgroundColor: colors.backgroundElement }]}>
                  <Text style={[styles.badgeText, { color: cell.color }]}>{cell.label}</Text>
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* Floating Header UI — Search occupies full available width (side button removed) */}
      <View style={styles.floatingHeader}>
        {/* Glassmorphic Search Bar Input Trigger */}
        <Pressable
          onPress={() => setIsSearching(true)}
          style={[styles.searchBar, { backgroundColor: activeScheme === 'dark' ? 'rgba(27,31,22,0.8)' : 'rgba(255,255,255,0.8)', borderColor: colors.border }]}
        >
          <Icon name="search" size={20} themeColor="primary" />
          <Text style={[styles.searchPlaceholder, { color: colors.textSecondary }]}>
            {searchQuery || "Search location..."}
          </Text>
        </Pressable>
      </View>

      {/* Empty State Card Overlay */}
      {activeCells.length === 0 && showEmptyState && (
        <View style={[styles.emptyStateCard, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}>
          <Icon name="check-circle" size={24} color={colors.primary} />
          <View style={styles.emptyStateTextWrapper}>
            <Text style={[styles.emptyStateTitle, { color: colors.text }]}>No reports nearby</Text>
            <Text style={[styles.emptyStateDesc, { color: colors.textSecondary }]}>Air looks clear.</Text>
          </View>
          <Pressable onPress={() => setShowEmptyState(false)} style={styles.emptyStateClose}>
            <Icon name="close" size={16} themeColor="textSecondary" />
          </Pressable>
        </View>
      )}

      {/* FLOATING ACTION CONTROLS */}

      {/* Left: Guide / Book Open style outline icon (Communicates Legend / Guide / Info) */}
      <Pressable
        onPress={() => setShowLegend(true)}
        style={({ pressed }) => [
          styles.legendButton,
          { backgroundColor: activeScheme === 'dark' ? 'rgba(27,31,22,0.8)' : 'rgba(255,255,255,0.8)', borderColor: colors.border },
          pressed && { opacity: 0.7 }
        ]}
        accessibilityRole="button"
        accessibilityLabel="Show heatmap legend details"
      >
        <Icon name="legend-guide" size={20} themeColor="text" />
      </Pressable>

      {/* Center: Primary Air FAB scan button — Size increased by 15-20% to 76px */}
      <Pressable
        onPress={() => router.push('/air')}
        style={({ pressed }) => [
          styles.airFab,
          { backgroundColor: colors.primary, borderColor: colors.backgroundElement },
          pressed && { transform: [{ scale: 0.95 }] }
        ]}
        accessibilityRole="button"
        accessibilityLabel="Open smoke scan scanner"
      >
        <Icon name="air" size={32} color="#ffffff" />
      </Pressable>

      {/* Right: GPS locate button */}
      <Pressable
        onPress={requestLocation}
        style={({ pressed }) => [
          styles.gpsButton,
          { backgroundColor: colors.backgroundElement, borderColor: colors.border },
          pressed && { opacity: 0.7 }
        ]}
        accessibilityRole="button"
        accessibilityLabel="Locate user location"
      >
        <Icon name="my-location" size={24} themeColor="text" />
      </Pressable>

      {/* Right-Above: Observe FAB (Interaction 1 - Confirmation Modal) */}
      <Pressable
        onPress={() => setShowReportConfirm(true)}
        style={({ pressed }) => [
          styles.observeFab,
          { backgroundColor: colors.primary },
          pressed && { transform: [{ scale: 0.95 }] },
        ]}
        accessibilityRole="button"
        accessibilityLabel="Open observe smoke confirmation"
      >
        <Icon name="warning" size={24} color="#ffffff" />
      </Pressable>

      {/* Full-Screen Search View Overlay */}
      {isSearching && (
        <View style={[styles.searchOverlay, { backgroundColor: colors.background }]}>
          <View style={styles.searchHeader}>
            <Pressable 
              onPress={() => setIsSearching(false)}
              style={styles.backButton}
            >
              <Icon name="arrow-back" size={24} themeColor="text" />
            </Pressable>
            <View style={[styles.searchBarActive, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}>
              <Icon name="search" size={20} themeColor="primary" />
              <TextInput
                ref={searchInputRef}
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search location..."
                placeholderTextColor={colors.textSecondary}
                style={[styles.searchInputActive, { color: colors.text }]}
                autoFocus={true}
              />
              {searchQuery.length > 0 && (
                <Pressable onPress={() => setSearchQuery('')}>
                  <Icon name="close" size={20} themeColor="textSecondary" />
                </Pressable>
              )}
            </View>
          </View>

          <ScrollView style={styles.searchResultsContainer}>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
              {searchQuery.length === 0 ? 'Recent searches' : 'Search results'}
            </Text>
            {filteredResults.length === 0 ? (
              <View style={styles.noResultsContainer}>
                <Text style={[styles.noResultsText, { color: colors.textSecondary }]}>No location found</Text>
              </View>
            ) : (
              filteredResults.map((loc, idx) => (
                <Pressable
                  key={idx}
                  onPress={() => handleSearchSelect(loc)}
                  style={[styles.searchResultRow, { borderBottomColor: colors.border }]}
                >
                  <Icon name="map-pin" size={20} themeColor="textSecondary" />
                  <Text style={[styles.searchResultText, { color: colors.text }]}>{loc.name}</Text>
                </Pressable>
              ))
            )}
          </ScrollView>
        </View>
      )}

      {/* Legend Modal Dialog */}
      {showLegend && (
        <View style={styles.legendBackdrop}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setShowLegend(false)} />
          <View style={[styles.legendCard, { backgroundColor: colors.backgroundElement }]}>
            <Text style={[styles.legendTitle, { color: colors.text }]}>Map legend</Text>
            
            <View style={styles.legendSwatches}>
              <View style={styles.legendSwatchRow}>
                <View style={[styles.swatch, { backgroundColor: '#E4E5DE' }]} />
                <Text style={[styles.legendLabel, { color: colors.text }]}>Clean (no observations)</Text>
              </View>
              <View style={styles.legendSwatchRow}>
                <View style={[styles.swatch, { backgroundColor: colors.heatmapLight }]} />
                <Text style={[styles.legendLabel, { color: colors.text }]}>Light (3 observations)</Text>
              </View>
              <View style={styles.legendSwatchRow}>
                <View style={[styles.swatch, { backgroundColor: colors.heatmapModerate }]} />
                <Text style={[styles.legendLabel, { color: colors.text }]}>Moderate (7 observations)</Text>
              </View>
              <View style={styles.legendSwatchRow}>
                <View style={[styles.swatch, { backgroundColor: colors.heatmapElevated }]} />
                <Text style={[styles.legendLabel, { color: colors.text }]}>Elevated (10 observations)</Text>
              </View>
              <View style={styles.legendSwatchRow}>
                <View style={[styles.swatch, { backgroundColor: colors.heatmapDense }]} />
                <Text style={[styles.legendLabel, { color: colors.text }]}>Dense (15+ observations)</Text>
              </View>
            </View>

            <Text style={[styles.legendDesc, { color: colors.textSecondary }]}>
              Observations expire automatically within 60 minutes, so the map always reflects current conditions.
            </Text>

            <Button
              label="Close"
              onPress={() => setShowLegend(false)}
              variant="filled"
              style={{ borderRadius: Radius.full, marginTop: Spacing.four }}
            />
          </View>
        </View>
      )}

      {/* Observe confirmation modal */}
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
  searchPlaceholder: {
    fontFamily: Fonts.sans,
    fontSize: Typography.body.fontSize,
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
  emptyStateCard: {
    position: 'absolute',
    top: 120,
    left: Spacing.four,
    right: Spacing.four,
    borderRadius: Radius.md,
    borderWidth: 1,
    padding: Spacing.four,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
    zIndex: 15,
  },
  emptyStateTextWrapper: {
    flex: 1,
    marginLeft: Spacing.three,
  },
  emptyStateTitle: {
    fontFamily: Fonts.sans,
    fontSize: Typography.body.fontSize,
    fontWeight: '700',
  },
  emptyStateDesc: {
    fontFamily: Fonts.sans,
    fontSize: Typography.caption.fontSize,
  },
  emptyStateClose: {
    padding: Spacing.one,
  },
  legendButton: {
    position: 'absolute',
    left: Spacing.four,
    bottom: 28,
    width: 40,
    height: 40,
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
  airFab: {
    position: 'absolute',
    bottom: 28,
    left: '50%',
    marginLeft: -38,
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 8,
    zIndex: 10,
  },
  gpsButton: {
    position: 'absolute',
    right: Spacing.four,
    bottom: 28,
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
  observeFab: {
    position: 'absolute',
    right: Spacing.four,
    bottom: 92,
    width: 48,
    height: 48,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 4,
    zIndex: 10,
  },
  searchOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
    paddingTop: 50,
    paddingHorizontal: Spacing.four,
  },
  searchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    marginBottom: Spacing.four,
  },
  backButton: {
    padding: Spacing.two,
  },
  searchBarActive: {
    flex: 1,
    height: 48,
    borderRadius: Radius.full,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    gap: Spacing.two,
  },
  searchInputActive: {
    flex: 1,
    height: '100%',
    fontFamily: Fonts.sans,
    fontSize: Typography.bodyLg.fontSize,
  },
  searchResultsContainer: {
    flex: 1,
  },
  sectionTitle: {
    fontFamily: Fonts.sans,
    fontSize: Typography.caption.fontSize,
    fontWeight: '700',
    marginBottom: Spacing.three,
    textTransform: 'uppercase',
  },
  searchResultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.four,
    borderBottomWidth: 1,
    gap: Spacing.three,
  },
  searchResultText: {
    fontFamily: Fonts.sans,
    fontSize: Typography.bodyLg.fontSize,
  },
  noResultsContainer: {
    paddingVertical: Spacing.eight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noResultsText: {
    fontFamily: Fonts.sans,
    fontSize: Typography.body.fontSize,
  },
  legendBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(28,31,22,0.4)',
    zIndex: 110,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
  },
  legendCard: {
    width: 320,
    borderRadius: Radius.md,
    padding: Spacing.five,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 8,
  },
  legendTitle: {
    fontFamily: Fonts.sans,
    fontSize: Typography.h2.fontSize,
    fontWeight: Typography.h2.fontWeight,
    marginBottom: Spacing.four,
    textAlign: 'center',
  },
  legendSwatches: {
    gap: Spacing.three,
    marginBottom: Spacing.four,
  },
  legendSwatchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  swatch: {
    width: 24,
    height: 24,
    borderRadius: Radius.xs,
  },
  legendLabel: {
    fontFamily: Fonts.sans,
    fontSize: Typography.body.fontSize,
  },
  legendDesc: {
    fontFamily: Fonts.sans,
    fontSize: Typography.caption.fontSize,
    lineHeight: Typography.body.lineHeight,
    textAlign: 'center',
  },
});
