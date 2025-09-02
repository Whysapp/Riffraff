import { NextRequest, NextResponse } from "next/server";
import { config } from "@/lib/config";

const STEMS_URL = config.stems.serviceUrl;
const TIMEOUT_MS = config.stems.timeoutMs;
const MAX_MB = config.stems.maxMB;

function isRetriable(status: number) {
  return status === 502 || status === 503 || status === 504;
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function POST(req: NextRequest) {
  if (!STEMS_URL) {
    return NextResponse.json(
      { error: "STEMS_SERVICE_URL not configured" },
      { status: 500 }
    );
  }

  try {
    // Get content length for size check
    const contentLength = req.headers.get('content-length');
    if (contentLength && Number(contentLength) > MAX_MB * 1024 * 1024) {
      return NextResponse.json(
        { error: `File too large. Maximum size is ${MAX_MB}MB` },
        { status: 413 }
      );
    }

    // Get the raw body as ArrayBuffer
    const body = await req.arrayBuffer();
    
    // Double-check size after reading
    if (body.byteLength > MAX_MB * 1024 * 1024) {
      return NextResponse.json(
        { error: `File too large. Maximum size is ${MAX_MB}MB` },
        { status: 413 }
      );
    }

    const contentType = req.headers.get("content-type") || "multipart/form-data";

    // Retry logic with exponential backoff
    const delays = [0, 2000, 5000]; // 0s, 2s, 5s
    let lastError: any = null;
    
    for (let attempt = 0; attempt < delays.length; attempt++) {
      if (delays[attempt] > 0) {
        await sleep(delays[attempt]);
      }

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

        const response = await fetch(STEMS_URL, {
          method: "POST",
          headers: {
            "content-type": contentType,
          },
          body: body,
          signal: controller.signal,
        });

        clearTimeout(timeout);

        // If retriable error and not last attempt, continue to next attempt
        if (!response.ok && isRetriable(response.status) && attempt < delays.length - 1) {
          lastError = { status: response.status, statusText: response.statusText };
          continue;
        }

        // If not ok but not retriable, or last attempt, handle error
        if (!response.ok) {
          let errorDetail = "";
          try {
            const errorText = await response.text();
            errorDetail = errorText.slice(0, 2000); // Limit error text size
          } catch {
            errorDetail = response.statusText;
          }
          
          return NextResponse.json(
            { 
              error: `Separation failed (${response.status})`, 
              detail: errorDetail 
            },
            { status: 500 }
          );
        }

        // Success - stream the response
        const headers = new Headers();
        headers.set("Content-Type", "application/gzip");
        headers.set("Content-Disposition", "attachment; filename=stems.tar.gz");

        return new NextResponse(response.body, {
          status: 200,
          headers,
        });

      } catch (error: any) {
        lastError = error;
        
        // If this is an abort error (timeout), don't retry
        if (error.name === 'AbortError') {
          return NextResponse.json(
            { error: "Request timeout - stem separation took too long" },
            { status: 408 }
          );
        }

        // If last attempt, return error
        if (attempt === delays.length - 1) {
          break;
        }
      }
    }

    // All attempts failed
    return NextResponse.json(
      { 
        error: "Upstream service unavailable", 
        detail: lastError?.message || String(lastError) 
      },
      { status: 502 }
    );

  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}