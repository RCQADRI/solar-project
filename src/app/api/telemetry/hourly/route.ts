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
    start.setHours(start.getHours() - 24);

    try {
      const db = await getDb();
      const col = db.collection(COLLECTION_TELEMETRY);
      const rows = await col
        .aggregate([
          { $match: { ts: { $gte: start } } },
          {
            $group: {
              _id: {
                y: { $year: "$ts" },
                m: { $month: "$ts" },
                d: { $dayOfMonth: "$ts" },
                h: { $hour: "$ts" },
              },
              avgVoltage: { $avg: "$voltage" },
              avgCurrent: { $avg: "$current" },
              avgPower: { $avg: "$power" },
              lastTs: { $max: "$ts" },
            },
          },
          { $sort: { lastTs: 1 } },
          {
            $project: {
              _id: 0,
              ts: "$lastTs",
              voltage: { $round: ["$avgVoltage", 2] },
              current: { $round: ["$avgCurrent", 2] },
              power: { $round: ["$avgPower", 2] },
            },
          },
        ])
        .toArray();

      return NextResponse.json({ points: rows, source: "mongodb" });
    } catch {
      const points = getOrCreateDemoTelemetry().filter((p) => p.ts >= start);
      const byHour = new Map<string, { ts: Date; v: number; c: number; p: number; n: number }>();

      for (const pt of points) {
        const key = `${pt.ts.getFullYear()}-${pt.ts.getMonth()}-${pt.ts.getDate()}-${pt.ts.getHours()}`;
        const existing = byHour.get(key);
        if (!existing) {
          byHour.set(key, { ts: new Date(pt.ts), v: pt.voltage, c: pt.current, p: pt.power, n: 1 });
        } else {
          existing.ts = pt.ts;
          existing.v += pt.voltage;
          existing.c += pt.current;
          existing.p += pt.power;
          existing.n += 1;
        }
      }

      const rows = Array.from(byHour.values())
        .sort((a, b) => a.ts.getTime() - b.ts.getTime())
        .map((x) => ({
          ts: x.ts,
          voltage: Number((x.v / x.n).toFixed(2)),
          current: Number((x.c / x.n).toFixed(2)),
          power: Number((x.p / x.n).toFixed(2)),
        }));

      return NextResponse.json({ points: rows, source: "demo" });
    }
  } catch (e: any) {
    return NextResponse.json(
      {
        error: "Failed to load hourly telemetry",
        message: e?.message ?? String(e),
      },
      { status: 500 }
    );
  }
}
