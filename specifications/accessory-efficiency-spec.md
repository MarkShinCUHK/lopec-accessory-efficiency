# 로스트아크 악세사리 가격 대비 점수 효율 계산기 스펙

## 1. 목적

현재 캐릭터의 악세사리 상태를 기준으로 로스트아크 경매장 악세사리를 가상 장착해 보고, 각 아이템이 올려주는 점수 상승량과 가격 대비 효율을 계산한다.

이 도구의 1차 목표는 완전한 세팅 최적화가 아니라 다음 질문에 빠르게 답하는 것이다.

- 이 악세 하나를 사면 내 점수가 얼마나 오르는가?
- 같은 점수 상승이면 어떤 악세가 더 싼가?
- 내가 가진 골드 안에서 가장 효율 좋은 악세는 무엇인가?

## 2. 핵심 지표

```txt
기준 점수 = 현재 캐릭터 점수
교체 후 점수 = 특정 경매장 악세를 장착했을 때의 점수
점수 상승량 = 교체 후 점수 - 기준 점수
골드당 점수 = 점수 상승량 / 즉시구매가
1점당 골드 = 즉시구매가 / 점수 상승량
```

기본 정렬은 `1점당 골드 오름차순`으로 한다. 점수 상승량이 양수인 아이템만 기본 결과에 노출한다.

## 3. MVP 범위

1차 버전에서 지원할 기능은 다음과 같다.

- 캐릭터명 입력
- 로스트아크 Open API로 캐릭터 장비 정보 조회
- 현재 악세사리 5개 파싱
- 경매장 API로 목걸이, 귀걸이, 반지 검색
- 검색된 악세를 현재 슬롯에 하나씩 가상 교체
- LOPEC 방식에 맞춘 로컬 점수 계산
- 점수 상승량, 전투력 상승량, 가격 대비 효율 표시
- 결과 테이블 정렬 및 필터링

MVP에서는 각인을 점수 계산의 핵심 변경 요소로 다루지 않고, 검색 필터와 표시 정보로 우선 처리한다. 악세 교체로 각인 활성 상태까지 다시 최적화하면 조합 문제가 커지므로 2차 기능으로 분리한다.

## 4. MVP 제외 범위

초기 버전에서는 다음 기능을 제외한다.

- 악세 2개 이상 동시 교체 조합 최적화
- 각인 활성/비활성 전체 재계산
- 어빌리티 스톤, 팔찌, 보석까지 포함한 전체 세팅 최적화
- 입찰가 기반 가격 예측
- 거래 만료 시간 기반 추천
- 실시간 시세 추적 차트
- 유저 계정 저장 및 로그인

## 5. 외부 API

사용 API는 로스트아크 공식 Open API 기준이다.

- Base URL: `https://developer-lostark.game.onstove.com`
- 인증: `authorization: bearer {JWT}`
- 응답 형식: `application/json`
- 기본 제한: 분당 100회

주요 엔드포인트:

```txt
GET  /auctions/options
POST /auctions/items
GET  /armories/characters/{characterName}
GET  /armories/characters/{characterName}/profiles
GET  /armories/characters/{characterName}/equipment
GET  /armories/characters/{characterName}/engravings
GET  /armories/characters/{characterName}/gems
GET  /armories/characters/{characterName}/cards
GET  /armories/characters/{characterName}/arkpassive
GET  /armories/characters/{characterName}/arkgrid
```

참고 문서:

- https://developer-lostark.game.onstove.com/usage-guide
- https://developer-lostark.game.onstove.com/changelog

## 6. 권장 기술 구조

API 키를 브라우저에 노출하면 안 되므로 프론트엔드 단독 앱이 아니라 서버 라우트가 있는 구조를 사용한다.

권장 스택:

```txt
Next.js
TypeScript
React
서버 라우트 또는 Route Handler
메모리 캐시 또는 Redis
```

전체 구조:

```txt
Frontend
- 캐릭터 입력 UI
- 검색 조건 UI
- 결과 카드/테이블 전환 UI
- 악세 상세 비교 패널

Backend API Routes
- /api/character/:name
- /api/auction/options
- /api/auction/search
- /api/evaluate-accessories

Core Engine
- Lostark API 응답 -> 내부 캐릭터 모델 변환
- 경매장 아이템 -> 내부 악세 모델 변환
- calculateScore(characterState)
- replaceAccessory(state, slot, candidate)
```

