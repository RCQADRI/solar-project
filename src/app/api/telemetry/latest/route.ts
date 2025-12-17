import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getDb } from "@/lib/mongodb";
import { COLLECTION_TELEMETRY } from "@/lib/telemetry";
import { getOrCreateDemoTelemetry } from "@/lib/demo-telemetry-store";

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
      const db = await getDb();
      const doc = await db.collection(COLLECTION_TELEMETRY).findOne({}, { sort: { ts: -1 } });
      if (!doc) return NextResponse.json({ error: "No telemetry" }, { status: 404 });

      return NextResponse.json({
        ts: doc.ts,
        voltage: doc.voltage,
        current: doc.current,
        power: doc.power,
        source: "mongodb",
      });
    } catch {
      const points = getOrCreateDemoTelemetry();
      const last = points[points.length - 1];
      return NextResponse.json({
        ts: last.ts,
        voltage: last.voltage,
        current: last.current,
        power: last.power,
        source: "demo",
      });
    }
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
