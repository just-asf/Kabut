import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Text, TextInput, Pressable, useColorScheme, Platform, Alert, Dimensions, ScrollView, Keyboard, ActivityIndicator } from 'react-native';
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MapView, MapCircle, MapMarker } from '@/components/MapComponent';
import { getGridId } from '@/lib/grid';
import { supabase } from '@/lib/supabase';
import { HEATMAP_RADIUS_METERS } from '@/config/heatmap';
import { shouldShowCircle, getSeverityInfo, getResolvedSeverityLevels } from '@/utils/heatmap';
import { SeverityBadge } from '@/components/SeverityBadge';

const ONBOARDING_STORAGE_KEY = 'onboarding_completed';
const JAKARTA_CENTER = { latitude: -6.2088, longitude: 106.8456 };

type UiOverlayState = 'ZOOMED_OUT' | 'LOADING' | 'ERROR' | 'EMPTY' | 'HIDDEN';

interface SearchPlace {
  name: string;
  latitude: number;
  longitude: number;
  aliases: string[];
  type: 'landmark' | 'mall' | 'station' | 'university' | 'hospital' | 'park' | 'region';
}

// Landmark database for fuzzy matching and abbreviation parsing (Task 1)
const LANDMARK_DATABASE: SearchPlace[] = [
  {
    name: 'Gelora Bung Karno (GBK)',
    latitude: -6.2183,
    longitude: 106.8025,
    aliases: ['gbk', 'gelora bung karno', 'stadion gbk', 'senayan', 'sports complex'],
    type: 'landmark'
  },
  {
    name: 'Monumen Nasional (Monas)',
    latitude: -6.1754,
    longitude: 106.8272,
    aliases: ['monas', 'monumen nasional', 'jakarta pusat', 'national monument'],
    type: 'landmark'
  },
  {
    name: 'Universitas Indonesia (UI)',
    latitude: -6.3606,
    longitude: 106.8272,
    aliases: ['ui', 'universitas indonesia', 'depok', 'kampus ui'],
    type: 'university'
  },
  {
    name: 'Gandaria City (Gancit)',
    latitude: -6.2442,
    longitude: 106.7835,
    aliases: ['gancit', 'gandaria city', 'mall gancit', 'gandaria'],
    type: 'mall'
  },
  {
    name: 'Central Park Mall (CP)',
    latitude: -6.1774,
    longitude: 106.7907,
    aliases: ['cp', 'central park', 'grogol', 'mall cp', 's-parman'],
    type: 'mall'
  },
  {
    name: 'Taman Impian Jaya Ancol',
    latitude: -6.1256,
    longitude: 106.8436,
    aliases: ['ancol', 'taman impian jaya ancol', 'dufan', 'pantai ancol'],
    type: 'park'
  },
  {
    name: 'Kemang, Jakarta Selatan',
    latitude: -6.2736,
    longitude: 106.8206,
    aliases: ['kemang', 'jakarta selatan', 'kemang area', 'bangka'],
    type: 'region'
  },
  {
    name: 'Stasiun Gambir',
    latitude: -6.1767,
    longitude: 106.8306,
    aliases: ['gambir', 'stasiun gambir', 'gambir station'],
    type: 'station'
  },
  {
    name: 'Stasiun Sudirman',
    latitude: -6.2023,
    longitude: 106.8228,
    aliases: ['sudirman', 'stasiun sudirman', 'sudirman station', 'dukuh atas'],
    type: 'station'
  },
  {
    name: 'RSCM (Rumah Sakit Cipto Mangunkusumo)',
    latitude: -6.1979,
    longitude: 106.8483,
    aliases: ['rscm', 'cipto mangunkusumo', 'rumah sakit cipto', 'hospital'],
    type: 'hospital'
  },
  {
    name: 'Taman Suropati',
    latitude: -6.2008,
    longitude: 106.8326,
    aliases: ['suropati', 'taman suropati', 'menteng park'],
    type: 'park'
  },
  {
    name: 'Binus University',
    latitude: -6.2241,
    longitude: 106.7826,
    aliases: ['binus', 'bina nusantara', 'kampus binus', 'kemanggisan'],
    type: 'university'
  },
  {
    name: 'Siloam Hospitals Semanggi',
    latitude: -6.2243,
    longitude: 106.8188,
    aliases: ['siloam', 'siloam hospitals', 'semanggi hospital'],
    type: 'hospital'
  },
  {
    name: 'Grand Indonesia Mall',
    latitude: -6.1953,
    longitude: 106.8203,
    aliases: ['gi', 'grand indonesia', 'thamrin'],
    type: 'mall'
  },
  {
    name: 'Plaza Indonesia',
    latitude: -6.1932,
    longitude: 106.8217,
    aliases: ['pi', 'plaza indonesia'],
    type: 'mall'
  },
  {
    name: 'Kota Tua Jakarta',
    latitude: -6.1376,
    longitude: 106.8143,
    aliases: ['kota tua', 'fatahillah', 'old town'],
    type: 'landmark'
  }
];

