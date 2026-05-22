// ==================== SHARED TYPES ====================

export type GamePhase = "waiting" | "dealing" | "preflop" | "flop" | "turn" | "river" | "showdown" | "completed";
export type PlayerAction = "fold" | "check" | "call" | "raise" | "all_in";
export type RoomType = "public" | "private";
export type RoomStatus = "waiting" | "playing" | "paused" | "closed";
export type TransactionType = "deposit" | "withdraw" | "game_win" | "game_loss" | "rake" | "commission" | "room_fee" | "refund" | "adjustment";
export type Chain = "TRC20" | "TON";

export interface PublicRoomInfo {
  id: number;
  name: string;
  type: RoomType;
  status: RoomStatus;
  gameType: string;
  smallBlind: string;
  bigBlind: string;
  minBuyIn: string;
  maxBuyIn: string;
  maxPlayers: number;
  currentPlayers: number;
  fairnessLevel: string;
}

export interface PlayerInfo {
  id: number;
  seatIndex: number;
  nickname: string;
  avatar: string | null;
  chips: number;
  isFolded: boolean;
  isAllIn: boolean;
  currentBet: number;
  isActive: boolean;
}

export interface TableState {
  phase: GamePhase;
  players: PlayerInfo[];
  communityCards: string[];
  pot: number;
  currentBet: number;
  currentPlayerIndex: number;
  dealerIndex: number;
  myHoleCards?: string[];
  myChips?: number;
  mySeatIndex?: number;
  countdown?: number;
}

export interface WalletInfo {
  balance: string;
  frozenBalance: string;
  depositAddress?: { chain: Chain; address: string };
}

export interface AgentDashboard {
  inviteCode: string;
  inviteLink: string;
  totalDownlines: number;
  unlockedDownlines: number;
  totalEarnings: string;
  availableBalance: string;
  recentCommissions: CommissionRecord[];
}

export interface CommissionRecord {
  id: number;
  downlineId: number;
  level: number;
  rakeAmount: string;
  commissionRate: string;
  commissionAmount: string;
  createdAt: string;
}

export interface FairnessVerification {
  serverSeedHash: string;
  clientSeed: string;
  deckHash: string;
  serverSeed?: string; // revealed after hand
  isVerified?: boolean;
}

// i18n supported languages
export const SUPPORTED_LANGUAGES = ["en", "zh-CN", "zh-TW", "ja", "ko", "es", "pt", "ru", "ar", "vi", "th", "id"] as const;
export type SupportedLanguage = typeof SUPPORTED_LANGUAGES[number];

export const LANGUAGE_LABELS: Record<SupportedLanguage, string> = {
  "en": "English",
  "zh-CN": "简体中文",
  "zh-TW": "繁體中文",
  "ja": "日本語",
  "ko": "한국어",
  "es": "Español",
  "pt": "Português",
  "ru": "Русский",
  "ar": "العربية",
  "vi": "Tiếng Việt",
  "th": "ไทย",
  "id": "Bahasa Indonesia",
};
