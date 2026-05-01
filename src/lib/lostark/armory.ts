import { createCharacterState } from "@/lib/domain/character";
import { requestLostarkApi } from "@/lib/lostark/client";
import { fetchLopecSnapshot } from "@/lib/lopec/snapshot";
import type { LostarkArmory } from "@/lib/lostark/types";

export async function getCharacterState(characterName: string, apiKey?: string | null) {
  const encodedName = encodeURIComponent(characterName);
  const result = await requestLostarkApi<LostarkArmory>(
    `/armories/characters/${encodedName}`,
    {
      apiKey,
      rotateApiKeysOnRateLimit: true,
      maxRetryMs: 10 * 60 * 1000,
      maxRetries: 1000
    }
  );
  const character = createCharacterState(result.data);
  const lopec = await fetchLopecSnapshot(characterName).catch(() => null);

  return {
    ...character,
    lopec
  };
}
