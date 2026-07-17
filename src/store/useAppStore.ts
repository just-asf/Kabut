import { create } from 'zustand';
import * as Location from 'expo-location';
import { supabase, parseFunctionError } from '@/lib/supabase';

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
  submitCleanVote: (gridId: string) => Promise<boolean>;
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
      const { data, error } = await supabase
        .from('grid_status')
        .select('*')
        .gt('score', 0);
      if (error) throw error;
      set({ observations: data || [] });
    } catch (err) {
      console.warn('Failed to fetch observations from Supabase:', err);
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
    set({ observationState: 'GPS' });

    try {
      // 1. Internet check
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);

        await fetch(
          'https://dvbgfjjzggnlrixsqkss.supabase.co',
          {
            method: 'HEAD',
            signal: controller.signal,
          }
        );

        clearTimeout(timeoutId);
      } catch {
        set({
          locationError:
            'Network connection failed. Verify your device is connected to the Internet.',
          observationState: 'FAILED',
        });

        return false;
      }

      // 2. Authentication
      let {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        console.log('[AUTH] No session found. Signing in anonymously...');

        const { data, error } =
          await supabase.auth.signInAnonymously();

        console.log('[AUTH] Sign in result:', data);
        console.log('[AUTH] Sign in error:', error);

        if (error) {
          console.error('[AUTH] Anonymous sign in failed', error);

          set({
            observationState: 'FAILED',
            locationError: error.message,
          });

          return false;
        }

        const verify =
          await supabase.auth.getSession();

        session = verify.data.session;

        console.log('[AUTH] Session after login');
        console.log(session);

        if (!session) {
          console.error('[AUTH] Session is still null');

          set({
            observationState: 'FAILED',
            locationError:
              'Unable to establish authenticated session.',
          });

          return false;
        }
      }

      // 3. GPS
      let loc = get().location;

      if (!loc) {
        const { status } =
          await Location.requestForegroundPermissionsAsync();

        if (status !== 'granted') {
          set({
            observationState: 'FAILED',
            locationError:
              'Location permission denied.',
          });

          return false;
        }

        loc =
          await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });

        set({ location: loc });
      }

      // 4. Validation
      set({
        observationState: 'VALIDATION',
      });

      if (
        !loc ||
        Math.abs(loc.coords.latitude) > 90 ||
        Math.abs(loc.coords.longitude) > 180
      ) {
        set({
          observationState: 'FAILED',
          locationError:
            'Invalid GPS coordinates.',
        });

        return false;
      }

      // 5. Upload
      set({
        observationState: 'UPLOAD',
      });

      const { data, error } =
        await supabase.functions.invoke(
          'submit-observation',
          {
            body: {
              latitude: loc.coords.latitude,
              longitude: loc.coords.longitude,
            },
          }
        );

      if (error) {
        const parsed = await parseFunctionError(error, 'submit-observation');
        set({
          observationState: 'FAILED',
          locationError: parsed.message,
        });
        return false;
      }

      // 6. Refresh
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
      set({
        observationState: 'FAILED',
        locationError: parsed.message,
      });

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
        throw new Error(parsed.message);
      }
      await get().fetchObservations();
      return true;
    } catch (err: any) {
      console.warn('Failed to submit clean vote:', err);
      if (err.name === 'FunctionsHttpError' || err.context) {
        const parsed = await parseFunctionError(err, 'submit-clean-vote');
        throw new Error(parsed.message);
      }
      throw err;
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

console.log('[4] Zustand Store Initialized');
