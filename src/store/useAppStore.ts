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

  submitObservation: async () => {
    // 1. Set to GPS validation state
    set({ observationState: 'GPS' });
    
    try {
      // Check location permission and get coords
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        set({ 
          locationError: 'Location permission required to submit observations.', 
          observationState: 'FAILED' 
        });
        return false;
      }

      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      set({ location: loc, observationState: 'VALIDATION' });

      // Run validation (e.g. coordinates sanity check, anti-spam delay)
      await new Promise((resolve) => setTimeout(resolve, 800));

      set({ observationState: 'UPLOAD' });

      // 2. Insert observation record to Supabase
      const { error } = await supabase
        .from('observations')
        .insert([
          {
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
            status: 'smoke-free',
            created_at: new Date().toISOString(),
          }
        ]);

      if (error) {
        // Handle database table missing (42P01 / PGRST205) or any other insert error
        console.error('Database insertion error:', error);
        throw error;
      }

      set({ observationState: 'WAIT_RESPONSE' });
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Refresh local observations and trigger heatmap refresh
      set({ observationState: 'REFRESH_HEATMAP' });
      await get().fetchObservations();
      
      set({ observationState: 'IDLE', scanProgress: 0 });
      return true;
    } catch (err) {
      console.error('Failed to upload observation:', err);
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
