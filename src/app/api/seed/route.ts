import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { COLLECTION_TELEMETRY } from "@/lib/telemetry";
import { resetDemoTelemetry } from "@/lib/demo-telemetry-store";

function rand(min: number, max: number) {
  return min + Math.random() * (max - min);
}

export async function POST() {
  try {
    const now = new Date();

    const start = new Date(now);
    start.setHours(start.getHours() - 24);
    const liveStart = new Date(now);
    liveStart.setMinutes(liveStart.getMinutes() - 10);

    const points: any[] = [];

    // 24h history at 60s resolution (excluding last 10 minutes).
    for (let t = new Date(start); t < liveStart; t = new Date(t.getTime() + 60_000)) {

      // Dynamic demo values: regenerate fresh random values on each seed.
      // Voltage: 12V–20V, Current: 0.5A–5A
      const voltage = rand(12, 20);
      const current = rand(0.5, 5);
      const power = voltage * current;
      points.push({ 
        ts: t, 
        voltage: Number(voltage.toFixed(2)), 
        current: Number(current.toFixed(2)), 
        power: Number(power.toFixed(2)),
        source: "demo",
        deviceId: "Demo-Device"
      });
    }

    // Last 10 minutes at 10s resolution.
    for (let t = new Date(liveStart); t <= now; t = new Date(t.getTime() + 10_000)) {

      const voltage = rand(12, 20);
      const current = rand(0.5, 5);
      const power = voltage * current;
      points.push({ 
        ts: t, 
        voltage: Number(voltage.toFixed(2)), 
        current: Number(current.toFixed(2)), 
        power: Number(power.toFixed(2)),
        source: "demo",
        deviceId: "Demo-Device"
      });
    }

    try {
      const db = await getDb();
      const col = db.collection(COLLECTION_TELEMETRY);
      // Only delete existing demo data, preserve real hardware data
      await col.deleteMany({ source: "demo" });
      await col.insertMany(points);
      await col.createIndex({ ts: -1 });
      return NextResponse.json({ ok: true, inserted: points.length, source: "mongodb" });
    } catch {
      // MongoDB unavailable: still provide demo data by caching in-memory.
      resetDemoTelemetry();
      return NextResponse.json({ ok: true, inserted: points.length, source: "demo" });
    }
  } catch (e: any) {
    return NextResponse.json(
      {
        error: "Failed to seed demo telemetry",
        message: e?.message ?? String(e),
      },
      { status: 500 }
    );
  }
}
