import type { Ledger } from "@/shared/entities/world/commerce";
import type { NationEconomy } from "@/shared/entities/world/economy";
import type { Resource } from "@/shared/entities/world/resources";
import { RESOURCES } from "@/shared/entities/world/resources";
import { percentLabel } from "./count-label";
import { TRADE_LAW_NAMES } from "./naval-names";
import type { Stat } from "./stat";

const RESOURCE_NAMES = {
  chromium: "クロム",
  steel: "鋼鉄",
  tungsten: "タングステン",
} satisfies Readonly<Record<Resource, string>>;

/** A count with its sign written out, plus as well as minus. */
const signed = (count: number): string => {
  if (count > 0) {
    return `+${count}`;
  }
  return String(count);
};

/**
 * What the nation panel says about one nation's resources and trade: the law
 * it trades under, for each resource what it digs, needs, buys and sells a
 * day, what its arms output loses to what is still missing, and the civilian
 * factories its trade brought in or paid out.
 */
export const tradeSummaryOf = (
  economy: NationEconomy,
  ledger: Ledger
): readonly Stat[] => [
  { label: "交易法", value: TRADE_LAW_NAMES[economy.tradeLaw] },
  ...RESOURCES.map((resource) => ({
    label: RESOURCE_NAMES[resource],
    value: [
      `採掘 ${Math.round(ledger.extracted[resource])}`,
      `必要 ${Math.round(ledger.need[resource])}`,
      `輸入 ${Math.round(ledger.balance.imported[resource])}`,
      `輸出 ${Math.round(ledger.balance.exported[resource])}`,
    ].join("・"),
  })),
  {
    label: "資源不足による軍需生産の低下",
    value: percentLabel(ledger.shortage),
  },
  {
    label: "交易で増減した民需工場",
    value: signed(ledger.balance.factories),
  },
];
