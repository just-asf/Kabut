import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { hashIp } from "../_shared/grid.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

serve(async (req) => {
  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const jwt = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(jwt);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    const { grid_id } = await req.json();
    if (typeof grid_id !== "string") {
      return new Response(JSON.stringify({ error: "Invalid grid_id" }), { status: 400 });
    }

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
    const ipHash = await hashIp(ip);

    // Step 1: insert, pakai select() untuk tahu apakah row benar-benar baru
    const { data: inserted, error: insertError } = await supabase
      .from("clean_votes")
      .insert({ user_id: user.id, grid_id, ip_hash: ipHash })
      .select("id");

    if (insertError && insertError.code !== "23505") throw insertError; // 23505 = unique violation

    if (!inserted || inserted.length === 0) {
      return new Response(JSON.stringify({ error: "Already voted" }), { status: 409 });
    }

    // Step 2: update grid_status secara atomic
    const { error: rpcError } = await supabase.rpc("register_clean_vote", {
      p_grid_id: grid_id,
    });
    if (rpcError) throw rpcError;

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500 });
  }
});
