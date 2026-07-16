import 'react-native-url-polyfill/auto';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// SSR Polyfill for Node.js environments lacking global WebSocket support
if (Platform.OS === 'web' && typeof window === 'undefined') {
  if (typeof globalThis !== 'undefined' && !(globalThis as any).WebSocket) {
    class DummyWebSocket {
      static CONNECTING = 0;
      static OPEN = 1;
      static CLOSING = 2;
      static CLOSED = 3;
      readyState = 3;
      send() {}
      close() {}
      addEventListener() {}
      removeEventListener() {}
    }
    (globalThis as any).WebSocket = DummyWebSocket;
  }
}

// eslint-disable-next-line import/first
import { createClient } from '@supabase/supabase-js';

const rawUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const rawKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

let validatedUrl = '';
let validatedKey = '';
let initializationError: string | null = null;

// Safe validation logic to prevent module-scope startup crashes
try {
  if (!rawUrl) {
    throw new Error('Missing environment variable: EXPO_PUBLIC_SUPABASE_URL.');
  }
  
  // URL format validation
  new URL(rawUrl);
  validatedUrl = rawUrl;

  if (!rawKey) {
    throw new Error('Missing environment variable: EXPO_PUBLIC_SUPABASE_ANON_KEY.');
  }

  // Key format check warning (non-blocking) - supports legacy JWT keys and modern sb_publishable_ keys
  const isValidJwt = rawKey.startsWith('eyJ') && rawKey.split('.').length === 3;
  const isValidPublishable = rawKey.startsWith('sb_publishable_');
  if (!isValidJwt && !isValidPublishable) {
    console.warn(
      'Warning: EXPO_PUBLIC_SUPABASE_ANON_KEY does not appear to be a valid JWT format ' +
      'or modern sb_publishable_ key. Please check your credentials.'
    );
  }
  validatedKey = rawKey;
} catch (err: unknown) {
  const errMsg = err instanceof Error ? err.message : String(err);
  initializationError = errMsg;
  console.error(`Supabase Client Initialization Deferred: ${errMsg}`);
}

// Safe fallback credentials so that createClient does not crash at module parse time
const fallbackUrl = 'https://placeholder-url-for-ssr-safety.supabase.co';
const fallbackKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy.key';

// Native in-memory storage fallback
class InMemoryStorage {
  private store = new Map<string, string>();

  async getItem(key: string): Promise<string | null> {
    return this.store.get(key) || null;
  }

  async setItem(key: string, value: string): Promise<void> {
    this.store.set(key, value);
  }

  async removeItem(key: string): Promise<void> {
    this.store.delete(key);
  }
}

const nativeMemoryStorage = new InMemoryStorage();

// Storage strategy: Web uses localStorage, Native uses expo-secure-store
const customStorage = {
  getItem: async (key: string): Promise<string | null> => {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage.getItem(key);
      }
      return null;
    }
    return SecureStore.getItemAsync(key);
  },
  setItem: async (key: string, value: string): Promise<void> => {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, value);
      }
      return;
    }
    await SecureStore.setItemAsync(key, value);
  },
  removeItem: async (key: string): Promise<void> => {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(key);
      }
      return;
    }
    await SecureStore.deleteItemAsync(key);
  },
};

// Create client singleton using verified or fallback values
console.log('Initializing Supabase client singleton...');
export const supabase = createClient(
  validatedUrl || fallbackUrl,
  validatedKey || fallbackKey,
  {
    auth: {
      storage: customStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
);
console.log('Supabase client singleton created successfully.');

// Export initialization error status for diagnostics
export const supabaseInitError = initializationError;

// Connection check structure definition
export interface ConnectionTestResult {
  success: boolean;
  message: string;
  error: Error | { message: string; [key: string]: unknown } | null;
  details?: {
    envValid: boolean;
    clientCreated: boolean;
    networkStatus?: number | string;
    code?: string;
    initError?: string | null;
  };
}

/**
 * Safely tests connection to Supabase database.
 * It will not crash the app under any circumstances and handles network, JWT, and table-missing errors gracefully.
 */
export async function checkSupabaseConnection(): Promise<ConnectionTestResult> {
  console.log('Testing Supabase connection...');
  const result: ConnectionTestResult = {
    success: false,
    message: 'Initializing test...',
    error: null,
    details: {
      envValid: false,
      clientCreated: false,
      initError: supabaseInitError,
    },
  };

  // Check if initialization error occurred at startup
  if (supabaseInitError) {
    result.message = `Supabase initialization error: ${supabaseInitError}`;
    result.error = new Error(supabaseInitError);
    return result;
  }

  // 1. Env validation
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    result.message = `Missing environment variables. URL: ${url ? 'loaded' : 'missing'}, Key: ${key ? 'loaded' : 'missing'}`;
    return result;
  }
  result.details!.envValid = true;

  // 2. Client verification
  let client;
  try {
    client = supabase;
    result.details!.clientCreated = true;
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    result.message = `Failed to obtain Supabase client singleton: ${errorMsg}`;
    result.error = err instanceof Error ? err : { message: errorMsg };
    return result;
  }

  // 3. Database connection test query
  try {
    const { error, status } = await client
      .from('__supabase_connection_test__')
      .select('*')
      .limit(1);

    if (error) {
      result.error = error;
      result.details!.networkStatus = status;
      result.details!.code = error.code;

      // PGRST116 (No rows returned), 42P01 (relation/table does not exist), or PGRST205 (stale schema cache / schema issue)
      // All of these prove that the client successfully authorized and reached the Database schema layer.
      if (error.code === '42P01' || error.code === 'PGRST205') {
        result.success = true;
        result.message = `Connection successful! API keys are valid (database returned status code ${error.code}).`;
        console.log(`Supabase connection test: successful (credentials verified, database returned ${error.code}).`);
        return result;
      }

      // JWT or key issue
      if (status === 401 || status === 403 || error.message?.includes('JWT') || error.message?.includes('anon')) {
        result.success = false;
        result.message = `Authentication failed: Invalid credentials or URL. (Status: ${status}, Error: ${error.message})`;
        console.error(`Supabase connection test failed: Authentication Error (Status ${status})`);
        return result;
      }

      // Check if it's a network unreachable error
      if (error.message?.includes('fetch') || error.message?.includes('Network') || status === 0) {
        result.success = false;
        result.message = 'Network error: Supabase is unreachable. Verify your Internet connection and URL.';
        console.error('Supabase connection test failed: Network unreachable.');
        return result;
      }

      // Other PostgreSQL / PostgREST errors
      result.success = false;
      result.message = `Database query returned an error: ${error.message} (Code: ${error.code})`;
      console.error(`Supabase connection test failed: Postgres error ${error.code}`);
      return result;
    }

    // Success (Table exists and query resolved cleanly)
    result.success = true;
    result.message = 'Connection successful! Database is fully reachable, credentials are valid, and the test table exists.';
    console.log('Supabase connection test: successful (table accessed).');
    return result;
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    result.error = err instanceof Error ? err : { message: errorMsg };
    
    const isNetwork = errorMsg.includes('fetch') || errorMsg.includes('Network') || (err instanceof TypeError);
    result.message = isNetwork
      ? 'Network error: Failed to fetch from Supabase. Ensure your device has internet access and your Supabase URL is correct.'
      : `Unexpected exception during connection check: ${errorMsg}`;
    
    console.error(`Supabase connection test failed with exception: ${errorMsg}`);
    return result;
  }
}
