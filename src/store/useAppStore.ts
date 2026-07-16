import { create } from 'zustand';
import * as Location from 'expo-location';
import { supabase } from '@/lib/supabase';

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
  fetchObservations: () => Promise<void>;
  startGpsAcquisition: () => Promise<Location.LocationObject | null>;
  submitObservation: () => Promise<boolean>;
  resetScan: () => void;
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

  fetchObservations: async () => {
    try {
      const { data, error } = await supabase
        .from('observations')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      set({ observations: data || [] });
    } catch (err) {
      console.warn('Failed to fetch observations from Supabase:', err);
    }
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
    set({ observationState: 'GPS' });
    
    try {
      // 1. Check internet connectivity
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);
        await fetch('https://dvbgfjjzggnlrixsqkss.supabase.co', { method: 'HEAD', signal: controller.signal });
        clearTimeout(timeoutId);
      } catch (err) {
        set({ 
          locationError: 'Network connection failed. Verify your device is connected to the Internet.', 
          observationState: 'FAILED' 
        });
        return false;
      }

      // 2. Check anonymous session
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        const { error: authError } = await supabase.auth.signInAnonymously();
        if (authError) {
          console.warn('Supabase anonymous sign-in failed:', authError.message);
        }
      }

      // 3. Acquire GPS (reuse background position or request it now)
      let loc = get().location;
      if (!loc) {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          set({ 
            locationError: 'Geotagging failed: Location permission was denied.', 
            observationState: 'FAILED' 
          });
          return false;
        }
        loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        set({ location: loc });
      }

      // 4. Anti-spam & coordinates sanity check validation
      set({ observationState: 'VALIDATION' });
      if (!loc || Math.abs(loc.coords.latitude) > 90 || Math.abs(loc.coords.longitude) > 180) {
        set({ 
          locationError: 'Validation failed: Invalid GPS coordinate parameters.', 
          observationState: 'FAILED' 
        });
        return false;
      }
      await new Promise((resolve) => setTimeout(resolve, 300));

      // 5. Upload to Supabase
      set({ observationState: 'UPLOAD' });
      const insertPromise = supabase
        .from('observations')
        .insert([
          {
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
            status: 'smoke-free',
            created_at: new Date().toISOString(),
          }
        ]);

      // Handle insert and fetch observations asynchronously in the background
      (async () => {
        try {
          const { error } = await insertPromise;
          if (error) {
            console.error('Background upload failed:', error.message);
          }
          await get().fetchObservations();
        } catch (err: any) {
          console.error('Background upload exception:', err);
        }
      })();

      set({ observationState: 'WAIT_RESPONSE' });
      await new Promise((resolve) => setTimeout(resolve, 400));
      
      set({ observationState: 'REFRESH_HEATMAP' });
      return true;
    } catch (err) {
      console.error('Failed to submit observation:', err);
      set({ observationState: 'FAILED' });
      return false;
    }
  },

  resetScan: () => {
    set({
      observationState: 'IDLE',
      scanProgress: 0,
      locationError: null
    });
  }
}));
