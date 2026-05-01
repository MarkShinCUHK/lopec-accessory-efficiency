import { NextResponse } from "next/server";
import { LostarkApiError } from "@/lib/lostark/client";
import { getAuctionOptions } from "@/lib/lostark/options";

export async function GET() {
  try {
    const options = await getAuctionOptions();

    return NextResponse.json({
      ok: true,
      data: {
        categories: options.Categories,
        itemGrades: options.ItemGrades,
        itemTiers: options.ItemTiers,
        etcOptions: options.EtcOptions
      }
    });
  } catch (error) {
    if (error instanceof LostarkApiError) {
      return NextResponse.json(
        {
          ok: false,
          status: error.status,
          message: "Lostark auction options request failed."
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
