import { NextResponse } from "next/server";
import { readAppStatusView } from "@/lib/server/app-status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      data: await readAppStatusView()
    },
    {
      headers: {
        "cache-control": "no-store"
      }
    }
  );
}
