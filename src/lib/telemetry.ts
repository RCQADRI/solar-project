import { z } from "zod";

// Base telemetry point schema
export const TelemetryPointSchema = z.object({
  ts: z.coerce.date(),
  voltage: z.number(),
  current: z.number(),
  power: z.number(),
  deviceId: z.string().optional(),
  source: z.enum(["demo", "mongodb", "hardware"]).optional(),
});

// Extended schema with optional hardware metadata
export const TelemetryPointWithMetaSchema = TelemetryPointSchema.extend({
  temperature: z.number().optional(),
  batteryLevel: z.number().optional(),
  solarIrradiance: z.number().optional(),
  ingestedAt: z.coerce.date().optional(),
});

export type TelemetryPoint = z.infer<typeof TelemetryPointSchema>;
export type TelemetryPointWithMeta = z.infer<typeof TelemetryPointWithMetaSchema>;

export const COLLECTION_TELEMETRY = "telemetry" as const;
