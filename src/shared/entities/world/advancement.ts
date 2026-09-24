import { Option } from "effect";
import type { NationEconomy } from "./economy";
import type { Focuses } from "./focus";
import {
  focusBonuses,
  focusedOneDay,
  grantedBy,
  researchSlotsOf,
  START_FOCUSES,
} from "./focus";
import type { Leaning } from "./leaning";
import type { Modifiers } from "./modifiers";
import { summed } from "./modifiers";
import type { Research } from "./research";
import {
  openingResearchOf,
  researchBonuses,
  researchedOneDay,
  START_RESEARCH,
} from "./research";
import { lawBonusOf } from "./trade";

/** What one nation has researched and how far along its focus tree it is. */
export interface Advancement {
  readonly research: Research;
  readonly focuses: Focuses;
}

export const START_ADVANCEMENT: Advancement = {
  focuses: START_FOCUSES,
  research: START_RESEARCH,
};

/** Where a nation of `leaning` stands on the world's first day. */
export const openingAdvancementOf = (leaning: Leaning): Advancement => ({
  focuses: START_FOCUSES,
  research: openingResearchOf(leaning),
});

/**
 * Everything the nation's technologies, its finished focuses and the trade
 * law its economy runs under add together.
 */
export const modifiersOf = (
  advancement: Advancement,
  economy: NationEconomy
): Modifiers =>
  summed([
    ...researchBonuses(advancement.research),
    ...focusBonuses(advancement.focuses),
    lawBonusOf(economy.tradeLaw),
  ]);

/** The research slots that have nothing on them. */
export const freeSlotsOf = (advancement: Advancement): number =>
  researchSlotsOf(advancement.focuses) - advancement.research.studies.length;

/** A nation's advancement one day on, and its economy with what that handed it. */
interface Advanced {
  readonly advancement: Advancement;
  readonly economy: NationEconomy;
}

/**
 * One day of research and of work on the national focus, on day `today`
 * since 1970. The research runs at the speed the day began with, so a
 * technology finished today speeds up tomorrow's research rather than its
 * own last day.
 */
export const progressedOneDay = (
  advancement: Advancement,
  economy: NationEconomy,
  today: number
): Advanced => {
  const research = researchedOneDay(
    advancement.research,
    researchSlotsOf(advancement.focuses),
    modifiersOf(advancement, economy).research,
    today
  );
  const pursued = focusedOneDay(advancement.focuses);
  return {
    advancement: { focuses: pursued.focuses, research },
    economy: Option.match(pursued.finished, {
      onNone: () => economy,
      onSome: (focus) => grantedBy(economy, focus),
    }),
  };
};
