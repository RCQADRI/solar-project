"use client";

import * as React from "react";
import {
  Area,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";
import { CreditFooter } from "@/components/credit-footer";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Point = { ts: string; voltage: number; current: number; power: number };

async function safeReadJson(res: Response) {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

function formatTimeLabel(ts: string) {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatTimeLabelSeconds(ts: string) {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function MetricTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;

  // When we render both an Area (fill) and a Line for the same dataKey (e.g. `power`),
  // Recharts can provide duplicate payload entries. Dedupe so UI stays clean.
  const uniquePayload = (payload as any[]).filter((p, idx, arr) => {
    const key = String(p?.dataKey ?? "");
    return arr.findIndex((x) => String(x?.dataKey ?? "") === key) === idx;
  });

  return (
    <div className="rounded-xl border border-border bg-popover/95 px-3 py-2 text-sm shadow-md backdrop-blur">
      <div className="pb-1 font-medium text-popover-foreground">{label}</div>
      <div className="space-y-0.5">
        {uniquePayload.map((p: any, i: number) => (
          <div key={`${p.dataKey ?? "k"}-${p.name ?? "n"}-${i}`} className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground" style={{ color: p.color }}>
              {p.name}
            </span>
            <span className="tabular-nums text-popover-foreground">
              {Number(p.value).toFixed(2)}
              {p.dataKey === "voltage" ? " V" : p.dataKey === "current" ? " A" : " W"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function DashboardClient({ email }: { email: string }) {
  const [mounted, setMounted] = React.useState(false);

  const [device, setDevice] = React.useState("demo-1");
  const [latest, setLatest] = React.useState<Point | null>(null);
  const [hourly, setHourly] = React.useState<Point[]>([]);
  const [live, setLive] = React.useState<Point[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const seededOnceRef = React.useRef(false);

  async function seedDemo() {
    const res = await fetch("/api/seed", { method: "POST" });
    if (!res.ok) {
      const body = await safeReadJson(res);
      const msg = body?.message ?? body?.error ?? `Seed failed (${res.status})`;
      throw new Error(msg);
    }
  }

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const fetchBoth = async () => {
        const [latestRes, hourlyRes, liveRes] = await Promise.all([
          fetch("/api/telemetry/latest", { cache: "no-store" }),
          fetch("/api/telemetry/hourly", { cache: "no-store" }),
          fetch("/api/telemetry/live", { cache: "no-store" }),
        ]);
        return { latestRes, hourlyRes, liveRes };
      };

      let { latestRes, hourlyRes, liveRes } = await fetchBoth();

      // If telemetry is empty, seed demo data once so charts show immediately.
      if (
        !seededOnceRef.current &&
        (latestRes.status === 404 || hourlyRes.status === 404 || liveRes.status === 404)
      ) {
        seededOnceRef.current = true;
        await seedDemo();
        ({ latestRes, hourlyRes, liveRes } = await fetchBoth());
      }

      if (!latestRes.ok) {
        const body = await safeReadJson(latestRes);
        const msg = body?.message ?? body?.error ?? `Failed to load latest (${latestRes.status})`;
        throw new Error(msg);
      }
      if (!hourlyRes.ok) {
        const body = await safeReadJson(hourlyRes);
        const msg = body?.message ?? body?.error ?? `Failed to load hourly (${hourlyRes.status})`;
        throw new Error(msg);
      }
      if (!liveRes.ok) {
        const body = await safeReadJson(liveRes);
        const msg = body?.message ?? body?.error ?? `Failed to load live (${liveRes.status})`;
        throw new Error(msg);
      }

      const latestJson = (await safeReadJson(latestRes)) ?? {};
      const hourlyJson = (await safeReadJson(hourlyRes)) ?? {};
      const liveJson = (await safeReadJson(liveRes)) ?? {};
      const points: Point[] = hourlyJson.points ?? [];
      const livePoints: Point[] = liveJson.points ?? [];

      if (!seededOnceRef.current && points.length === 0) {
        seededOnceRef.current = true;
        await seedDemo();
        ({ latestRes, hourlyRes, liveRes } = await fetchBoth());
        if (!latestRes.ok) {
          const body = await safeReadJson(latestRes);
          const msg = body?.message ?? body?.error ?? `Failed to load latest (${latestRes.status})`;
          throw new Error(msg);
        }
        if (!hourlyRes.ok) {
          const body = await safeReadJson(hourlyRes);
          const msg = body?.message ?? body?.error ?? `Failed to load hourly (${hourlyRes.status})`;
          throw new Error(msg);
        }
        if (!liveRes.ok) {
          const body = await safeReadJson(liveRes);
          const msg = body?.message ?? body?.error ?? `Failed to load live (${liveRes.status})`;
          throw new Error(msg);
        }
        const latestJson2 = (await safeReadJson(latestRes)) ?? {};
        const hourlyJson2 = (await safeReadJson(hourlyRes)) ?? {};
        const liveJson2 = (await safeReadJson(liveRes)) ?? {};
        setLatest({ ts: latestJson2.ts, voltage: latestJson2.voltage, current: latestJson2.current, power: latestJson2.power });
        setHourly(hourlyJson2.points ?? []);
        setLive(liveJson2.points ?? []);
        return;
      }

      setLatest({ ts: latestJson.ts, voltage: latestJson.voltage, current: latestJson.current, power: latestJson.power });
      setHourly(points);
      setLive(livePoints);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    setMounted(true);
    void load();
    const id = window.setInterval(() => void load(), 10_000);
    return () => window.clearInterval(id);
  }, [load]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  const liveData = React.useMemo(() => {
    return (live ?? []).map((p) => ({ ...p, label: formatTimeLabelSeconds(p.ts) }));
  }, [live]);

  const hourlyData = React.useMemo(() => {
    return (hourly ?? []).map((p) => ({ ...p, label: formatTimeLabel(p.ts) }));
  }, [hourly]);

  const colors = React.useMemo(
    () => ({
      voltage: "var(--chart-2)",
      current: "var(--chart-3)",
      power: "var(--chart-4)",
      grid: "var(--border)",
      muted: "var(--muted-foreground)",
    }),
    []
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/30 p-4 md:p-8">
      <div className="mx-auto max-w-6xl space-y-6 animate-in fade-in-0 slide-in-from-bottom-2 duration-500 motion-reduce:animate-none">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
            <p className="text-sm text-muted-foreground">Logged in as {email}</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Device</span>
              {!mounted ? (
                <div className="h-9 w-[260px] rounded-md border border-border bg-card/40" />
              ) : (
                <Select value={device} onValueChange={setDevice}>
                  <SelectTrigger className="w-[260px] transition-colors">
                    <SelectValue placeholder="Select device" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="demo-1">Demo Device 1 (demo-site)</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <Button variant="outline" onClick={logout}>
                Logout
              </Button>
            </div>
          </div>
        </div>

        {error ? (
          <Card className="hover:translate-y-0">
            <CardContent className="pt-6">
              <p className="text-sm text-red-600">{error}</p>
              <div className="pt-4">
                <Button onClick={load}>Retry</Button>
              </div>
            </CardContent>
          </Card>
        ) : null}

        <div className="grid gap-4 md:grid-cols-3">
          <Card className="bg-card/60 backdrop-blur animate-in fade-in-0 slide-in-from-bottom-2 duration-500 delay-75 motion-reduce:animate-none">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Voltage</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold tabular-nums">
                {loading || !latest ? "—" : `${latest.voltage.toFixed(2)} V`}
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card/60 backdrop-blur animate-in fade-in-0 slide-in-from-bottom-2 duration-500 delay-150 motion-reduce:animate-none">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Current</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold tabular-nums">
                {loading || !latest ? "—" : `${latest.current.toFixed(2)} A`}
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card/60 backdrop-blur animate-in fade-in-0 slide-in-from-bottom-2 duration-500 delay-200 motion-reduce:animate-none">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Power</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold tabular-nums">
                {loading || !latest ? "—" : `${latest.power.toFixed(2)} W`}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="bg-card/60 backdrop-blur animate-in fade-in-0 slide-in-from-bottom-2 duration-500 delay-300 motion-reduce:animate-none">
            <CardHeader>
              <CardTitle>Live (last ~10 minutes @ 10s)</CardTitle>
            </CardHeader>
            <CardContent className="h-[360px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={liveData} margin={{ left: 8, right: 8, top: 12, bottom: 0 }}>
                  <defs>
                    <linearGradient id="powerFillLive" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={colors.power} stopOpacity={0.22} />
                      <stop offset="90%" stopColor={colors.power} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke={colors.grid} strokeOpacity={0.55} strokeDasharray="4 6" />
                  <XAxis dataKey="label" tick={{ fill: colors.muted, fontSize: 12 }} axisLine={{ stroke: colors.grid, opacity: 0.6 }} tickLine={false} />
                  <YAxis tick={{ fill: colors.muted, fontSize: 12 }} axisLine={{ stroke: colors.grid, opacity: 0.6 }} tickLine={false} />
                  <Tooltip
                    content={<MetricTooltip />}
                    cursor={{ stroke: colors.grid, strokeOpacity: 0.6, strokeDasharray: "3 6" }}
                  />
                  <Legend wrapperStyle={{ color: colors.muted }} />
                  <Area
                    type="monotone"
                    dataKey="power"
                    stroke="none"
                    fill="url(#powerFillLive)"
                    isAnimationActive={!loading}
                    legendType="none"
                  />
                  <Line
                    name="Voltage"
                    type="monotone"
                    dataKey="voltage"
                    stroke={colors.voltage}
                    dot={false}
                    strokeWidth={2.5}
                    activeDot={{ r: 4, stroke: colors.voltage, strokeWidth: 2, fill: "var(--background)" }}
                  />
                  <Line
                    name="Current"
                    type="monotone"
                    dataKey="current"
                    stroke={colors.current}
                    dot={false}
                    strokeWidth={2.5}
                    activeDot={{ r: 4, stroke: colors.current, strokeWidth: 2, fill: "var(--background)" }}
                  />
                  <Line
                    name="Power"
                    type="monotone"
                    dataKey="power"
                    stroke={colors.power}
                    dot={false}
                    strokeWidth={2.5}
                    activeDot={{ r: 4, stroke: colors.power, strokeWidth: 2, fill: "var(--background)" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="bg-card/60 backdrop-blur animate-in fade-in-0 slide-in-from-bottom-2 duration-500 delay-400 motion-reduce:animate-none">
            <CardHeader>
              <CardTitle>Hourly (last 24h)</CardTitle>
            </CardHeader>
            <CardContent className="h-[360px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={hourlyData} margin={{ left: 8, right: 8, top: 12, bottom: 0 }}>
                  <defs>
                    <linearGradient id="powerFillHourly" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={colors.power} stopOpacity={0.18} />
                      <stop offset="90%" stopColor={colors.power} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke={colors.grid} strokeOpacity={0.55} strokeDasharray="4 6" />
                  <XAxis dataKey="label" tick={{ fill: colors.muted, fontSize: 12 }} axisLine={{ stroke: colors.grid, opacity: 0.6 }} tickLine={false} />
                  <YAxis tick={{ fill: colors.muted, fontSize: 12 }} axisLine={{ stroke: colors.grid, opacity: 0.6 }} tickLine={false} />
                  <Tooltip
                    content={<MetricTooltip />}
                    cursor={{ stroke: colors.grid, strokeOpacity: 0.6, strokeDasharray: "3 6" }}
                  />
                  <Legend wrapperStyle={{ color: colors.muted }} />
                  <Area
                    type="monotone"
                    dataKey="power"
                    stroke="none"
                    fill="url(#powerFillHourly)"
                    isAnimationActive={!loading}
                    legendType="none"
                  />
                  <Line
                    name="Voltage"
                    type="monotone"
                    dataKey="voltage"
                    stroke={colors.voltage}
                    dot={false}
                    strokeWidth={2.5}
                    activeDot={{ r: 4, stroke: colors.voltage, strokeWidth: 2, fill: "var(--background)" }}
                  />
                  <Line
                    name="Current"
                    type="monotone"
                    dataKey="current"
                    stroke={colors.current}
                    dot={false}
                    strokeWidth={2.5}
                    activeDot={{ r: 4, stroke: colors.current, strokeWidth: 2, fill: "var(--background)" }}
                  />
                  <Line
                    name="Power"
                    type="monotone"
                    dataKey="power"
                    stroke={colors.power}
                    dot={false}
                    strokeWidth={2.5}
                    activeDot={{ r: 4, stroke: colors.power, strokeWidth: 2, fill: "var(--background)" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        <div className="flex gap-2">
          <Button onClick={load} variant="outline">
            Refresh
          </Button>
          <Button
            onClick={async () => {
              seededOnceRef.current = true;
              await seedDemo();
              await load();
            }}
          >
            Seed Demo Data
          </Button>
        </div>

        <CreditFooter className="pt-6" />
      </div>
    </div>
  );
}
