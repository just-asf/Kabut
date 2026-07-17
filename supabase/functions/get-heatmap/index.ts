import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_ANON_KEY")!
);

serve(async (req) => {
  try {
    const url = new URL(req.url);
    const minLat = parseFloat(url.searchParams.get("min_lat") ?? "");
    const maxLat = parseFloat(url.searchParams.get("max_lat") ?? "");
    const minLng = parseFloat(url.searchParams.get("min_lng") ?? "");
    const maxLng = parseFloat(url.searchParams.get("max_lng") ?? "");

    if ([minLat, maxLat, minLng, maxLng].some((v) => Number.isNaN(v))) {
      return new Response(JSON.stringify({ error: "Missing bounding box params" }), { status: 400 });
    }

    const { data, error } = await supabase
      .from("grid_status")
      .select("grid_id, latitude_center, longitude_center, score")
      .gte("latitude_center", minLat)
      .lte("latitude_center", maxLat)
      .gte("longitude_center", minLng)
      .lte("longitude_center", maxLng)
      .gt("score", 0);

    if (error) throw error;

    return new Response(JSON.stringify(data), { status: 200 });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500 });
  }
});