const MOCK_LOCATIONS = [
  { name: 'Jakarta Central', latitude: -6.2088, longitude: 106.8456 },
  { name: 'Sudirman Business District', latitude: -6.2196, longitude: 106.8166 },
  { name: 'Kemang Entertainment Area', latitude: -6.2736, longitude: 106.8206 }
];

// Fuzzy matching engine scoring system (Task 1)
const matchSearchQuery = (query: string): SearchPlace[] => {
  const normalizedQuery = query.toLowerCase().trim();
  if (normalizedQuery.length < 2) return [];

  const matched = LANDMARK_DATABASE.map(place => {
    let bestScore = 0;

    // 1. Direct name match
    if (place.name.toLowerCase() === normalizedQuery) {
      bestScore = 1.0;
    } else if (place.name.toLowerCase().startsWith(normalizedQuery)) {
      bestScore = 0.9;
    } else if (place.name.toLowerCase().includes(normalizedQuery)) {
      bestScore = 0.7;
    }

    // 2. Alias match (abbreviations like "gbk", "cp", "gancit", "ui", etc.)
    place.aliases.forEach(alias => {
      if (alias === normalizedQuery) {
        bestScore = Math.max(bestScore, 1.0);
      } else if (alias.startsWith(normalizedQuery)) {
        bestScore = Math.max(bestScore, 0.8);
      } else if (alias.includes(normalizedQuery)) {
        bestScore = Math.max(bestScore, 0.6);
      }
    });

    // 3. Sequential substring check (fuzzy matching spelling tolerances)
    let queryIdx = 0;
    let matchCount = 0;
    const target = place.name.toLowerCase();
    for (let i = 0; i < target.length && queryIdx < normalizedQuery.length; i++) {
      if (target[i] === normalizedQuery[queryIdx]) {
        matchCount++;
        queryIdx++;
      }
    }
    if (matchCount === normalizedQuery.length && normalizedQuery.length >= 3) {
      bestScore = Math.max(bestScore, 0.5);
    }

    return { place, score: bestScore };
  });

  return matched
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(item => item.place);
};

