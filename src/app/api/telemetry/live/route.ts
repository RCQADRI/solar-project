import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getDb } from "@/lib/mongodb";
import { COLLECTION_TELEMETRY } from "@/lib/telemetry";

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const now = new Date();
    const start = new Date(now);
    start.setMinutes(start.getMinutes() - 10);

    const db = await getDb();
    const docs = await db
      .collection(COLLECTION_TELEMETRY)
      .find({ ts: { $gte: start } }, { sort: { ts: 1 } })
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
