import { NextResponse } from "next/server";
import { LostarkApiError, requestLostarkApi } from "@/lib/lostark/client";

export async function GET(request: Request) {
  try {
    const apiKey = request.headers.get("x-lostark-api-key");
    const result = await requestLostarkApi<unknown[]>("/news/events", {
      apiKey,
      maxRetries: 0
    });

    return NextResponse.json({
      ok: true,
      status: result.status,
      eventCount: Array.isArray(result.data) ? result.data.length : null,
      rateLimit: result.rateLimit
    });
  } catch (error) {
    if (error instanceof LostarkApiError) {
      return NextResponse.json({
        ok: false,
        status: error.status,
        rateLimit: error.rateLimit,
        message: "개인 API 키를 사용할 수 없습니다."
      });
    }

    return NextResponse.json({
      ok: false,
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
}