export default function HomeScreen() {
  const scheme = useColorScheme();
  const activeScheme = scheme === 'dark' ? 'dark' : 'light';
  const colors = Colors[activeScheme];

  const insets = useSafeAreaInsets();
  const bottomOffset = insets.bottom + 16;
  const topOffset = insets.top + 8;

  const {
    isOnboarded,
    setIsOnboarded,
    observations,
    fetchObservations,
    location,
    setLocation,
    setLocationError,
    heatmapState,
  } = useAppStore();

  const mapRef = useRef<any>(null);
  const searchInputRef = useRef<TextInput>(null);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);
  const lastFetchedRegion = useRef<any>(null);

  const [showReportConfirm, setShowReportConfirm] = useState(false);
  const [selectedCell, setSelectedCell] = useState<any | null>(null);
  const [tracksViewChanges, setTracksViewChanges] = useState(true);
  const [activeNotification, setActiveNotification] = useState<UiOverlayState | null>(null);
  const prevHeatmapState = useRef<'IDLE' | 'LOADING' | 'SUCCESS' | 'ERROR'>('IDLE');
  const [isMapMoving, setIsMapMoving] = useState(false);
  const [showLegend, setShowLegend] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearchingResults, setIsSearchingResults] = useState(false);
  const [isLoadingOnboarding, setIsLoadingOnboarding] = useState(true);

  const [mapRegion, setMapRegion] = useState({
    latitude: JAKARTA_CENTER.latitude,
    longitude: JAKARTA_CENTER.longitude,
    latitudeDelta: 0.015,
    longitudeDelta: 0.015,
  });

  const isZoomedOut = mapRegion.latitudeDelta > 0.06;

  const requestHeatmapForRegion = (region: any, force: boolean = false) => {
    if (region.latitudeDelta > 0.06) {
      return; // Suspend fetching if zoomed out too far
    }

    if (lastFetchedRegion.current && !force) {
      const latDiff = Math.abs(region.latitude - lastFetchedRegion.current.latitude);
      const lngDiff = Math.abs(region.longitude - lastFetchedRegion.current.longitude);
      const latDeltaDiff = Math.abs(region.latitudeDelta - lastFetchedRegion.current.latitudeDelta);
      
      const thresholdLat = region.latitudeDelta * 0.3;
      const thresholdLng = region.longitudeDelta * 0.3;
      
      if (latDiff < thresholdLat && lngDiff < thresholdLng && latDeltaDiff < thresholdLat) {
        return; // Movement insignificant, skip request
      }
    }

    lastFetchedRegion.current = region;

    // Expand viewport bounds with 25% buffer
    const bufferLat = region.latitudeDelta * 0.25;
    const bufferLng = region.longitudeDelta * 0.25;
    
    const bounds = {
      minLat: region.latitude - (region.latitudeDelta / 2) - bufferLat,
      maxLat: region.latitude + (region.latitudeDelta / 2) + bufferLat,
      minLng: region.longitude - (region.longitudeDelta / 2) - bufferLng,
      maxLng: region.longitude + (region.longitudeDelta / 2) + bufferLng,
    };

    console.log(`[Viewport] Requesting buffered bounds`, bounds);
    fetchObservations(bounds);
  };

  // Load onboarding state from storage
  useEffect(() => {
    async function loadOnboardingState() {
      console.log('[6] AsyncStorage Read Started');
      try {
        const value = await AsyncStorage.getItem(ONBOARDING_STORAGE_KEY);
        console.log('[7] AsyncStorage Read Finished');
        if (value === 'true') {
          setIsOnboarded(true);
        }
        console.log('[8] Onboarding State Loaded');
      } catch (err) {
        console.error('Failed to load onboarding state:', err);
      } finally {
        setIsLoadingOnboarding(false);
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

  // Fetch observations upon onboarding completion
  useEffect(() => {
    if (isOnboarded) {
      requestHeatmapForRegion(mapRegion, true);
    }
  }, [isOnboarded]);

  // Subscribe to realtime updates on grid_status changes
  useEffect(() => {
    if (!isOnboarded) return;
    
    const channel = supabase
      .channel('grid-status-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'grid_status' },
        () => {
          console.log('Realtime grid_status update received, refetching...');
          requestHeatmapForRegion(mapRegion, true);
        }
      )
      .subscribe();
      
    return () => {
      supabase.removeChannel(channel);
    };
  }, [isOnboarded]);

  useEffect(() => {
    if (isOnboarded && !isLoadingOnboarding) {
      console.log('[16] Main Screen Rendered');
    }
  }, [isOnboarded, isLoadingOnboarding]);

  // Temporarily enable marker tracking on state updates to allow glyphs to paint, then disable to optimize performance
  useEffect(() => {
    setTracksViewChanges(true);
    const timer = setTimeout(() => {
      setTracksViewChanges(false);
    }, 2000);
    return () => clearTimeout(timer);
  }, [observations]);

  const handleOnboardingComplete = async () => {
    try {
      await AsyncStorage.setItem(ONBOARDING_STORAGE_KEY, 'true');
      setIsOnboarded(true);
    } catch (err) {
      console.error('Failed to save onboarding state:', err);
    }
  };

  // Debounced geocoding location search (Task 1 Fallback)
  useEffect(() => {
    if (searchQuery.trim().length <= 1) {
      setSearchResults([]);
      return;
    }

    const localResults = matchSearchQuery(searchQuery);

    // If we have local matches (e.g. abbreviations/landmarks like Monas, GBK, CP), display instantly
    if (localResults.length >= 3) {
      setSearchResults(localResults);
      return;
    }

    // Trigger geocoding to supplement search query results
    const delayDebounce = setTimeout(async () => {
      setIsSearchingResults(true);
      try {
        const coords = await Location.geocodeAsync(searchQuery);
        if (coords && coords.length > 0) {
          const apiResults = coords.slice(0, 3).map((coord, idx) => ({
            name: `${searchQuery} #${idx + 1}`,
            latitude: coord.latitude,
            longitude: coord.longitude,
          }));

          // Merge local and API results, removing duplicates
          const merged: any[] = [...localResults];
          apiResults.forEach(apiRes => {
            const exists = merged.some(
              localRes =>
                (Math.abs(localRes.latitude - apiRes.latitude) < 0.001 &&
                  Math.abs(localRes.longitude - apiRes.longitude) < 0.001)
            );
            if (!exists) {
              merged.push(apiRes);
            }
          });

          setSearchResults(merged);
        } else {
          setSearchResults(localResults);
        }
      } catch (err) {
        console.warn('Geocoding search failed:', err);
        setSearchResults(localResults);
      } finally {
        setIsSearchingResults(false);
      }
    }, 600);

    return () => clearTimeout(delayDebounce);
  }, [searchQuery]);



  // Helper projection to map GPS coordinates to screen pixel offsets for Web mockup map
  const getCoordinateOffset = (lat: number, lng: number) => {
    const y = 300 - (lat - mapRegion.latitude) * 3500;
    const x = 180 + (lng - mapRegion.longitude) * 3500;
    return { x, y };
  };

  // Render heatmap cells using server-side aggregated grid_status data
  // Color scale thresholds based on calculated grid score: Light: 3, Moderate: 7, Elevated: 10, Dense: 15+
  const getHeatmapCells = () => {
    const cellsList: any[] = [];
    
    // Calculate strict visible bounds (no buffer) to cull invisible cells
    const minLat = mapRegion.latitude - (mapRegion.latitudeDelta / 2);
    const maxLat = mapRegion.latitude + (mapRegion.latitudeDelta / 2);
    const minLng = mapRegion.longitude - (mapRegion.longitudeDelta / 2);
    const maxLng = mapRegion.longitude + (mapRegion.longitudeDelta / 2);

    observations.forEach(cell => {
      const score = cell.score ?? 0;
      const cleanVotes = cell.clean_votes ?? 0;
      
      if (!shouldShowCircle(score, cleanVotes)) {
        return;
      }

      if (isZoomedOut) {
        return; // Don't render cells if zoomed out
      }

      // Strict viewport culling
      if (
        cell.latitude_center < minLat || 
        cell.latitude_center > maxLat ||
        cell.longitude_center < minLng ||
        cell.longitude_center > maxLng
      ) {
        return;
      }
      
      const severity = getSeverityInfo(score, colors);
      
      cellsList.push({
        latitude: cell.latitude_center,
        longitude: cell.longitude_center,
        color: severity.color,
        count: score,
        reports: cell.active_reports ?? 0,
        cleanVotes: cleanVotes,
        label: severity.label,
        icon: severity.icon,
        severity,
      });
    });
    console.log('[14] Heatmap Compiled');
    return cellsList;
  };

  const activeCells = getHeatmapCells();

  const handleSearchSelect = (loc: any) => {
    setSearchQuery(loc.name);
    setIsSearching(false);
    Keyboard.dismiss();
    
    const targetRegion = {
      latitude: loc.latitude,
      longitude: loc.longitude,
      latitudeDelta: Math.min(mapRegion.latitudeDelta, 0.012),
      longitudeDelta: Math.min(mapRegion.longitudeDelta, 0.012),
    };
    setMapRegion(targetRegion);

    if (Platform.OS !== 'web' && mapRef.current) {
      mapRef.current.animateToRegion(targetRegion, 1000);
    }
  };

  const onRegionChange = () => {
    if (!isMapMoving) setIsMapMoving(true);
  };

  const onRegionChangeComplete = (region: any) => {
    setMapRegion(region);
    setIsMapMoving(false);

    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    debounceTimer.current = setTimeout(() => {
      requestHeatmapForRegion(region);
    }, 400);
  };

  // Pure State Transition Engine for Heatmap Network States
  useEffect(() => {
    if (heatmapState === prevHeatmapState.current) return;

    if (heatmapState === 'LOADING') {
      setActiveNotification('LOADING');
    } else if (heatmapState === 'ERROR') {
      setActiveNotification('ERROR');
    } else if (heatmapState === 'SUCCESS') {
      if (activeCells.length === 0 && !isZoomedOut) {
        if (prevHeatmapState.current !== 'SUCCESS') {
          setActiveNotification('EMPTY');
        }
      } else {
        setActiveNotification(null);
      }
    }

    prevHeatmapState.current = heatmapState;
  }, [heatmapState, isZoomedOut]); // Intentionally omitting activeCells

  // Viewport Lock for Zooming
  useEffect(() => {
    if (isZoomedOut) {
      setActiveNotification('ZOOMED_OUT');
    } else if (activeNotification === 'ZOOMED_OUT') {
      setActiveNotification(null);
    }
  }, [isZoomedOut]);

  const handleDismissOverlay = () => {
    setActiveNotification(null);
  };

  const shouldShowStateCard = !isMapMoving && activeNotification !== null;

  const getSearchResults = () => {
    if (Platform.OS === 'web') {
      return searchQuery.trim().length === 0
        ? MOCK_LOCATIONS
        : matchSearchQuery(searchQuery);
    }
    return searchQuery.trim().length === 0 ? MOCK_LOCATIONS : searchResults;
  };

  // 1. Render blank/spinner view while loading state from storage
  if (isLoadingOnboarding) {
    return <View style={{ flex: 1, backgroundColor: colors.background }} />;
  }

  // 2. Render Onboarding slider overlays if not yet complete
  if (!isOnboarded) {
    return <OnboardingOverlay onComplete={handleOnboardingComplete} />;
  }

  // 3. Render Main Map dashboard view once onboarded
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      
      {/* Interactive Map Layout */}
      {Platform.OS !== 'web' && MapView && MapMarker ? (
        <MapView
          ref={mapRef}
          style={StyleSheet.absoluteFillObject}
          initialRegion={mapRegion}
          showsUserLocation={true}
          showsMyLocationButton={false}
          onRegionChange={onRegionChange}
          onRegionChangeComplete={onRegionChangeComplete}
          onMapReady={() => console.log('[15] Map Mounted')}
        >
          {/* Heatmap Grid Layer Circles & Accessible Overlay Markers */}
          {activeCells.map((cell, idx) => (
            <React.Fragment key={idx}>
              <MapCircle
                center={{ latitude: cell.latitude, longitude: cell.longitude }}
                radius={cell.severity.radius}
                fillColor={cell.severity.fillColor}
                strokeColor={cell.severity.color}
                strokeWidth={2}
              />
              <MapMarker
                coordinate={{ latitude: cell.latitude, longitude: cell.longitude }}
                anchor={{ x: 0.5, y: 0.5 }}
                tracksViewChanges={tracksViewChanges}
                accessible={true}
                accessibilityLabel={`${cell.severity.label} severity area`}
                accessibilityRole="button"
                onPress={() => setSelectedCell(cell)}
                style={{ backgroundColor: 'transparent' }}
              >
                <SeverityBadge
                  severity={cell.severity}
                />
              </MapMarker>
            </React.Fragment>
          ))}
        </MapView>
      ) : (
        // Web Platform Fallback stylized map
        <View style={StyleSheet.absoluteFillObject} onLayout={() => console.log('[15] Map Mounted')}>
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
              <Pressable
                key={idx}
                onPress={() => setSelectedCell(cell)}
                style={[
                  styles.heatmapCircle,
                  {
                    top: pos.y - (cell.severity.radius * 3),
                    left: pos.x - (cell.severity.radius * 3), // Visual approximation
                    width: cell.severity.radius * 6,
                    height: cell.severity.radius * 6,
                    borderRadius: cell.severity.radius * 3,
                    backgroundColor: cell.severity.fillColor,
                    borderColor: cell.severity.color,
                    justifyContent: 'center',
                    alignItems: 'center',
                  }
                ]}
                accessible={true}
                accessibilityLabel={`${cell.severity.label} severity area`}
                accessibilityRole="button"
              >
                <SeverityBadge
                  severity={cell.severity}
                />
              </Pressable>
            );
          })}
        </View>
      )}

      {/* Floating Header UI — Search occupies full available width (side button removed) */}
      <View style={[styles.floatingHeader, { top: topOffset }]}>
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

      {/* Dynamic State Card Overlay */}
      {shouldShowStateCard && (
        <View style={[styles.emptyStateCard, { top: topOffset + 70, backgroundColor: colors.backgroundElement, borderColor: colors.border }]}>
          {activeNotification === 'ZOOMED_OUT' ? (
            <>
              <Icon name="search" size={24} color={colors.primary} />
              <View style={styles.emptyStateTextWrapper}>
                <Text style={[styles.emptyStateTitle, { color: colors.text }]}>Zoom in to view nearby reports</Text>
                <Text style={[styles.emptyStateDesc, { color: colors.textSecondary }]}>Area is too large.</Text>
              </View>
            </>
          ) : activeNotification === 'LOADING' ? (
            <>
              <ActivityIndicator size="small" color={colors.primary} style={{ marginRight: 8 }} />
              <View style={styles.emptyStateTextWrapper}>
                <Text style={[styles.emptyStateTitle, { color: colors.text }]}>Loading nearby reports...</Text>
                <Text style={[styles.emptyStateDesc, { color: colors.textSecondary }]}>Fetching latest data.</Text>
              </View>
            </>
          ) : activeNotification === 'ERROR' ? (
            <>
              <Icon name="alert-circle" size={24} color={colors.danger} />
              <View style={styles.emptyStateTextWrapper}>
                <Text style={[styles.emptyStateTitle, { color: colors.text }]}>Failed to load</Text>
                <Text style={[styles.emptyStateDesc, { color: colors.textSecondary }]}>Please try again later.</Text>
              </View>
            </>
          ) : activeNotification === 'EMPTY' ? (
            <>
              <Icon name="check-circle" size={24} color={colors.primary} />
              <View style={styles.emptyStateTextWrapper}>
                <Text style={[styles.emptyStateTitle, { color: colors.text }]}>No reports nearby</Text>
                <Text style={[styles.emptyStateDesc, { color: colors.textSecondary }]}>Air looks clear.</Text>
              </View>
            </>
          ) : null}

          <Pressable onPress={handleDismissOverlay} style={styles.emptyStateClose}>
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
          { bottom: bottomOffset, backgroundColor: activeScheme === 'dark' ? 'rgba(27,31,22,0.8)' : 'rgba(255,255,255,0.8)', borderColor: colors.border },
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
          { bottom: bottomOffset, backgroundColor: colors.primary, borderColor: colors.backgroundElement },
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
          { bottom: bottomOffset, backgroundColor: colors.backgroundElement, borderColor: colors.border },
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
          { bottom: bottomOffset + 76 + 12, backgroundColor: colors.primary },
          pressed && { transform: [{ scale: 0.95 }] },
        ]}
        accessibilityRole="button"
        accessibilityLabel="Open observe smoke confirmation"
      >
        <Icon name="warning" size={24} color="#ffffff" />
      </Pressable>

      {/* Full-Screen Search View Overlay */}
      {isSearching && (
        <View style={[styles.searchOverlay, { backgroundColor: colors.background, paddingTop: topOffset }]}>
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
            {isSearchingResults ? (
              <View style={styles.loadingSearchContainer}>
                <ActivityIndicator size="small" color={colors.primary} />
              </View>
            ) : getSearchResults().length === 0 ? (
              <View style={styles.noResultsContainer}>
                <Text style={[styles.noResultsText, { color: colors.textSecondary }]}>No location found</Text>
              </View>
            ) : (
              getSearchResults().map((loc, idx) => (
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
              {getResolvedSeverityLevels(colors).map((lvl) => (
                <View 
                  key={lvl.level} 
                  style={styles.legendSwatchRow} 
                  accessible={true} 
                  accessibilityLabel={`Severity: ${lvl.label} (${lvl.description})`}
                >
                  <Icon name={lvl.icon} size={20} color={lvl.color} family="MaterialCommunityIcons" />
                  <Text style={[styles.legendLabel, { color: colors.text, marginLeft: Spacing.two }]}>
                    {lvl.label} ({lvl.description})
                  </Text>
                </View>
              ))}
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

      {/* Selected Cell Radius Detail Card */}
      {selectedCell && (
        <View style={[styles.detailCard, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}>
          <View style={styles.detailHeader}>
            <Icon name={selectedCell.icon} size={24} color={selectedCell.color} />
            <Text style={[styles.detailTitle, { color: colors.text, marginLeft: Spacing.two }]}>
              {selectedCell.label} Severity Area
            </Text>
            <Pressable 
              onPress={() => setSelectedCell(null)}
              style={styles.detailCloseButton}
              accessibilityLabel="Close detail card"
              accessibilityRole="button"
            >
              <Icon name="close" size={20} themeColor="textSecondary" />
            </Pressable>
          </View>
          <View style={styles.detailBody}>
            <View style={styles.detailRow}>
              <Text style={[styles.detailLabelText, { color: colors.textSecondary }]}>Reports:</Text>
              <Text style={[styles.detailValueText, { color: colors.text, fontWeight: '600' }]}>
                {selectedCell.reports}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={[styles.detailLabelText, { color: colors.textSecondary }]}>Clean Votes:</Text>
              <Text style={[styles.detailValueText, { color: colors.text, fontWeight: '600' }]}>
                {selectedCell.cleanVotes}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={[styles.detailLabelText, { color: colors.textSecondary }]}>Score:</Text>
              <Text style={[styles.detailValueText, { color: selectedCell.color, fontWeight: '700' }]}>
                {selectedCell.count.toFixed(1)}
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* Observe confirmation modal */}
      <ReportConfirmModal
        visible={showReportConfirm}
        onCancel={() => setShowReportConfirm(false)}
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
  loadingSearchContainer: {
    paddingVertical: Spacing.eight,
    alignItems: 'center',
    justifyContent: 'center',
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

  detailCard: {
    position: 'absolute',
    bottom: 120,
    left: Spacing.five,
    right: Spacing.five,
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing.four,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 6,
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.three,
  },
  detailTitle: {
    fontFamily: Fonts.sans,
    fontSize: Typography.bodyLg.fontSize,
    fontWeight: 'bold',
    flex: 1,
  },
  detailCloseButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.full,
  },
  detailBody: {
    gap: Spacing.two,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabelText: {
    fontFamily: Fonts.sans,
    fontSize: Typography.body.fontSize,
  },
  detailValueText: {
    fontFamily: Fonts.sans,
    fontSize: Typography.body.fontSize,
  },
});