## 7. 데이터 흐름

```txt
1. 사용자가 캐릭터명을 입력한다.
2. 서버가 Lostark Armory API를 호출한다.
3. API 응답을 내부 CharacterState로 변환한다.
4. 기준 점수를 계산한다.
5. 사용자가 악세 검색 조건을 입력한다.
6. 서버가 POST /auctions/items를 호출한다.
7. 경매장 응답을 AccessoryCandidate로 변환한다.
8. 각 후보 악세를 현재 슬롯에 하나씩 가상 교체한다.
9. 교체 후 점수를 계산한다.
10. 기준 점수와 비교해 상승량과 효율을 계산한다.
11. 결과 테이블을 반환한다.
```

## 8. 내부 데이터 모델 초안

```ts
type AccessorySlot =
  | "necklace"
  | "earring1"
  | "earring2"
  | "ring1"
  | "ring2";

type AccessoryType = "necklace" | "earring" | "ring";

interface CharacterState {
  characterName: string;
  serverName: string;
  className: string;
  itemLevel: number;
  profile: ProfileState;
  equipment: EquipmentState;
  accessories: Record<AccessorySlot, AccessoryState>;
  engravings: EngravingState;
  gems: GemState;
  cards: CardState;
  arkPassive: ArkPassiveState;
  arkGrid: ArkGridState;
}

interface AccessoryState {
  slot: AccessorySlot;
  type: AccessoryType;
  name: string;
  grade: string;
  quality: number;
  combatStats: {
    critical?: number;
    specialization?: number;
    swiftness?: number;
  };
  effects: AccessoryEffect[];
  engravings: AccessoryEngraving[];
  penalties: AccessoryEngraving[];
}

interface AccessoryCandidate extends AccessoryState {
  auctionId: number;
  buyPrice: number | null;
  bidStartPrice: number | null;
  endDate: string;
  iconUrl?: string;
  raw: unknown;
}

interface EvaluationResult {
  candidate: AccessoryCandidate;
  replacedSlot: AccessorySlot;
  baseScore: number;
  nextScore: number;
  deltaScore: number;
  baseCombatPower?: number;
  nextCombatPower?: number;
  deltaCombatPower?: number;
  buyPrice: number;
  scorePerGold: number;
  goldPerScore: number;
}
```

## 9. 경매장 검색 요청

경매장 검색은 `POST /auctions/items`를 사용한다.

기본 요청 형태:

```json
{
  "Sort": "BUY_PRICE",
  "CategoryCode": 30000,
  "ItemTier": 4,
  "ItemGrade": "고대",
  "ItemName": null,
  "PageNo": 0,
  "SortCondition": "ASC",
  "EtcOptions": []
}
```

실제 `CategoryCode`, `EtcOptions.FirstOption`, `EtcOptions.SecondOption` 값은 `GET /auctions/options` 응답을 기준으로 매핑한다.

검색 조건 UI:

```txt
부위: 목걸이 / 귀걸이 / 반지
등급: 고대 / 유물
최소 품질
핵심 옵션 등급 1: 상 / 중 / 하
핵심 옵션 등급 2: 상 / 중 / 하
최대 가격
```

핵심 옵션 등급은 결과를 받은 뒤 필터링하는 용도가 아니라 `POST /auctions/items`의 `EtcOptions`에 직접 넣는 검색 조건이다. 검색은 `TotalCount`와 `PageSize`로 마지막 페이지를 계산해 첫 페이지부터 마지막 페이지까지 자동 순회한다.

```txt
목걸이: 적에게 주는 피해 등급 + 추가 피해 등급
귀걸이: 공격력 % 등급 + 무기 공격력 % 등급
반지: 치명타 피해 등급 + 치명타 적중률 등급
```

Lost Ark 경매장 API의 퍼센트 `EtcValues.Value`는 표시값의 100배 단위다. 예를 들어 적에게 주는 피해 `2.00%`는 내부 점수 계산에서는 `2`로 다루지만, 경매장 검색 요청의 `MinValue`/`MaxValue`에는 `200`을 넣는다.

