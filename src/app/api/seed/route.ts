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
      const hour = t.getHours() + t.getMinutes() / 60;
      const daylight = Math.max(0, Math.sin(((hour - 6) / 12) * Math.PI));
      const voltage = 18 + daylight * 6 + rand(-0.6, 0.6);
      const current = daylight * 8 + rand(0, 0.6);
      const power = voltage * current;
      points.push({ ts: t, voltage: Number(voltage.toFixed(2)), current: Number(current.toFixed(2)), power: Number(power.toFixed(2)) });
    }

    // Last 10 minutes at 10s resolution.
    for (let t = new Date(liveStart); t <= now; t = new Date(t.getTime() + 10_000)) {
      const hour = t.getHours() + t.getMinutes() / 60;
      const daylight = Math.max(0, Math.sin(((hour - 6) / 12) * Math.PI));
      const wobble = Math.sin(t.getTime() / 30_000) * 0.5;
      const voltage = 18 + daylight * 6 + wobble + rand(-0.3, 0.3);
      const current = daylight * 8 + wobble * 0.4 + rand(0, 0.4);
      const power = voltage * current;
      points.push({ ts: t, voltage: Number(voltage.toFixed(2)), current: Number(current.toFixed(2)), power: Number(power.toFixed(2)) });
    }

    try {
      const db = await getDb();
      const col = db.collection(COLLECTION_TELEMETRY);
      await col.deleteMany({});
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
