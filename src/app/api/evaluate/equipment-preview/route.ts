import { NextResponse } from "next/server";
import type { AccessoryScoringMode } from "@/lib/domain/accessory";
import { createEquipmentAssumptionPreview } from "@/lib/domain/equipment-assumptions";
import { getCharacterState } from "@/lib/lostark/armory";
import { LostarkApiError } from "@/lib/lostark/client";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

interface EquipmentPreviewRequestBody {
  characterName?: string;
  targetWeaponLevel?: string | number | null;
  targetArmorLevel?: string | number | null;
  scoringMode?: AccessoryScoringMode;
  apiKey?: string;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as EquipmentPreviewRequestBody;
    const characterName = body.characterName?.trim();

    if (!characterName) {
      return NextResponse.json(
        {
          ok: false,
          message: "캐릭터명을 입력하세요."
        },
        { status: 400 }
      );
    }

    const apiKey = typeof body.apiKey === "string" ? body.apiKey.trim() : null;
    const character = await getCharacterState(characterName, apiKey);
    const preview = createEquipmentAssumptionPreview(
      character,
      {
        targetWeaponLevel: body.targetWeaponLevel,
        targetArmorLevel: body.targetArmorLevel
      },
      normalizeScoringMode(body.scoringMode)
    );

    return NextResponse.json({
      ok: true,
      data: preview
    });
  } catch (error) {
    if (error instanceof LostarkApiError) {
      return NextResponse.json(
        {
          ok: false,
          status: error.status,
          message:
            error.status === 429
              ? "Lostark API 제한으로 강화 가정 계산이 지연됐습니다. 잠시 후 다시 시도해 주세요."
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

function normalizeScoringMode(
  value: AccessoryScoringMode | undefined
): AccessoryScoringMode | null {
  if (value === "dealer" || value === "support") {
    return value;
  }

  return null;
}
