import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getDb } from "@/lib/mongodb";
import { COLLECTION_TELEMETRY } from "@/lib/telemetry";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Get deviceId from query params (optional filter)
    const { searchParams } = new URL(request.url);
    const deviceIdFilter = searchParams.get("deviceId");

    const now = new Date();
    const start = new Date(now);
    start.setMinutes(start.getMinutes() - 10);

    const db = await getDb();
    
    // Build query - filter by deviceId if provided
    const query: Record<string, unknown> = { ts: { $gte: start } };
    if (deviceIdFilter) {
      query.deviceId = deviceIdFilter;
    }
    
    const docs = await db
      .collection(COLLECTION_TELEMETRY)
      .find(query, { sort: { ts: 1 } })
      .limit(1000)
      .toArray();

    // Determine source - if any doc has hardware source, mark as hardware
    const hasHardware = docs.some((d) => d.source === "hardware");
    const source = hasHardware ? "hardware" : "mongodb";

    return NextResponse.json({
      points: docs.map((d) => ({ 
        ts: d.ts, 
        voltage: d.voltage, 
        current: d.current, 
        power: d.power,
        deviceId: d.deviceId 
      })),
      source,
      count: docs.length,
      deviceId: deviceIdFilter,
    });
  } catch (e: any) {
    return NextResponse.json(
      {
        error: "Failed to load live telemetry",
        message: e?.message ?? String(e),
      },
      { status: 500 }
    );
  }
}
