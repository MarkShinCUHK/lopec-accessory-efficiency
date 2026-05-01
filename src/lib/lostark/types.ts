export interface LostarkAuctionOptions {
  MaxItemLevel: number;
  ItemGradeQualities: number[];
  SkillOptions: unknown[];
  EtcOptions: LostarkAuctionEtcOptionGroup[];
  Categories: LostarkAuctionCategory[];
  ItemGrades: string[];
  ItemTiers: number[];
  Classes: string[];
}

export interface LostarkAuctionCategory {
  Code: number;
  CodeName: string;
  Subs: Array<{
    Code: number;
    CodeName: string;
  }>;
}

export interface LostarkAuctionEtcOptionGroup {
  Value: number;
  Text: string;
  Tiers: number[] | null;
  EtcSubs: LostarkAuctionEtcSubOption[];
}

export interface LostarkAuctionEtcSubOption {
  Value: number;
  Text: string;
  Class: string;
  Categorys: number[] | null;
  Tiers: number[] | null;
  EtcValues: LostarkAuctionEtcValue[] | null;
}

export interface LostarkAuctionEtcValue {
  DisplayValue: string;
  Value: number;
  IsPercentage: boolean;
}

export interface LostarkArmory {
  ArmoryProfile: LostarkArmoryProfile | null;
  ArmoryEquipment: LostarkEquipmentItem[] | null;
  ArmoryEngraving: unknown;
  ArmoryCard: unknown;
  ArmoryGem: unknown;
  ArkPassive: unknown;
  ArkGrid: unknown;
}

export interface LostarkArmoryProfile {
  CharacterImage: string | null;
  ServerName: string;
  CharacterName: string;
  CharacterLevel: number;
  CharacterClassName: string;
  ItemAvgLevel: string;
  CombatPower: string | null;
  Stats: Array<{
    Type: string;
    Value: string;
    Tooltip: string[];
  }>;
}

export interface LostarkEquipmentItem {
  Type: string;
  Name: string;
  Icon: string;
  Grade: string;
  Tooltip: string;
}

export interface LostarkAuctionSearchRequest {
  ItemLevelMin?: number | null;
  ItemLevelMax?: number | null;
  ItemGradeQuality?: number | null;
  SkillOptions?: LostarkAuctionSearchOption[];
  EtcOptions?: LostarkAuctionSearchOption[];
  Sort: string;
  CategoryCode: number;
  CharacterClass?: string | null;
  ItemTier?: number | null;
  ItemGrade?: string | null;
  ItemName?: string | null;
  PageNo: number;
  SortCondition: "ASC" | "DESC";
}

export interface LostarkAuctionSearchOption {
  FirstOption: number | null;
  SecondOption: number | null;
  MinValue: number | null;
  MaxValue: number | null;
}

export interface LostarkAuctionSearchResponse {
  PageNo: number;
  PageSize: number;
  TotalCount: number;
  Items: LostarkAuctionItem[] | null;
}

export interface LostarkAuctionItem {
  Name: string;
  Grade: string;
  Tier: number;
  Level: number;
  Icon: string;
  GradeQuality: number;
  AuctionInfo: {
    StartPrice: number;
    BuyPrice: number | null;
    BidPrice: number;
    EndDate: string;
    BidCount: number;
    BidStartPrice: number;
    IsCompetitive: boolean;
    TradeAllowCount: number;
    UpgradeLevel: number;
  };
  Options: LostarkAuctionItemOption[];
}

export interface LostarkAuctionItemOption {
  Type: string;
  OptionName: string;
  OptionNameTripod: string;
  Value: number;
  IsPenalty: boolean;
  ClassName: string | null;
  IsValuePercentage: boolean;
}
