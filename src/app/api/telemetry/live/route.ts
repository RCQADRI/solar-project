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

    const now = new Date();
    const start = new Date(now);
    start.setMinutes(start.getMinutes() - 10);

    try {
      const db = await getDb();
      const docs = await db
        .collection(COLLECTION_TELEMETRY)
        .find({ ts: { $gte: start } }, { sort: { ts: 1 } })
        .limit(1000)
        .toArray();

      if (!docs.length) return NextResponse.json({ error: "No telemetry" }, { status: 404 });

      return NextResponse.json({
        points: docs.map((d) => ({ ts: d.ts, voltage: d.voltage, current: d.current, power: d.power })),
        source: "mongodb",
      });
    } catch {
      const points = getOrCreateDemoTelemetry().filter((p) => p.ts >= start);
      return NextResponse.json({
        points: points.map((p) => ({ ts: p.ts, voltage: p.voltage, current: p.current, power: p.power })),
        source: "demo",
      });
    }
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
