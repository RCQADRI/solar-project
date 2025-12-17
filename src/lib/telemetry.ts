import { z } from "zod";

export const TelemetryPointSchema = z.object({
  ts: z.coerce.date(),
  voltage: z.number(),
  current: z.number(),
  power: z.number(),
});

export type TelemetryPoint = z.infer<typeof TelemetryPointSchema>;

export const COLLECTION_TELEMETRY = "telemetry" as const;
