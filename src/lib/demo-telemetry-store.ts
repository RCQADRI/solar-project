type TelemetryPoint = {
  ts: Date;
  voltage: number;
  current: number;
  power: number;
};

let cached: TelemetryPoint[] | null = null;

function rand(min: number, max: number) {
  return min + Math.random() * (max - min);
}

export function generateDemoTelemetry(now = new Date()) {
  const start = new Date(now);
  start.setHours(start.getHours() - 24);

  const liveStart = new Date(now);
  liveStart.setMinutes(liveStart.getMinutes() - 10);

  const points: TelemetryPoint[] = [];

  // 24h history at 60s resolution (excluding last 10 minutes).
  for (let t = new Date(start); t < liveStart; t = new Date(t.getTime() + 60_000)) {
    const hour = t.getHours() + t.getMinutes() / 60;
    const daylight = Math.max(0, Math.sin(((hour - 6) / 12) * Math.PI));
    const voltage = 18 + daylight * 6 + rand(-0.6, 0.6);
    const current = daylight * 8 + rand(0, 0.6);
    const power = voltage * current;
    points.push({
      ts: t,
      voltage: Number(voltage.toFixed(2)),
      current: Number(current.toFixed(2)),
      power: Number(power.toFixed(2)),
    });
  }

  // Last 10 minutes at 10s resolution ("live" feel).
  for (let t = new Date(liveStart); t <= now; t = new Date(t.getTime() + 10_000)) {
    const hour = t.getHours() + t.getMinutes() / 60;
    const daylight = Math.max(0, Math.sin(((hour - 6) / 12) * Math.PI));
    const wobble = Math.sin(t.getTime() / 30_000) * 0.5;
    const voltage = 18 + daylight * 6 + wobble + rand(-0.3, 0.3);
    const current = daylight * 8 + wobble * 0.4 + rand(0, 0.4);
    const power = voltage * current;
    points.push({
      ts: t,
      voltage: Number(voltage.toFixed(2)),
      current: Number(current.toFixed(2)),
      power: Number(power.toFixed(2)),
    });
  }

  return points;
}

export function getOrCreateDemoTelemetry() {
  if (!cached) cached = generateDemoTelemetry();
  return cached;
}

export function resetDemoTelemetry() {
  cached = generateDemoTelemetry();
  return cached;
}
