import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/mongodb";
import { COLLECTION_TELEMETRY } from "@/lib/telemetry";
import { getServerEnv } from "@/lib/env";

// Validation schema for incoming telemetry data from ESP32/hardware
const IngestPayloadSchema = z.object({
  // Device identifier (optional, defaults to 'hardware-1')
  deviceId: z.string().min(1).max(50).optional().default("hardware-1"),
  
  // Core telemetry data
  voltage: z.number().min(0).max(1000), // Volts (0-1000V range)
  current: z.number().min(0).max(100),   // Amps (0-100A range)
  power: z.number().min(0).max(100000).optional(), // Watts (auto-calculated if not provided)
  
  // Optional timestamp (ISO string or Unix ms). Defaults to server time.
  ts: z.union([z.string().datetime(), z.number()]).optional(),
  
  // Optional extra metadata
  temperature: z.number().min(-50).max(150).optional(), // Panel temp in Celsius
  batteryLevel: z.number().min(0).max(100).optional(),  // Battery percentage
  solarIrradiance: z.number().min(0).max(2000).optional(), // W/m²
});

export type IngestPayload = z.infer<typeof IngestPayloadSchema>;

// Rate limiting: simple in-memory store (resets on server restart)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 120; // 120 requests per minute (2 per second)

function checkRateLimit(deviceId: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const entry = rateLimitMap.get(deviceId);
  
  if (!entry || now > entry.resetTime) {
    rateLimitMap.set(deviceId, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - 1 };
  }
  
  if (entry.count >= RATE_LIMIT_MAX_REQUESTS) {
    return { allowed: false, remaining: 0 };
  }
  
  entry.count++;
  return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - entry.count };
}

/**
 * POST /api/telemetry/ingest
 * 
 * Hardware Data Ingestion Endpoint for ESP32/IoT devices
 * 
 * Headers:
 *   - X-API-Key: Your secret INGEST_API_KEY (required)
 *   - Content-Type: application/json
 * 
 * Body (JSON):
 *   {
 *     "deviceId": "esp32-solar-01",  // optional, defaults to "hardware-1"
 *     "voltage": 24.5,               // required, in Volts
 *     "current": 5.2,                // required, in Amps
 *     "power": 127.4,                // optional, auto-calculated as V*A
 *     "ts": "2024-01-15T10:30:00Z",  // optional, defaults to server time
 *     "temperature": 45.2,           // optional, panel temp in Celsius
 *     "batteryLevel": 85,            // optional, battery percentage
 *     "solarIrradiance": 850         // optional, W/m²
 *   }
 * 
 * Response:
 *   - 200: Success with saved data
 *   - 400: Invalid payload
 *   - 401: Missing or invalid API key
 *   - 429: Rate limit exceeded
 *   - 500: Server error
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Verify API Key
    const env = getServerEnv();
    const apiKey = request.headers.get("X-API-Key") || request.headers.get("x-api-key");
    
    if (!env.INGEST_API_KEY) {
      return NextResponse.json(
        { 
          error: "Ingestion not configured",
          message: "INGEST_API_KEY is not set in environment variables"
        },
        { status: 503 }
      );
    }
    
    if (!apiKey) {
      return NextResponse.json(
        { error: "Unauthorized", message: "Missing X-API-Key header" },
        { status: 401 }
      );
    }
    
    if (apiKey !== env.INGEST_API_KEY) {
      return NextResponse.json(
        { error: "Unauthorized", message: "Invalid API key" },
        { status: 401 }
      );
    }
    
    // 2. Parse and validate request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Bad Request", message: "Invalid JSON body" },
        { status: 400 }
      );
    }
    
    const parseResult = IngestPayloadSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { 
          error: "Validation Error", 
          message: "Invalid payload format",
          details: parseResult.error.flatten().fieldErrors
        },
        { status: 400 }
      );
    }
    
    const payload = parseResult.data;
    
    // 3. Check rate limit
    const rateCheck = checkRateLimit(payload.deviceId);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { 
          error: "Rate Limit Exceeded",
          message: `Too many requests. Max ${RATE_LIMIT_MAX_REQUESTS} per minute.`
        },
        { 
          status: 429,
          headers: {
            "Retry-After": "60",
            "X-RateLimit-Limit": String(RATE_LIMIT_MAX_REQUESTS),
            "X-RateLimit-Remaining": "0"
          }
        }
      );
    }
    
    // 4. Prepare document for MongoDB
    const now = new Date();
    let timestamp: Date;
    
    if (payload.ts) {
      timestamp = typeof payload.ts === "number" 
        ? new Date(payload.ts) 
        : new Date(payload.ts);
    } else {
      timestamp = now;
    }
    
    // Auto-calculate power if not provided
    const power = payload.power ?? (payload.voltage * payload.current);
    
    const document = {
      ts: timestamp,
      deviceId: payload.deviceId,
      voltage: payload.voltage,
      current: payload.current,
      power: Math.round(power * 1000) / 1000, // Round to 3 decimal places
      ...(payload.temperature !== undefined && { temperature: payload.temperature }),
      ...(payload.batteryLevel !== undefined && { batteryLevel: payload.batteryLevel }),
      ...(payload.solarIrradiance !== undefined && { solarIrradiance: payload.solarIrradiance }),
      ingestedAt: now,
      source: "hardware"
    };
    
    // 5. Save to MongoDB
    const db = await getDb();
    const result = await db.collection(COLLECTION_TELEMETRY).insertOne(document);
    
    return NextResponse.json(
      {
        success: true,
        message: "Telemetry data saved successfully",
        data: {
          id: result.insertedId.toString(),
          ts: timestamp.toISOString(),
          deviceId: payload.deviceId,
          voltage: payload.voltage,
          current: payload.current,
          power: document.power
        }
      },
      { 
        status: 200,
        headers: {
          "X-RateLimit-Limit": String(RATE_LIMIT_MAX_REQUESTS),
          "X-RateLimit-Remaining": String(rateCheck.remaining)
        }
      }
    );
    
  } catch (error: unknown) {
    console.error("[Ingest API Error]", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Internal Server Error", message },
      { status: 500 }
    );
  }
}

// GET endpoint for health check and documentation
export async function GET() {
  return NextResponse.json({
    status: "ok",
    endpoint: "/api/telemetry/ingest",
    method: "POST",
    description: "Hardware telemetry data ingestion endpoint",
    requiredHeaders: {
      "X-API-Key": "Your secret INGEST_API_KEY",
      "Content-Type": "application/json"
    },
    payloadSchema: {
      deviceId: "string (optional, default: 'hardware-1')",
      voltage: "number (required, 0-1000V)",
      current: "number (required, 0-100A)",
      power: "number (optional, auto-calculated as voltage * current)",
      ts: "string|number (optional, ISO timestamp or Unix ms)",
      temperature: "number (optional, -50 to 150°C)",
      batteryLevel: "number (optional, 0-100%)",
      solarIrradiance: "number (optional, 0-2000 W/m²)"
    },
    examplePayload: {
      deviceId: "esp32-solar-01",
      voltage: 24.5,
      current: 5.2,
      temperature: 42.3
    },
    rateLimit: {
      maxRequests: RATE_LIMIT_MAX_REQUESTS,
      windowMs: RATE_LIMIT_WINDOW_MS,
      description: `${RATE_LIMIT_MAX_REQUESTS} requests per minute per device`
    }
  });
}