장착 악세와 검색 후보에는 LOPEC 시뮬레이터와 같은 순수 힘/민/지 위치 퍼센트를 표시한다.

```txt
목걸이: (힘민지 - 15178) / 2679 * 100
귀걸이: (힘민지 - 11806) / 2083 * 100
반지: (힘민지 - 10962) / 1935 * 100
```

옵션 등급 표시는 시각적으로 구분한다.

```txt
상: 노란색
중: 보라색
하: 파란색
```

## 10. 점수 계산 방식

LOPEC 시뮬레이터 분석 기준으로, 악세 교체 후 전체 캐릭터 상태를 다시 계산하는 방식을 사용한다.

딜러 스펙 포인트의 전체 구조:

```txt
딜러_스펙포인트 =
  공격력 *
  진피 *
  깨달음 *
  도약 *
  적에게 주는 피해 *
  추가 피해 *
  보주 *
  보석딜증 *
  보석쿨감 *
  스탯 *
  에스더 *
  팔찌효율보정 /
  보정상수
```

전투력의 전체 구조:

```txt
딜러_전투력 =
  기본공격력전투력 *
  각인전투력 *
  레벨전투력 *
  무기품질전투력 *
  보석전투력 *
  보주전투력 *
  스탯전투력 *
  아크그리드전투력 *
  아크패시브전투력 *
  악세서리전투력 *
  카드전투력 *
  카르마전투력 *
  팔찌전투력 *
  에스더전투력 *
  펫효과 *
  보정상수
```

중요한 점은 악세 옵션만 따로 점수화하지 않는 것이다. 악세를 교체한 전체 상태를 만들고, 전체 점수를 다시 계산한 뒤 차이를 보는 방식이 정확하다.

## 11. 악세 교체 평가 로직

목걸이는 목걸이 슬롯 1개만 비교한다.

귀걸이와 반지는 각각 2개 슬롯이 있으므로, 후보 아이템을 두 슬롯에 각각 넣어 보고 더 높은 점수가 나오는 슬롯을 선택한다.

```ts
function evaluateCandidate(
  baseState: CharacterState,
  candidate: AccessoryCandidate
): EvaluationResult | null {
  const baseScore = calculateScore(baseState).specPoint;
  const slots = getReplaceableSlots(candidate.type);

  const results = slots.map((slot) => {
    const nextState = replaceAccessory(baseState, slot, candidate);
    const nextScore = calculateScore(nextState).specPoint;

    return {
      candidate,
      replacedSlot: slot,
      baseScore,
      nextScore,
      deltaScore: nextScore - baseScore
    };
  });

  return maxBy(results, "deltaScore");
}
```

가격 정보가 없는 아이템은 기본 결과에서 제외하거나 별도 탭으로 분리한다.

## 12. 결과 테이블

검색 결과는 기본 10개씩 페이지네이션한다. 동일한 결과 목록을 `카드` 보기와 `표` 보기 중 선택해 볼 수 있어야 하며, 페이지 상태는 두 보기 방식이 공유한다.

기본 컬럼:

```txt
부위
아이템명
품질
치명
특화
신속
특수 옵션 요약
각인 옵션 요약
패널티
즉시구매가
점수 상승량
전투력 상승량
골드당 점수
1점당 골드
만료 시간
```

기본 필터:

```txt
점수 상승량 > 0
즉시구매가 있음
최대 가격 이하
패널티 조건 통과
```

기본 정렬:

```txt
1점당 골드 ASC
점수 상승량 DESC
즉시구매가 ASC
```

## 13. 캐시 전략

로스트아크 Open API는 요청 제한이 있으므로 캐시가 필수다.

```txt
GET /auctions/options:
  1일~1주 캐시

캐릭터 Armory 정보:
  5~10분 캐시
  수동 새로고침 제공

경매장 검색 결과:
  30~60초 캐시

계산 결과:
  characterStateHash + searchRequestHash 기준 메모리 캐시
```

API 응답 헤더의 `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`을 기록하고, 잔여 요청 수가 낮으면 UI에 경고를 표시한다.

