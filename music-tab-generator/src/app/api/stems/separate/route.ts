import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const target = process.env.STEMS_SERVICE_URL || "http://127.0.0.1:8001/separate";
    
    // Get the form data from the request
    const formData = await req.formData();
    
    // Forward the request to the Python service
    const response = await fetch(target, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: `Separation failed: ${response.status} ${errorText}` },
        { status: 500 }
      );
    }

    // Stream the response back to the client
    const headers = new Headers();
    headers.set("Content-Type", "application/gzip");
    headers.set("Content-Disposition", "attachment; filename=stems.tar.gz");

    return new NextResponse(response.body, {
      status: 200,
      headers,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Proxy error" },
      { status: 500 }
    );
  }
}