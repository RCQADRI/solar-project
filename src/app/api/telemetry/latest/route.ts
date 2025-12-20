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

    const db = await getDb();
    
    // Build query - filter by deviceId if provided
    const query = deviceIdFilter ? { deviceId: deviceIdFilter } : {};
    const doc = await db.collection(COLLECTION_TELEMETRY).findOne(query, { sort: { ts: -1 } });
    
    if (!doc) {
      return NextResponse.json({ 
        error: "No telemetry data",
        message: deviceIdFilter 
          ? `No data for device "${deviceIdFilter}". Connect hardware or select a different device.`
          : "No data available. Connect hardware or use 'Seed Demo Data' button."
      }, { status: 404 });
    }

    // Determine source based on document properties
    const source = doc.source === "hardware" ? "hardware" : "mongodb";
    
    return NextResponse.json({
      ts: doc.ts,
      voltage: doc.voltage,
      current: doc.current,
      power: doc.power,
      deviceId: doc.deviceId,
      source,
    });
  } catch (e: any) {
    return NextResponse.json(
      {
        error: "Failed to load latest telemetry",
        message: e?.message ?? String(e),
      },
      { status: 500 }
    );
  }
}
