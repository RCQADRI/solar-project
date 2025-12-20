import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getDb } from "@/lib/mongodb";
import { COLLECTION_TELEMETRY } from "@/lib/telemetry";

/**
 * GET /api/telemetry/devices
 * 
 * Returns a list of all unique device IDs that have sent telemetry data.
 * This enables the dashboard to show a dynamic device selector.
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
    
    // Get distinct device IDs
    const deviceIds = await col.distinct("deviceId");
    
    // Filter out null/undefined and get device stats
    const validDevices = deviceIds.filter((id): id is string => typeof id === "string" && id.length > 0);
    
    // Get additional info for each device (last seen, source type)
    const deviceStats = await Promise.all(
      validDevices.map(async (deviceId) => {
        const lastDoc = await col.findOne(
          { deviceId },
          { sort: { ts: -1 }, projection: { ts: 1, source: 1 } }
        );
        
        const count = await col.countDocuments({ deviceId });
        
        return {
          deviceId,
          lastSeen: lastDoc?.ts ?? null,
          source: lastDoc?.source ?? "unknown",
          dataPoints: count,
        };
      })
    );
    
    // Sort by last seen (most recent first)
    deviceStats.sort((a, b) => {
      if (!a.lastSeen) return 1;
      if (!b.lastSeen) return -1;
      return new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime();
    });

    return NextResponse.json({
      devices: deviceStats,
      count: deviceStats.length,
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
