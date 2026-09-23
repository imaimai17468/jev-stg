import { daysFromCivil } from "./calendar";
import { itemAt } from "./lookup";
import type { Bonus } from "./modifiers";
import type { ShipUpgrade, TechCategory, TechId } from "./techs";
import { categoryOf, TECH_IDS, TECH_LINES, techOf } from "./techs";

/** The days a technology of cost 1 takes, after Hearts of Iron IV's `BASE_TECH_COST`. */
const BASE_TECH_COST = 110;

/** The research-days `tech` takes, after Hearts of Iron IV's `floor(cost * BASE_TECH_COST)`. */
export const daysOf = (tech: TechId): number =>
  Math.floor(techOf(tech).cost * BASE_TECH_COST);

/**
 * The ahead-of-time penalty each year before a technology becomes current
 * adds, after Hearts of Iron IV's 200%: a year early it researches at a third
 * of its speed.
 */
export const AHEAD_OF_TIME_PER_YEAR = 2;

const DAYS_PER_YEAR = 365;

/** The days saved an idle slot holds at most, after Hearts of Iron IV's 30. */
const MOST_DAYS_SAVED = 30;

/**
 * A technology on a slot: the research-days put into it so far, the share a
 * research bonus adds to every day of it, the years of ahead-of-time penalty
 * that bonus takes off, and the days its slot saved while idle, which its
 * first day adds.
 */
export interface Study {
  readonly tech: TechId;
  readonly progress: number;
  readonly bonus: number;
  readonly ahead: number;
  readonly saved: number;
}

/**
 * A research bonus waiting for the next technology started in one of its
 * categories, which it speeds up by `share` and puts `ahead` years closer to
 * current until that one is done.
 */
export interface Voucher {
  readonly categories: readonly TechCategory[];
  readonly share: number;
  readonly ahead: number;
}

/** What a nation has researched and what its slots are working on. */
export interface Research {
  readonly researched: readonly TechId[];
  /** One study per busy slot, in the order they were started. */
  readonly studies: readonly Study[];
  /** Research bonuses not yet used, the oldest first. */
  readonly vouchers: readonly Voucher[];
  /** The days each idle slot has saved, the longest idle first. */
  readonly saved: readonly number[];
}

/**
 * The models every nation's opening forces are built from. Hearts of Iron IV
 * opens each nation with its own historical technologies, so the choice of
 * these, and of every technology meant for a year before 1936, is this
 * game's own.
 */
const OPENING_MODELS: ReadonlySet<TechId> = new Set<TechId>([
  "infantry-equipment-1",
  "destroyer-2",
  "light-cruiser-2",
  "battleship-2",
  "carrier-2",
  "submarine-2",
  "fighter-1",
  "close-air-support-1",
  "naval-bomber-1",
]);

/** The year the world opens in. */
const OPENING_YEAR = 1936;

export const START_RESEARCH: Research = {
  researched: TECH_IDS.filter(
    (tech) => techOf(tech).year < OPENING_YEAR || OPENING_MODELS.has(tech)
  ),
  saved: [],
  studies: [],
  vouchers: [],
};

/** The years before `tech` becomes current on day `today`, none once it has. */
const yearsAhead = (tech: TechId, today: number): number =>
  Math.max(
    0,
    (daysFromCivil({ day: 1, month: 1, year: techOf(tech).year }) - today) /
      DAYS_PER_YEAR
  );

/**
 * The research-days a slot puts into `study` on day `today` at a research
 * speed of `speed`: its research bonus on top, all of it cut by the
 * ahead-of-time penalty for the years early its bonus leaves.
 */
const paceOf = (study: Study, speed: number, today: number): number =>
  (1 + speed + study.bonus) /
  (1 +
    AHEAD_OF_TIME_PER_YEAR *
      Math.max(0, yearsAhead(study.tech, today) - study.ahead));

/** The technologies `research` has finished or has on a slot. */
const touched = (research: Research): ReadonlySet<TechId> =>
  new Set([
    ...research.researched,
    ...research.studies.map((study) => study.tech),
  ]);

/**
 * The technologies each one rules out or is ruled out by, whichever of the
 * two names the other, in the tree's order.
 */
const RIVALS: readonly (readonly TechId[])[] = TECH_IDS.map((tech) => [
  ...techOf(tech).excludes,
  ...TECH_IDS.filter((other) => techOf(other).excludes.includes(tech)),
]);

/** Every technology something in `taken` rules out. */
const ruledOutBy = (taken: ReadonlySet<TechId>): ReadonlySet<TechId> =>
  new Set(
    [...taken].flatMap((tech) => itemAt(RIVALS, TECH_IDS.indexOf(tech), []))
  );

/** Whether `tech` is a root or one of the technologies leading to it is in `leading`. */
const ledTo = (tech: TechId, leading: (from: TechId) => boolean): boolean => {
  const { from } = techOf(tech);
  return from.length === 0 || from.some(leading);
};

/**
 * The technologies a slot may start on: every one not already researched or
 * on a slot, that one researched technology leads to, and that nothing
 * researched or on a slot rules out. They come in the tree's order.
 */
