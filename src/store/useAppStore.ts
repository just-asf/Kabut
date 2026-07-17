import { create } from 'zustand';
import * as Location from 'expo-location';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { getDistanceMeters } from '@/utils/location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase, parseFunctionError } from '@/lib/supabase';
import { getGridId } from '@/lib/grid';
import { globalShowError } from '@/providers/GlobalErrorProvider';

export type ObservationState =
  | 'IDLE'
  | 'HOLDING'
  | 'GPS'
  | 'VALIDATION'
  | 'UPLOAD'
  | 'WAIT_RESPONSE'
  | 'REFRESH_HEATMAP'
  | 'SUCCESS'
  | 'FAILED';

export interface BoundingBox {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

export type HeatmapFetchState = 'IDLE' | 'LOADING' | 'SUCCESS' | 'ERROR';

interface CacheEntry {
  bounds: BoundingBox;
  data: any[];
  timestamp: number;
}

interface AppStore {
  isOnboarded: boolean;
  setIsOnboarded: (val: boolean) => void;

  observationState: ObservationState;
  setObservationState: (state: ObservationState) => void;

  scanProgress: number;
  setScanProgress: (progress: number) => void;

  location: Location.LocationObject | null;
  setLocation: (loc: Location.LocationObject | null) => void;
  locationError: string | null;
  setLocationError: (err: string | null) => void;

  observations: any[];
  setObservations: (obs: any[]) => void;
  viewportCache: CacheEntry[];
  fetchToken: number;
  heatmapState: HeatmapFetchState;
  heatmapError: string | null;
  fetchObservations: (bounds?: BoundingBox) => Promise<void>;
  startGpsAcquisition: () => Promise<Location.LocationObject | null>;
  submitObservation: () => Promise<boolean>;
  submitCleanVote: (gridId: string) => Promise<boolean>;
  resetScan: () => void;

