import { NextResponse } from "next/server";
import { LostarkApiError } from "@/lib/lostark/client";
import { getCharacterState } from "@/lib/lostark/armory";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

interface RouteContext {
  params: Promise<{
    name: string;
  }>;
}

export async function GET(request: Request, context: RouteContext) {
  const { name } = await context.params;
  const apiKey = request.headers.get("x-lostark-api-key");

  try {
    const character = await getCharacterState(decodeURIComponent(name), apiKey);

    return NextResponse.json({
      ok: true,
      data: {
        characterName: character.characterName,
        serverName: character.serverName,
        className: character.className,
        itemAvgLevel: character.itemAvgLevel,
        combatPower: character.combatPower,
        lopecScore: character.lopec?.score ?? null,
        isSupport: character.lopec?.simulator?.profile.supportCheck ?? false,
        imageUrl: character.imageUrl,
        accessories: character.accessories
      }
    });
  } catch (error) {
    if (error instanceof LostarkApiError) {
      return NextResponse.json(
        {
          ok: false,
          status: error.status,
          message:
            error.status === 429
              ? "Lostark API 제한으로 캐릭터 조회가 지연됐습니다. 잠시 후 다시 시도해 주세요."
              : "Lostark 캐릭터 요청에 실패했습니다."
        },
        { status: error.status }
      );
    }

    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}
