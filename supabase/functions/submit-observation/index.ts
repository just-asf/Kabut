import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getGridId, hashIp, getDistanceMeters } from "../_shared/grid.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

serve(async (req) => {
  try {
    // Step 1: Authentication
    const authHeader = req.headers.get("Authorization") ?? "";
    const jwt = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(jwt);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    const { latitude, longitude, accuracy, speed, isMocked, isEmulator, highJitter, deviceId, isDev } = await req.json();
    if (typeof latitude !== "number" || typeof longitude !== "number") {
      return new Response(JSON.stringify({ error: "Invalid coordinates" }), { status: 400 });
    }

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
    const ipHash = await hashIp(ip);

    // Step 2: Rate limit, max 5 observation per IP per minute
    const { count: recentCount } = await supabase
      .from("observations")
      .select("id", { count: "exact", head: true })
      .eq("ip_hash", ipHash)
      .gte("created_at", new Date(Date.now() - 60_000).toISOString());

    if ((recentCount ?? 0) >= 5) {
      return new Response(JSON.stringify({ error: "Too many requests" }), { status: 429 });
    }

    // Step 3: Location Trust Engine Evaluation
    let confidence = 100;
    const reasons: string[] = [];
    
    // For Audit Logs
    let auditDistance = 0;
    let auditTimeElapsed = 0; // seconds
    let auditSpeed = 0; // km/h
    
    const isDeveloper = isDev === true;

    // Rule 1: Mock GPS
    if (isMocked && !isDeveloper) {
      confidence -= 40;
      reasons.push("MOCK_LOCATION");
    }

    // Rule 2: GPS Accuracy
    if (accuracy && accuracy > 50) {
      confidence -= 30;
      reasons.push("LOW_ACCURACY");
    } else if (accuracy && accuracy > 30) {
      confidence -= 15;
      reasons.push("LOW_ACCURACY");
    }

    // Rule 5: GPS Jitter
    if (highJitter) {
      confidence -= 20;
      reasons.push("UNSTABLE_GPS");
    }

    // Rule 8: Emulator
    if (isEmulator && !isDeveloper) {
      confidence -= 5; // Reduced from 10 to 5 per spec
      reasons.push("EMULATOR");
    }

    // Developer Mode Check
    if (isDeveloper) {
      // 0 penalty in dev mode
    } else {
      // -5 in production for dev mode? We don't have a way to detect developer mode other than __DEV__ flag from client. 
      // If client says __DEV__ = false, it's production. The spec says "Developer Mode: 0 in development builds, -5 in production".
      // Wait, is there a way to detect developer options on Android? Not from Expo without native code. 
      // I will skip the production penalty for now since `isDev` is just __DEV__.
    }

    // Device Abuse Detection
    if (deviceId && deviceId !== 'unknown') {
      const { data: recentDeviceUsers } = await supabase
        .from("observations")
        .select("user_id")
        .eq("device_id", deviceId)
        .gte("created_at", new Date(Date.now() - 3600_000).toISOString()); // Past hour
        
      if (recentDeviceUsers && recentDeviceUsers.length > 0) {
        const uniqueUsers = new Set(recentDeviceUsers.map(r => r.user_id));
        uniqueUsers.add(user.id);
        if (uniqueUsers.size > 1) {
          confidence -= 15;
          reasons.push("DEVICE_REUSE");
        }
      }
    }

    // Rule 11: User Reputation
    const { data: userTrust } = await supabase
      .from("user_trust")
      .select("reputation_score")
      .eq("user_id", user.id)
      .single();

    const repScore = userTrust?.reputation_score ?? 50;
    if (repScore >= 80) {
      confidence += 20;
      reasons.push("HIGH_REPUTATION");
    } else if (repScore < 30) {
      confidence -= 20;
      reasons.push("LOW_REPUTATION");
    }

    // Rule 3 & 4: Impossible Travel & Repeated Teleportation
    // Get observations from last 24 hours only
    const { data: lastObsList } = await supabase
      .from("observations")
      .select("exact_lat, exact_lng, created_at, grid_id")
      .eq("user_id", user.id)
      .gte("created_at", new Date(Date.now() - 24 * 3600_000).toISOString())
      .order("created_at", { ascending: false })
      .limit(3);

    if (lastObsList && lastObsList.length > 0) {
      const lastObs = lastObsList[0];
      const timeDiffHours = (Date.now() - new Date(lastObs.created_at).getTime()) / 3600000;
      
      if (timeDiffHours > 0) {
        const distanceMeters = getDistanceMeters(
          latitude, longitude, 
          lastObs.exact_lat, lastObs.exact_lng
        );
        const speedKmh = (distanceMeters / 1000) / timeDiffHours;
        
        auditDistance = distanceMeters;
        auditTimeElapsed = timeDiffHours * 3600;
        auditSpeed = speedKmh;
        
        if (speedKmh > 200) {
          confidence -= 40;
          reasons.push("IMPOSSIBLE_TRAVEL");
        }
      }

      // Detect repeated teleportation (multiple distant grids in short time)
      // Spec: evaluate sequential validation independently within 30 mins
      const recentObs = lastObsList.filter(o => {
          return (Date.now() - new Date(o.created_at).getTime()) < 30 * 60_000;
      });
      
      if (recentObs.length >= 2) {
        // Compare each hop independently
        let maxHopSpeed = 0;
        let currentLoc = { lat: latitude, lng: longitude, time: Date.now() };
        
        for (const obs of recentObs) {
          const obsTime = new Date(obs.created_at).getTime();
          const dist = getDistanceMeters(currentLoc.lat, currentLoc.lng, obs.exact_lat, obs.exact_lng);
          const hours = (currentLoc.time - obsTime) / 3600000;
          if (hours > 0) {
             const speed = (dist / 1000) / hours;
             if (speed > maxHopSpeed) maxHopSpeed = speed;
          }
          currentLoc = { lat: obs.exact_lat, lng: obs.exact_lng, time: obsTime };
        }
        
        if (maxHopSpeed > 200) {
           // We already hit impossible travel above, but repeated teleportation rule is for multiple grids
           const distantGrids = new Set([getGridId(latitude, longitude).gridId, ...recentObs.map(o => o.grid_id)]);
           if (distantGrids.size >= 3) {
             confidence -= 20;
             reasons.push("REPEATED_TELEPORTATION");
           }
        }
      }
    }

    // Clamp confidence
    confidence = Math.max(0, Math.min(100, Math.round(confidence)));

    // Calculate Risk Level
    let riskLevel = "CRITICAL";
    if (confidence >= 90) riskLevel = "LOW";
    else if (confidence >= 70) riskLevel = "MEDIUM";
    else if (confidence >= 40) riskLevel = "HIGH";

    const { gridId, latCenter, lngCenter } = getGridId(latitude, longitude);

    console.log(`
========================================
🛡 LOCATION TRUST
========================================
Confidence: ${confidence}
Risk: ${riskLevel}
Accuracy: ${Math.round(accuracy || 0)}m
Speed: ${Math.round(speed || 0)} km/h
Travel Distance: ${Math.round(auditDistance)}m
Elapsed Time: ${Math.round(auditTimeElapsed)}s
Average Speed: ${Math.round(auditSpeed)} km/h
Mocked: ${isMocked}
Device Risk: ${reasons.includes('DEVICE_REUSE') ? 'MULTIPLE_ACCOUNTS' : 'NONE'}
Reputation: ${repScore}
Reasons: ${reasons.length > 0 ? reasons.join(', ') : 'None'}
Decision: ${confidence >= 40 ? 'ACCEPT' : 'LOW_CONFIDENCE'}
========================================
`);

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
      exact_lat: latitude,
      exact_lng: longitude,
      confidence: confidence,
      risk_level: riskLevel,
      is_mocked: isMocked || false,
      accuracy: accuracy || null,
      speed: speed || null,
      device_id: deviceId,
      device_info: { isEmulator, isDev },
      trust_reasons: reasons,
    });
    if (insertError) throw insertError;

    // Step 6: update grid_status secara atomic lewat SQL function
    const { error: rpcError } = await supabase.rpc("upsert_grid_observation", {
      p_grid_id: gridId,
      p_lat: latCenter,
      p_lng: lngCenter,
      p_confidence: confidence,
      p_reputation: repScore
    });
    if (rpcError) throw rpcError;

    // Realtime broadcast otomatis lewat Supabase Postgres Changes
    
    // Return custom error payload so UI knows if it was low confidence
    if (riskLevel === 'CRITICAL') {
      return new Response(JSON.stringify({ 
        success: true, 
        grid_id: gridId,
        trustWarning: true 
      }), { status: 200 });
    }

    return new Response(JSON.stringify({ success: true, grid_id: gridId }), { status: 200 });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500 });
  }
});
