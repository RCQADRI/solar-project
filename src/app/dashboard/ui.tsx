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

// Live pulse indicator component
function LiveIndicator({ isLive, lastUpdate }: { isLive: boolean; lastUpdate: Date | null }) {
  const timeSince = lastUpdate ? Math.floor((Date.now() - lastUpdate.getTime()) / 1000) : null;
  const isStale = timeSince !== null && timeSince > 30; // Consider stale if > 30 seconds
  
  return (
    <div className="flex items-center gap-2">
      <div className="relative flex items-center">
        <span className={`flex h-2.5 w-2.5 rounded-full ${isStale ? 'bg-yellow-500' : isLive ? 'bg-green-500' : 'bg-gray-400'}`}>
          {isLive && !isStale && (
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
          )}
        </span>
      </div>
      <span className="text-xs text-muted-foreground">
        {isLive ? (isStale ? `Updated ${timeSince}s ago` : 'Live') : 'Connecting...'}
      </span>
    </div>
  );
}

// Data source badge component
function SourceBadge({ source }: { source?: string }) {
  const config = {
    hardware: { label: 'Hardware', color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20' },
    mongodb: { label: 'Database', color: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20' },
    demo: { label: 'Demo', color: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20' },
  };
  const { label, color } = config[source as keyof typeof config] ?? config.demo;
  
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${color}`}>
      {label}
    </span>
  );
}

type LatestData = Point & { source?: string; deviceId?: string };

export default function DashboardClient({ email }: { email: string }) {
  const [mounted, setMounted] = React.useState(false);

  const [latest, setLatest] = React.useState<LatestData | null>(null);
  const [hourly, setHourly] = React.useState<Point[]>([]);
  const [live, setLive] = React.useState<Point[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = React.useState<Date | null>(null);
  const [isLive, setIsLive] = React.useState(false);
  const [dataSource, setDataSource] = React.useState<string>("mongodb");
  const [deviceId, setDeviceId] = React.useState<string | null>(null);
  const [noData, setNoData] = React.useState(false);

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
      const [latestRes, hourlyRes, liveRes] = await Promise.all([
        fetch("/api/telemetry/latest", { cache: "no-store" }),
        fetch("/api/telemetry/hourly", { cache: "no-store" }),
        fetch("/api/telemetry/live", { cache: "no-store" }),
      ]);

      const latestJson = (await safeReadJson(latestRes)) ?? {};
      const hourlyJson = (await safeReadJson(hourlyRes)) ?? {};
      const liveJson = (await safeReadJson(liveRes)) ?? {};

      // Check if we have no data (404 from latest)
      if (latestRes.status === 404) {
        setNoData(true);
        setLatest(null);
        setHourly([]);
        setLive([]);
        setIsLive(false);
        return;
      }

      if (!latestRes.ok) {
        throw new Error(latestJson?.message ?? latestJson?.error ?? `Failed to load (${latestRes.status})`);
      }

      setNoData(false);
      
      // Set source and device info
      const source = latestJson.source ?? "mongodb";
      setDataSource(source);
      setDeviceId(latestJson.deviceId ?? null);
      
      // Set data
      setLatest({ 
        ts: latestJson.ts, 
        voltage: latestJson.voltage, 
        current: latestJson.current, 
        power: latestJson.power, 
        source: latestJson.source,
        deviceId: latestJson.deviceId 
      });
      setHourly(hourlyJson.points ?? []);
      setLive(liveJson.points ?? []);
      setLastUpdate(new Date());
      setIsLive(true);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load");
      setIsLive(false);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    setMounted(true);
    void load();
    // Polling every 5 seconds for real-time updates
    const id = window.setInterval(() => void load(), 5_000);
    return () => window.clearInterval(id);
  }, [load]);

  // Update live indicator every second
  const [, forceUpdate] = React.useState(0);
  React.useEffect(() => {
    const id = window.setInterval(() => forceUpdate((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

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
            <h1 className="text-2xl font-semibold tracking-tight">Solar Monitoring Dashboard</h1>
            <p className="text-sm text-muted-foreground">Logged in as {email}</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="flex items-center gap-3">
              <LiveIndicator isLive={isLive && !noData} lastUpdate={lastUpdate} />
              <SourceBadge source={dataSource} />
              {deviceId && (
                <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-md">
                  {deviceId}
                </span>
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

        {/* No Data State */}
        {noData && !loading ? (
          <Card className="border-dashed">
            <CardContent className="py-12 text-center">
              <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium mb-2">No Telemetry Data</h3>
              <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
                Connect your ESP32/hardware to start receiving live data, or seed demo data to explore the dashboard.
              </p>
              <div className="flex gap-3 justify-center">
                <Button onClick={load} variant="outline">
                  <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Refresh
                </Button>
                <Button onClick={async () => { await seedDemo(); await load(); }}>
                  <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  Seed Demo Data
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : null}

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

        {/* Only show data cards when we have data */}
        {!noData && (
          <>
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
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Live (last ~10 minutes)</CardTitle>
                  <span className="text-xs text-muted-foreground">{live.length} points</span>
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
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Hourly (last 24h)</CardTitle>
              <span className="text-xs text-muted-foreground">{hourly.length} hours</span>
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

            <div className="flex gap-2 flex-wrap">
              <Button onClick={load} variant="outline">
                <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Refresh
              </Button>
              <Button variant="secondary" onClick={async () => { await seedDemo(); await load(); }}>
                <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                </svg>
                Seed Demo Data
              </Button>
            </div>
          </>
        )}

        <CreditFooter className="pt-6" />
      </div>
    </div>
  );
}
