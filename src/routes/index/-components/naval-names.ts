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
  convoy: "輸送船",
  cruiser: "巡洋艦",
  destroyer: "駆逐艦",
  submarine: "潜水艦",
} satisfies Readonly<Record<ShipyardOrder, string>>;
