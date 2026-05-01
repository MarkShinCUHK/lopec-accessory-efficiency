import { NextResponse } from "next/server";
import { readSearchProgress } from "@/lib/server/search-progress";

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const progress = readSearchProgress(id);

  if (!progress) {
    return NextResponse.json(
      {
        ok: false,
        message: "검색 진행 상태가 없습니다."
      },
      { status: 404 }
    );
  }

  return NextResponse.json({
    ok: true,
    data: progress
  });
}
