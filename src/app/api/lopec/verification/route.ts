import { NextResponse } from "next/server";
import {
  readLopecVerificationView,
  runLopecVerificationIfStale
} from "@/lib/server/lopec-verification";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET() {
  return NextResponse.json({
    ok: true,
    data: await readLopecVerificationView()
  });
}

export async function POST() {
  const data = await runLopecVerificationIfStale();

  return NextResponse.json({
    ok: data.isFresh,
    message: data.lastMessage,
    data
  });
}
