import { NextRequest, NextResponse } from "next/server";
import { config } from "@/lib/config";

export async function GET(_: NextRequest) {
  const healthUrl = config.stems.healthUrl;
  
  if (!healthUrl) {
    return NextResponse.json(
      { status: "misconfigured", message: "STEMS_HEALTH_URL not set" },
      { status: 500 }
    );
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000); // 5 second timeout for health checks

    const response = await fetch(healthUrl, {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
    });

    clearTimeout(timeout);

    const status = response.ok ? "online" : "down";
    const statusCode = response.ok ? 200 : 503;

    return NextResponse.json(
      { 
        status,
        message: response.ok ? "Service is healthy" : `Service returned ${response.status}`,
        timestamp: new Date().toISOString()
      },
      { status: statusCode }
    );

  } catch (error: any) {
    return NextResponse.json(
      { 
        status: "down", 
        message: error.name === 'AbortError' ? "Health check timeout" : "Service unreachable",
        timestamp: new Date().toISOString()
      },
      { status: 503 }
    );
  }
}