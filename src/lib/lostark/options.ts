import { requestLostarkApi } from "@/lib/lostark/client";
import type { LostarkAuctionOptions } from "@/lib/lostark/types";

const AUCTION_OPTIONS_TTL_MS = 24 * 60 * 60 * 1000;

let auctionOptionsCache:
  | {
      data: LostarkAuctionOptions;
      expiresAt: number;
    }
  | null = null;

export async function getAuctionOptions(): Promise<LostarkAuctionOptions> {
  const now = Date.now();

  if (auctionOptionsCache && auctionOptionsCache.expiresAt > now) {
    return auctionOptionsCache.data;
  }

  const result = await requestLostarkApi<LostarkAuctionOptions>("/auctions/options");

  auctionOptionsCache = {
    data: result.data,
    expiresAt: now + AUCTION_OPTIONS_TTL_MS
  };

  return result.data;
}
