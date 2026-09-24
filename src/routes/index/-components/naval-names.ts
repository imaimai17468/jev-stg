import type { Aircraft, Aviation } from "@/shared/entities/world/aircraft";
import type { ShipyardOrder } from "@/shared/entities/world/ships";
import type { TradeLaw } from "@/shared/entities/world/trade";

/** What the feed and the nation panel call each trade law. */
export const TRADE_LAW_NAMES = {
  "closed-economy": "閉鎖経済",
  "export-focus": "輸出重視",
  "free-trade": "自由貿易",
  "limited-exports": "輸出制限",
} satisfies Readonly<Record<TradeLaw, string>>;

/** What the feed and the nation panel call each thing a dockyard builds. */
export const ORDER_NAMES = {
  battleship: "戦艦",
  carrier: "空母",
  convoy: "輸送船",
  cruiser: "巡洋艦",
  destroyer: "駆逐艦",
  submarine: "潜水艦",
} satisfies Readonly<Record<ShipyardOrder, string>>;

/** What the feed and the nation panel call each kind of plane. */
export const AIRCRAFT_NAMES = {
  "close-support": "近接航空支援機",
  fighter: "戦闘機",
  "naval-bomber": "雷撃機",
  transport: "輸送機",
} satisfies Readonly<Record<Aircraft, string>>;

/** What the feed and the nation panel call each weight of aviation. */
export const AVIATION_NAMES = {
  heavy: "軍需工場の40%",
  light: "軍需工場の20%",
  none: "作らない",
} satisfies Readonly<Record<Aviation, string>>;
