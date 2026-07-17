import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getGridId, hashIp } from "../_shared/grid.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

serve(async (req) => {
  try {
    // Step 1: validasi login anonymous
    const authHeader = req.headers.get("Authorization") ?? "";
    const jwt = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(jwt);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    const { latitude, longitude } = await req.json();
    if (typeof latitude !== "number" || typeof longitude !== "number") {
      return new Response(JSON.stringify({ error: "Invalid coordinates" }), { status: 400 });
    }

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
    const ipHash = await hashIp(ip);

    // Step 2: rate limit, max 5 observation per IP per menit
    const { count: recentCount } = await supabase
      .from("observations")
      .select("id", { count: "exact", head: true })
      .eq("ip_hash", ipHash)
      .gte("created_at", new Date(Date.now() - 60_000).toISOString());

    if ((recentCount ?? 0) >= 5) {
      return new Response(JSON.stringify({ error: "Too many requests" }), { status: 429 });
    }

    // Step 3: hitung grid di backend, abaikan grid_id apapun dari client
    const { gridId, latCenter, lngCenter } = getGridId(latitude, longitude);

    // Step 4: cooldown 15 menit per user per grid
    const { data: existing } = await supabase
      .from("observations")
      .select("id")
      .eq("user_id", user.id)
      .eq("grid_id", gridId)
      .gte("created_at", new Date(Date.now() - 15 * 60_000).toISOString())
      .limit(1);

    if (existing && existing.length > 0) {
      return new Response(JSON.stringify({ error: "Already submitted" }), { status: 409 });
    }

    // Step 5: insert observation
    const expiresAt = new Date(Date.now() + 60 * 60_000).toISOString();
    const { error: insertError } = await supabase.from("observations").insert({
      user_id: user.id,
      grid_id: gridId,
      latitude_center: latCenter,
      longitude_center: lngCenter,
      ip_hash: ipHash,
      expires_at: expiresAt,
    });
    if (insertError) throw insertError;

    // Step 6: update grid_status secara atomic lewat SQL function
    const { error: rpcError } = await supabase.rpc("upsert_grid_observation", {
      p_grid_id: gridId,
      p_lat: latCenter,
      p_lng: lngCenter,
    });
    if (rpcError) throw rpcError;

    // Realtime broadcast otomatis lewat Supabase Postgres Changes,
    // tidak perlu kode tambahan di sini.

    return new Response(JSON.stringify({ success: true, grid_id: gridId }), { status: 200 });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500 });
  }
});
