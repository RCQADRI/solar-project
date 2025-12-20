import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getDb } from "@/lib/mongodb";
import { COLLECTION_TELEMETRY } from "@/lib/telemetry";

// Device is considered online if last data received within this time
const ONLINE_THRESHOLD_MS = 30_000; // 30 seconds

/**
 * GET /api/telemetry/devices
 * 
 * Returns a list of all unique device IDs that have sent telemetry data.
 * Includes live status (online/offline) based on last data timestamp.
 */
export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const db = await getDb();
    const col = db.collection(COLLECTION_TELEMETRY);
    const now = Date.now();
    
    // Get distinct device IDs
    const deviceIds = await col.distinct("deviceId");
    
    // Filter out null/undefined and get device stats
    const validDevices = deviceIds.filter((id): id is string => typeof id === "string" && id.length > 0);
    
    // Get additional info for each device (last seen, source type, online status)
    const deviceStats = await Promise.all(
      validDevices.map(async (deviceId) => {
        const lastDoc = await col.findOne(
          { deviceId },
          { sort: { ts: -1 }, projection: { ts: 1, source: 1 } }
        );
        
        const count = await col.countDocuments({ deviceId });
        const lastSeenTime = lastDoc?.ts ? new Date(lastDoc.ts).getTime() : 0;
        const isOnline = (now - lastSeenTime) < ONLINE_THRESHOLD_MS;
        const secondsAgo = lastSeenTime ? Math.floor((now - lastSeenTime) / 1000) : null;
        
        return {
          deviceId,
          lastSeen: lastDoc?.ts ?? null,
          secondsAgo,
          source: lastDoc?.source ?? "unknown",
          dataPoints: count,
          status: isOnline ? "online" : "offline",
        };
      })
    );
    
    // Sort: online devices first, then by last seen (most recent first)
    deviceStats.sort((a, b) => {
      // Online devices come first
      if (a.status === "online" && b.status !== "online") return -1;
      if (a.status !== "online" && b.status === "online") return 1;
      // Then sort by last seen
      if (!a.lastSeen) return 1;
      if (!b.lastSeen) return -1;
      return new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime();
    });

    // Count online devices
    const onlineCount = deviceStats.filter(d => d.status === "online").length;

    return NextResponse.json({
      devices: deviceStats,
      count: deviceStats.length,
      onlineCount,
      timestamp: new Date().toISOString(),
    });
  } catch (e: any) {
    return NextResponse.json(
      {
        error: "Failed to load devices",
        message: e?.message ?? String(e),
      },
      { status: 500 }
    );
  }
}
