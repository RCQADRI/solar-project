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

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function daylightAt(t: Date, shiftHours: number) {
  const hour = t.getHours() + t.getMinutes() / 60;
  const shifted = (hour + shiftHours + 24) % 24;
  return Math.max(0, Math.sin(((shifted - 6) / 12) * Math.PI));
}

export function generateDemoTelemetry(now = new Date()) {
  // Phase-shift the simulated daylight curve so "now" is near midday.
  // This keeps the dashboard from looking empty (all zeros) when viewing at night.
  const nowHour = now.getHours() + now.getMinutes() / 60;
  const shiftHours = 12 - nowHour;

  const start = new Date(now);
  start.setHours(start.getHours() - 24);

  const liveStart = new Date(now);
  liveStart.setMinutes(liveStart.getMinutes() - 10);

  const points: TelemetryPoint[] = [];

  // Project target: ~5W panel.
  // We'll model a simple daylight curve: power peaks around 5W at midday,
  // with voltage roughly 5–6.5V and current derived from P/V.
  const maxPowerW = 5;

  // 24h history at 60s resolution (excluding last 10 minutes).
  for (let t = new Date(start); t < liveStart; t = new Date(t.getTime() + 60_000)) {
    const daylight = daylightAt(t, shiftHours);

    let voltage = 0;
    let current = 0;
    let power = 0;

    if (daylight > 0.02) {
      voltage = clamp(5.2 + daylight * 1.1 + rand(-0.12, 0.12), 4.8, 6.7);
      const targetPower = clamp(maxPowerW * daylight + rand(-0.15, 0.15), 0, maxPowerW);
      current = clamp(targetPower / voltage + rand(-0.02, 0.02), 0, 1.2);
      power = clamp(voltage * current, 0, maxPowerW);
    }
    points.push({
      ts: t,
      voltage: Number(voltage.toFixed(2)),
      current: Number(current.toFixed(2)),
      power: Number(power.toFixed(2)),
    });
  }

  // Last 10 minutes at 10s resolution ("live" feel).
  for (let t = new Date(liveStart); t <= now; t = new Date(t.getTime() + 10_000)) {
    const daylight = daylightAt(t, shiftHours);

    let voltage = 0;
    let current = 0;
    let power = 0;

    if (daylight > 0.02) {
      const wobble = Math.sin(t.getTime() / 25_000) * 0.08;
      voltage = clamp(5.2 + daylight * 1.1 + wobble + rand(-0.1, 0.1), 4.8, 6.7);
      const targetPower = clamp(maxPowerW * daylight + wobble * 0.4 + rand(-0.15, 0.15), 0, maxPowerW);
      current = clamp(targetPower / voltage + rand(-0.02, 0.02), 0, 1.2);
      power = clamp(voltage * current, 0, maxPowerW);
    }
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
