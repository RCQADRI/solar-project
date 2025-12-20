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
    start.setHours(start.getHours() - 24);

    const db = await getDb();
    const col = db.collection(COLLECTION_TELEMETRY);
    
    // Check if we have any hardware data
    const hardwareCount = await col.countDocuments({ ts: { $gte: start }, source: "hardware" });
    const source = hardwareCount > 0 ? "hardware" : "mongodb";
    
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

    return NextResponse.json({ points: rows, source, count: rows.length });
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