## 14. 옵션 매핑

가장 중요한 구현 포인트는 경매장 옵션을 내부 계산 필드로 정확히 매핑하는 것이다.

예시:

```txt
추가 피해 -> additionalDamage
무기 공격력 +% -> weaponAttackPercent
무기 공격력 +flat -> weaponAttackFlat
공격력 +% -> attackPercent
공격력 +flat -> attackFlat
치명 -> critical
특화 -> specialization
신속 -> swiftness
각인 효과 -> engravings
감소 효과 -> penalties
```

`GET /auctions/options` 응답을 저장해 option id와 표시명을 매핑한다. 이 매핑이 틀리면 효율 계산 결과가 모두 틀어지므로 별도 테스트가 필요하다.

## 15. 검증 기준

초기 검증은 LOPEC 시뮬레이터와 수동 비교한다.

검증 절차:

```txt
1. 특정 캐릭터의 현재 점수를 기록한다.
2. 경매장 악세 하나를 선택한다.
3. LOPEC 시뮬레이터에서 같은 악세 옵션을 수동 입력한다.
4. LOPEC의 교체 후 점수를 기록한다.
5. 우리 계산기의 교체 후 점수와 비교한다.
6. 오차가 허용 범위 이내인지 확인한다.
```

허용 오차:

```txt
스펙 포인트: ±0.1% 이내
전투력: ±0.1% 이내
```

오차가 크면 다음 순서로 확인한다.

```txt
1. 악세 옵션 파싱 오류
2. 품질/특성 수치 파싱 오류
3. 공격력 계열 옵션 매핑 오류
4. 아크패시브/아크그리드 반영 누락
5. 반올림/버림 처리 차이
6. LOPEC 번들 계산식 변경
```

## 16. 개발 순서

권장 개발 순서:

```txt
1. 프로젝트 생성
2. Lostark API 클라이언트 작성
3. /auctions/options 캐시 구현
4. 캐릭터 Armory 조회 구현
5. Armory 응답 -> CharacterState 변환
6. 현재 점수 계산 엔진 작성
7. 경매장 검색 API 작성
8. 경매장 악세 옵션 파서 작성
9. 단일 악세 교체 시뮬레이션 작성
10. 효율 결과 테이블 UI 작성
11. LOPEC 수동 비교 테스트 작성
12. 검색 조건과 캐시 정책 보강
```

## 17. 2차 기능 후보

MVP 이후 추가할 만한 기능:

- 악세 2개 조합 최적화
- 예산 기반 추천
- 각인 활성 상태까지 포함한 조합 평가
- 동일 옵션 최저가 알림
- 최근 검색 저장
- 즐겨찾기 캐릭터
- 시세 변동 히스토리
- 거래 만료 임박 필터
- 품질 대비 효율 그래프
- 현재 장착 악세 매도 예상가 반영
- LOPEC 시뮬레이터 번들 해시와 고정 fixture 비교를 통한 계산식 변경 감지

## 18. 보안 주의사항

- Lostark API JWT는 서버 환경 변수에만 저장한다.
- 브라우저 번들에 JWT가 포함되면 안 된다.
- 서버 로그에 JWT를 출력하지 않는다.
- 사용자가 직접 입력한 JWT는 브라우저 저장소에 저장하지 않고 현재 세션 요청에만 사용한다.
- API 호출 실패 시 원본 인증 헤더를 클라이언트에 반환하지 않는다.

환경 변수 예시:

```txt
LOSTARK_API_JWT=bearer xxxxxxxxxxxxxxxxxxxxxxxxx
```

## 19. 초기 완료 기준

MVP 완료 기준:

- 캐릭터명으로 현재 캐릭터 상태를 불러올 수 있다.
- 현재 악세 5개를 내부 모델로 파싱할 수 있다.
- 경매장 목걸이/귀걸이/반지 검색이 가능하다.
- 검색된 악세를 단일 교체했을 때 점수 상승량을 계산할 수 있다.
- 가격 대비 효율 순으로 결과를 볼 수 있다.
- LOPEC 수동 비교 기준 오차가 ±0.1% 이내다.