export const availableTechs = (research: Research): readonly TechId[] => {
  const taken = touched(research);
  const ruledOut = ruledOutBy(taken);
  const finished = new Set(research.researched);
  return TECH_IDS.filter(
    (tech) =>
      !taken.has(tech) &&
      !ruledOut.has(tech) &&
      ledTo(tech, (from) => finished.has(from))
  );
};

/**
 * The technologies each line of the tree offers a slot: the one meant for
 * the earliest year among those a slot may start on, the tree's order
 * breaking a tie, followed by any a slot may start on that it rules out, so
 * an either-or choice between two paths is offered as one. A line with none
 * to offer offers nothing.
 */
export const leadingTechs = (research: Research): readonly TechId[] => {
  const available = availableTechs(research);
  return TECH_LINES.flatMap((line) => {
    const onLine = available
      .filter((tech) => techOf(tech).line === line)
      .toSorted((one, other) => techOf(one).year - techOf(other).year);
    return onLine.slice(0, 1).flatMap((leader) => {
      const rivals = new Set(itemAt(RIVALS, TECH_IDS.indexOf(leader), []));
      return [leader, ...available.filter((tech) => rivals.has(tech))];
    });
  });
};

/** No research bonus, which a technology started without one runs on. */
const NO_VOUCHER: Voucher = { ahead: 0, categories: [], share: 0 };

/**
 * The research with `tech` started on a free slot, taking the oldest research
 * bonus that covers its category and the days saved by the slot that has
 * been idle longest.
 */
export const studyStarted = (research: Research, tech: TechId): Research => {
  const category = categoryOf(techOf(tech).line);
  const used = research.vouchers.findIndex((voucher) =>
    voucher.categories.includes(category)
  );
  const voucher = itemAt(research.vouchers, used, NO_VOUCHER);
  return {
    ...research,
    saved: research.saved.slice(1),
    studies: [
      ...research.studies,
      {
        ahead: voucher.ahead,
        bonus: voucher.share,
        progress: 0,
        saved: itemAt(research.saved, 0, 0),
        tech,
      },
    ],
    vouchers: research.vouchers.filter((_, index) => index !== used),
  };
};

/**
 * Whether a slot could still start `tech` some day: it is neither researched
 * nor on a slot, nothing researched or on a slot rules it out, and it is a
 * root or a technology leading to it is researched, on a slot, or could
 * itself still be started.
 */
const reachable = (research: Research) => {
  const taken = touched(research);
  const ruledOut = ruledOutBy(taken);
  const open = (tech: TechId): boolean =>
    !taken.has(tech) &&
    !ruledOut.has(tech) &&
    ledTo(tech, (from) => taken.has(from) || open(from));
  return open;
};

/**
 * Whether `wanted` research bonuses for `categories` would all find a use: no
 * bonus for any of them is already waiting, and at least that many
 * technologies in them could still be started.
 */
export const bonusUsable = (
  research: Research,
  categories: readonly TechCategory[],
  wanted: number
): boolean => {
  const covered = new Set(categories);
  if (
    research.vouchers.some((voucher) =>
      voucher.categories.some((category) => covered.has(category))
    )
  ) {
    return false;
  }
  const reach = reachable(research);
  return (
    TECH_IDS.filter(
      (tech) => covered.has(categoryOf(techOf(tech).line)) && reach(tech)
    ).length >= wanted
  );
};

/** The research with `vouchers` waiting for the next technologies in their categories. */
export const vouchersGranted = (
  research: Research,
  vouchers: readonly Voucher[]
): Research => ({
  ...research,
  vouchers: [...research.vouchers, ...vouchers],
});

/**
 * The research after day `today` with `slots` research slots at a research
 * speed of `speed`: every study advanced by its pace and the days its slot
 * saved, every technology that reached its research-days moved to the
 * researched list, which frees its slot, and every slot that was already idle
 * a day's saving further on.
 */
export const researchedOneDay = (
  research: Research,
  slots: number,
  speed: number,
  today: number
): Research => {
  const advanced = research.studies.map((study) => ({
    ...study,
    progress: study.progress + paceOf(study, speed, today) * (1 + study.saved),
    saved: 0,
  }));
  const done = (study: Study) => study.progress >= daysOf(study.tech);
  const finished = advanced.filter(done);
  const idle = Math.max(0, slots - research.studies.length);
  return {
    ...research,
    researched: [
      ...research.researched,
      ...finished.map((study) => study.tech),
    ],
    saved: [
      ...Array.from({ length: idle }, (_, slot) =>
        Math.min(MOST_DAYS_SAVED, itemAt(research.saved, slot, 0) + 1)
      ),
      ...finished.map(() => 0),
    ],
    studies: advanced.filter((study) => !done(study)),
  };
};

/** What every technology `research` has finished adds. */
export const researchBonuses = (research: Research): readonly Bonus[] =>
  research.researched.map((tech) => techOf(tech).bonus);

/** What every technology `research` has finished adds to its warships' weapons. */
export const shipUpgradesOf = (research: Research): readonly ShipUpgrade[] =>
  research.researched.flatMap((tech) => techOf(tech).upgrades);
