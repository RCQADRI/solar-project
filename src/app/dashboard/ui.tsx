"use client";

import * as React from "react";
import {
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
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-sm shadow">
      <div className="pb-1 font-medium text-popover-foreground">{label}</div>
      <div className="space-y-0.5">
        {payload.map((p: any) => (
          <div key={p.dataKey} className="flex items-center justify-between gap-4">
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
              <Select value={device} onValueChange={setDevice}>
                <SelectTrigger className="w-[260px] transition-colors">
                  <SelectValue placeholder="Select device" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="demo-1">Demo Device 1 (demo-site)</SelectItem>
                </SelectContent>
              </Select>
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
          <Card className="bg-card/60 backdrop-blur">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Voltage</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold tabular-nums">
                {loading || !latest ? "—" : `${latest.voltage.toFixed(2)} V`}
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card/60 backdrop-blur">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Current</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold tabular-nums">
                {loading || !latest ? "—" : `${latest.current.toFixed(2)} A`}
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card/60 backdrop-blur">
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
          <Card className="bg-card/60 backdrop-blur">
            <CardHeader>
              <CardTitle>Live (last ~10 minutes @ 10s)</CardTitle>
            </CardHeader>
            <CardContent className="h-[360px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={liveData} margin={{ left: 8, right: 8, top: 12, bottom: 0 }}>
                  <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="4 4" />
                  <XAxis dataKey="label" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                  <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                  <Tooltip content={<MetricTooltip />} />
                  <Legend wrapperStyle={{ color: "hsl(var(--muted-foreground))" }} />
                  <Line name="Voltage" type="monotone" dataKey="voltage" stroke="hsl(var(--chart-2))" dot={false} strokeWidth={2} />
                  <Line name="Current" type="monotone" dataKey="current" stroke="hsl(var(--chart-3))" dot={false} strokeWidth={2} />
                  <Line name="Power" type="monotone" dataKey="power" stroke="hsl(var(--chart-4))" dot={false} strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="bg-card/60 backdrop-blur">
            <CardHeader>
              <CardTitle>Hourly (last 24h)</CardTitle>
            </CardHeader>
            <CardContent className="h-[360px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={hourlyData} margin={{ left: 8, right: 8, top: 12, bottom: 0 }}>
                  <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="4 4" />
                  <XAxis dataKey="label" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                  <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                  <Tooltip content={<MetricTooltip />} />
                  <Legend wrapperStyle={{ color: "hsl(var(--muted-foreground))" }} />
                  <Line name="Voltage" type="monotone" dataKey="voltage" stroke="hsl(var(--chart-2))" dot={false} strokeWidth={2} />
                  <Line name="Current" type="monotone" dataKey="current" stroke="hsl(var(--chart-3))" dot={false} strokeWidth={2} />
                  <Line name="Power" type="monotone" dataKey="power" stroke="hsl(var(--chart-4))" dot={false} strokeWidth={2} />
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
      </div>
    </div>
  );
}