  // Cooldown Tracking
  observationCooldowns: Record<string, number>;
  cleanVoteCooldowns: Record<string, number>;
  cooldownLoading: Record<string, boolean>;
  addObservationCooldown: (gridId: string, durationMs?: number) => Promise<void>;
  addCleanVoteCooldown: (gridId: string, durationMs?: number) => Promise<void>;
  clearObservationCooldown: (gridId: string) => Promise<void>;
  clearCleanVoteCooldown: (gridId: string) => Promise<void>;
  syncCooldowns: (gridId: string) => Promise<void>;
}

export const useAppStore = create<AppStore>((set, get) => ({
  isOnboarded: false,
  setIsOnboarded: (val) => set({ isOnboarded: val }),

  observationState: 'IDLE',
  setObservationState: (state) => set({ observationState: state }),

  scanProgress: 0,
  setScanProgress: (progress) => set({ scanProgress: progress }),

  location: null,
  setLocation: (loc) => set({ location: loc }),
  locationError: null,
  setLocationError: (err) => set({ locationError: err }),

  observations: [],
  setObservations: (obs) => set({ observations: obs }),

  observationCooldowns: {},
  cleanVoteCooldowns: {},
  cooldownLoading: {},
  viewportCache: [],
  fetchToken: 0,
  heatmapState: 'IDLE',
  heatmapError: null,

  fetchObservations: async (bounds?: BoundingBox) => {
    console.log('[10] Authentication Check Started');
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        await supabase.auth.signInAnonymously();
      }
    } catch (err) {
      console.warn('Startup auth check failed:', err);
    }
    console.log('[11] Authentication Check Finished');

    console.log('[12] Fetch Observations Started');
    try {
      if (bounds) {
        // 1. Check Cache
        const now = Date.now();
        const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
        
        // Clean expired cache entries
        let currentCache = get().viewportCache.filter(entry => now - entry.timestamp < CACHE_TTL);
        
        // Find if any cached bounds completely contain the requested bounds
        const cacheHit = currentCache.find(entry => 
          entry.bounds.minLat <= bounds.minLat &&
          entry.bounds.maxLat >= bounds.maxLat &&
          entry.bounds.minLng <= bounds.minLng &&
          entry.bounds.maxLng >= bounds.maxLng
        );

        if (cacheHit) {
          console.log('Viewport Cache Hit');
          set({ 
            observations: cacheHit.data,
            viewportCache: currentCache,
            heatmapState: 'SUCCESS',
            heatmapError: null
          });
          return;
        }

        console.log('Viewport Cache Miss, fetching from Supabase');

        const currentToken = Date.now();
        set({ fetchToken: currentToken, heatmapState: 'LOADING', heatmapError: null });

        // 2. Fetch from Network
        const { data, error } = await supabase
          .from('grid_status')
          .select('*')
          .gte('latitude_center', bounds.minLat)
          .lte('latitude_center', bounds.maxLat)
          .gte('longitude_center', bounds.minLng)
          .lte('longitude_center', bounds.maxLng);

        if (error) throw error;
        
        // Prevent race condition: Ignore if a newer request started
        if (get().fetchToken !== currentToken) {
          console.log('Stale fetch aborted, ignoring network response');
          return;
        }

        // 3. Update Cache (keep last 10 entries)
        const newEntry = { bounds, data: data || [], timestamp: now };
        currentCache = [newEntry, ...currentCache].slice(0, 10);

        set({ 
          observations: data || [],
          viewportCache: currentCache,
          heatmapState: 'SUCCESS'
        });
      } else {
        // Fallback for full fetch (e.g., initial startup if no bounds)
        set({ heatmapState: 'LOADING', heatmapError: null });
        const { data, error } = await supabase
          .from('grid_status')
          .select('*');
        if (error) throw error;
        set({ observations: data || [], heatmapState: 'SUCCESS' });
      }
    } catch (err) {
      console.warn('Failed to fetch observations from Supabase:', err);
      set({ heatmapState: 'ERROR', heatmapError: null });
      globalShowError({ error: err });
    }
    console.log('[13] Fetch Observations Finished');
  },

  startGpsAcquisition: async () => {
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== 'granted') return null;

      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      set({ location: loc, locationError: null });
      return loc;
    } catch (err) {
      console.warn('Background GPS acquisition failed:', err);
      return null;
    }
  },

  submitObservation: async () => {
    try {
      // 1. Get GPS coordinates
      set({
        observationState: 'GPS',
      });

      let loc = get().location;
      if (!loc) {
        loc = await get().startGpsAcquisition();
      }

        if (!loc) {
          set({
            observationState: 'FAILED',
            locationError: 'GPS acquisition failed. Please enable location permissions.',
          });
          return false;
        }

      // 2. Validate coordinates
      set({
        observationState: 'VALIDATION',
      });

      if (
        loc.coords.latitude === 0 ||
        loc.coords.longitude === 0 ||
        Math.abs(loc.coords.latitude) > 90 ||
        Math.abs(loc.coords.longitude) > 180
      ) {
        set({
          observationState: 'FAILED',
          locationError: 'Invalid GPS coordinates.',
        });
        return false;
      }

      // Rule 2 Check: If accuracy is > 100m, we should delay and ask for a better location
      if (loc.coords.accuracy && loc.coords.accuracy > 100) {
        set({
          observationState: 'FAILED',
          locationError: 'GPS accuracy is too poor. Please move to an open area and try again.',
        });
        return false;
      }

      // 3. Upload State starts immediately
      set({
        observationState: 'UPLOAD',
      });

      // Rule 5: Location Stability (Async Jitter check, max 2.5s)
      let highJitter = false;
      let maxDrift = 0;
      let subscription: Location.LocationSubscription | null = null;
      
      // Skip extended sampling if accuracy is already excellent
      if (!loc.coords.accuracy || loc.coords.accuracy >= 10) {
        subscription = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.Highest, timeInterval: 500, distanceInterval: 1 },
          (newLoc) => {
            const drift = getDistanceMeters(
              { latitude: loc!.coords.latitude, longitude: loc!.coords.longitude },
              { latitude: newLoc.coords.latitude, longitude: newLoc.coords.longitude }
            );
            if (drift > maxDrift) maxDrift = drift;
          }
        );
        // Wait maximum 2.5 seconds to collect stability data
        await new Promise(resolve => setTimeout(resolve, 2500));
        subscription.remove();
        if (maxDrift > 100) highJitter = true;
      }

      // Get Device ID for abuse detection (fallback to AsyncStorage)
      let deviceId = 'unknown';
      try {
        const storedId = await AsyncStorage.getItem('mbg_device_id');
        if (storedId) {
          deviceId = storedId;
        } else {
          deviceId = 'device_' + Math.random().toString(36).substring(2) + Date.now().toString(36);
          await AsyncStorage.setItem('mbg_device_id', deviceId);
        }
      } catch (e) {
        console.warn('Failed to get device ID', e);
      }

      const { data, error } = await supabase.functions.invoke(
        'submit-observation',
        {
          body: {
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
            accuracy: loc.coords.accuracy || null,
            speed: loc.coords.speed || null,
            isMocked: loc.mocked || false,
            isEmulator: !Device.isDevice,
            highJitter: highJitter,
            deviceId: deviceId,
            isDev: __DEV__,
          },
        }
      );

      if (data && data.trustWarning) {
        set({
          observationState: 'FAILED',
          locationError: "We couldn't confidently verify your location. Please move to an open area and try again.",
        });
        return false;
      }

      if (error) {
        const parsed = await parseFunctionError(error, 'submit-observation');
        
        if (parsed.code === 'SERVER_ERROR' || !parsed.code) {
          set({ observationState: 'IDLE', locationError: null });
          globalShowError({ error });
        } else {
          set({
            observationState: 'FAILED',
            locationError: parsed.message,
          });
        }

        if (error.status === 409 || (error.context && error.context.status === 409)) {
          const { gridId } = getGridId(loc.coords.latitude, loc.coords.longitude);
          await get().addObservationCooldown(gridId);
        }
        return false;
      }

      // 4. Record successful observation cooldown
      const { gridId } = getGridId(loc.coords.latitude, loc.coords.longitude);
      await get().addObservationCooldown(gridId);

      // 5. Refresh
      set({
        observationState: 'REFRESH_HEATMAP',
      });

      await get().fetchObservations();

      set({
        observationState: 'SUCCESS',
      });

      console.log('Upload Success');
      return true;
    } catch (err) {
      console.error('submitObservation exception');
      console.error(err);

      const parsed = await parseFunctionError(err, 'submit-observation');
      if (parsed.code === 'SERVER_ERROR' || !parsed.code) {
        set({ observationState: 'IDLE', locationError: null });
        globalShowError({ error: err });
      } else {
        set({
          observationState: 'FAILED',
          locationError: parsed.message,
        });
      }

      return false;
    }
  },

  submitCleanVote: async (gridId: string) => {
    try {
      const { error } = await supabase.functions.invoke('submit-clean-vote', {
        body: { grid_id: gridId },
      });
      if (error) {
        const parsed = await parseFunctionError(error, 'submit-clean-vote');
        if (error.status === 409 || (error.context && error.context.status === 409)) {
          await get().addCleanVoteCooldown(gridId);
        }
        throw new Error(parsed.message);
      }
      await get().addCleanVoteCooldown(gridId);
      await get().fetchObservations();
      return true;
    } catch (err: any) {
      console.warn('Failed to submit clean vote:', err);
      if (err.name === 'FunctionsHttpError' || err.context) {
        const parsed = await parseFunctionError(err, 'submit-clean-vote');
        if (err.status === 409 || (err.context && err.context.status === 409)) {
          await get().addCleanVoteCooldown(gridId);
        }
        if (parsed.code === 'SERVER_ERROR') {
          globalShowError({ error: err });
        }
        throw new Error(parsed.message);
      }
      globalShowError({ error: err });
      throw err;
    }
  },

  resetScan: () => {
    set({
      observationState: 'IDLE',
      scanProgress: 0,
      locationError: null,
    });
  },

  addObservationCooldown: async (gridId, durationMs = 15 * 60 * 1000) => {
    const expiration = Date.now() + durationMs;
    const cooldowns = { ...get().observationCooldowns, [gridId]: expiration };
    set({ observationCooldowns: cooldowns });
    try {
      await AsyncStorage.setItem('observation_cooldowns', JSON.stringify(cooldowns));
    } catch (e) {
      console.warn('Failed to save observation cooldowns:', e);
    }
  },

  addCleanVoteCooldown: async (gridId, durationMs = 60 * 60 * 1000) => {
    const expiration = Date.now() + durationMs;
    const cooldowns = { ...get().cleanVoteCooldowns, [gridId]: expiration };
    set({ cleanVoteCooldowns: cooldowns });
    try {
      await AsyncStorage.setItem('clean_vote_cooldowns', JSON.stringify(cooldowns));
    } catch (e) {
      console.warn('Failed to save clean vote cooldowns:', e);
    }
  },

  clearObservationCooldown: async (gridId) => {
    const cooldowns = { ...get().observationCooldowns };
    delete cooldowns[gridId];
    set({ observationCooldowns: cooldowns });
    try {
      await AsyncStorage.setItem('observation_cooldowns', JSON.stringify(cooldowns));
    } catch (e) {
      console.warn('Failed to clear observation cooldown:', e);
    }
  },

  clearCleanVoteCooldown: async (gridId) => {
    const cooldowns = { ...get().cleanVoteCooldowns };
    delete cooldowns[gridId];
    set({ cleanVoteCooldowns: cooldowns });
    try {
      await AsyncStorage.setItem('clean_vote_cooldowns', JSON.stringify(cooldowns));
    } catch (e) {
      console.warn('Failed to clear clean vote cooldown:', e);
    }
  },

  syncCooldowns: async (gridId) => {
    if (get().cooldownLoading[gridId]) return;

    set((state) => ({
      cooldownLoading: { ...state.cooldownLoading, [gridId]: true }
    }));

    try {
      let session = null;
      try {
        const sessionRes = await supabase.auth.getSession();
        session = sessionRes.data.session;
        if (!session) {
          const authRes = await supabase.auth.signInAnonymously();
          session = authRes.data.session;
        }
      } catch (authErr) {
        console.warn('Auth session check failed in syncCooldowns:', authErr);
      }

      if (!session || !session.user) {
        return;
      }

      const userId = session.user.id;

      const { data: obsData, error: obsError } = await supabase
        .from('observations')
        .select('created_at')
        .eq('grid_id', gridId)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1);

      const { data: voteData, error: voteError } = await supabase
        .from('clean_votes')
        .select('created_at')
        .eq('grid_id', gridId)
        .eq('user_id', userId)
        .limit(1);

      const now = Date.now();
      const updates: {
        observationCooldowns?: Record<string, number>;
        cleanVoteCooldowns?: Record<string, number>;
      } = {};

      if (!obsError && obsData && obsData.length > 0) {
        const elapsed = now - new Date(obsData[0].created_at).getTime();
        const remaining = 15 * 60 * 1000 - elapsed;
        if (remaining > 0) {
          updates.observationCooldowns = {
            ...get().observationCooldowns,
            [gridId]: now + remaining,
          };
        } else {
          if (get().observationCooldowns[gridId]) {
            const current = { ...get().observationCooldowns };
            delete current[gridId];
            updates.observationCooldowns = current;
          }
        }
      }

      if (!voteError && voteData && voteData.length > 0) {
        const elapsed = now - new Date(voteData[0].created_at).getTime();
        const remaining = 60 * 60 * 1000 - elapsed;
        if (remaining > 0) {
          updates.cleanVoteCooldowns = {
            ...get().cleanVoteCooldowns,
            [gridId]: now + remaining,
          };
        } else {
          if (get().cleanVoteCooldowns[gridId]) {
            const current = { ...get().cleanVoteCooldowns };
            delete current[gridId];
            updates.cleanVoteCooldowns = current;
          }
        }
      }

      if (updates.observationCooldowns) {
        set({ observationCooldowns: updates.observationCooldowns });
        await AsyncStorage.setItem('observation_cooldowns', JSON.stringify(updates.observationCooldowns));
      }
      if (updates.cleanVoteCooldowns) {
        set({ cleanVoteCooldowns: updates.cleanVoteCooldowns });
        await AsyncStorage.setItem('clean_vote_cooldowns', JSON.stringify(updates.cleanVoteCooldowns));
      }
    } catch (err) {
      console.warn('syncCooldowns error:', err);
    } finally {
      set((state) => ({
        cooldownLoading: { ...state.cooldownLoading, [gridId]: false }
      }));
    }
  },
}));

// Load cooldowns from AsyncStorage on startup
const loadStoredCooldowns = async () => {
  try {
    const obsData = await AsyncStorage.getItem('observation_cooldowns');
    const cleanData = await AsyncStorage.getItem('clean_vote_cooldowns');

    const obsCooldowns = obsData ? JSON.parse(obsData) : {};
    const cleanCooldowns = cleanData ? JSON.parse(cleanData) : {};

    const now = Date.now();
    const activeObs: Record<string, number> = {};
    const activeClean: Record<string, number> = {};

    for (const [key, val] of Object.entries(obsCooldowns)) {
      if (typeof val === 'number' && val > now) {
        activeObs[key] = val;
      }
    }
    for (const [key, val] of Object.entries(cleanCooldowns)) {
      if (typeof val === 'number' && val > now) {
        activeClean[key] = val;
      }
    }

    useAppStore.setState({
      observationCooldowns: activeObs,
      cleanVoteCooldowns: activeClean,
    });
  } catch (e) {
    console.warn('Failed to load stored cooldowns:', e);
  }
};

loadStoredCooldowns();

console.log('[4] Zustand Store Initialized');
