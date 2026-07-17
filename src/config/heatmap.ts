/**
 * Heatmap Visualization Configuration
 *
 * This radius ONLY affects frontend visualization:
 * - MapCircle rendering on native platforms (radius in meters)
 * - Heatmap circle display size
 *
 * It does NOT modify:
 * - Backend grid calculations (getGridId, Edge Functions)
 * - Observation clustering or aggregation
 * - Observation grouping or storage
 * - Supabase RPC functions
 * - Any backend behavior whatsoever
 *
 * To test different radii during development, set in .env:
 *   EXPO_PUBLIC_HEATMAP_RADIUS=30
 * Then restart Expo. No code changes required.
 */

const DEFAULT_RADIUS = 50;

const parsed = Number(process.env.EXPO_PUBLIC_HEATMAP_RADIUS);

/**
 * The heatmap circle radius in meters for native MapCircle rendering.
 * Falls back to 30 meters if the env var is missing, NaN, Infinity, zero, or negative.
 */
export const HEATMAP_RADIUS_METERS: number =
  Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_RADIUS;
