import { Option } from "effect";
import type { Diplomacy } from "./diplomacy";
import { allied } from "./diplomacy";
import type { Arrival, Division } from "./divisions";
import { valueAt } from "./grid";
import type { ProvinceGraph } from "./provinces";
import { isLand } from "./provinces";
import { coastOf, laneBetween, seaDistanceFrom } from "./seas";
import { UNASSIGNED } from "./spread";
import { atWar, enemiesOf } from "./wars";

/**
 * What a crossing is for: a landing on an enemy coast, or a transfer to a
 * coast of the nation's own that the land does not reach, which is how a
 * beachhead is reinforced.
 */
export type Crossing = "landing" | "transfer";

/** A crossing a nation is preparing: where, over which sea, and with whom. */
export interface Invasion {
  readonly nation: number;
  readonly crossing: Crossing;
  /** The coast the divisions go ashore on. */
  readonly target: number;
  /** The sea zones the transports cross, from the home port's to the target's. */
  readonly lane: readonly number[];
  /** The divisions aboard, out of the line until they land or come home. */
  readonly divisions: readonly Division[];
  /** The convoys carrying them. */
  readonly convoys: number;
  /** The day the preparation is done and the landing may go in. */
  readonly readyOn: number;
}

/**
 * The days it takes to prepare a landing for each division in it, and the
 * most divisions one landing takes, after Hearts of Iron IV's first naval
 * invasion technology.
 */
const PREPARATION_DAYS_PER_DIVISION = 7;
const MOST_DIVISIONS = 4;

/**
 * The convoys one division takes aboard. Hearts of Iron IV asks one for each
 * point of a division's weight, and this game's infantry division is its own.
 */
export const CONVOYS_PER_DIVISION = 5;

/**
 * The share of the sea along the lane the invader's side must hold, after
 * Hearts of Iron IV's more than 50% naval supremacy.
 */
const SUPREMACY_TO_LAND = 0.5;

/**
 * The days past its readiness a landing waits for the sea to clear before
 * the divisions go home. The wiki sets no such limit, so this is this game's
 * own.
 */
const MOST_DAYS_WAITING = 90;

/** What a nation weighs when it plans a landing. */
export interface Beachhead {
  readonly graph: ProvinceGraph;
  readonly owners: Int32Array;
  readonly diplomacy: Diplomacy;
  /** The strength standing in each province, by province id. */
  readonly garrisons: ReadonlyMap<number, number>;
}

/** A landing's target and the lane to it. */
interface Landfall {
  readonly target: number;
  readonly lane: readonly number[];
}

/**
 * The enemy coast `nation` lands on from `home`: the one with the least
 * standing on it, then the one nearest over the sea, then the lowest id.
 */
export const landfallFor = (
  beachhead: Beachhead,
  nation: number,
  home: number
): Option.Option<Landfall> => {
  const { diplomacy, graph, owners } = beachhead;
  const distance = seaDistanceFrom(graph, [home]);
  const candidates = [...owners.entries()].flatMap(([province, owner]) => {
    const offshore = coastOf(graph, province).filter(
      (zone) => valueAt(distance, zone) !== UNASSIGNED
    );
    if (
      offshore.length === 0 ||
      !isLand(graph, province) ||
      !atWar(diplomacy.wars, nation, owner)
    ) {
      return [];
    }
    return [
      {
        guarded: beachhead.garrisons.get(province) ?? 0,
        sailing: Math.min(...offshore.map((zone) => valueAt(distance, zone))),
        target: province,
      },
    ];
  });
  return Option.map(
    Option.fromIterable(
      candidates.toSorted(
        (one, other) =>
          one.guarded - other.guarded || one.sailing - other.sailing
      )
    ),
    ({ target }) => ({
      lane: laneBetween(graph, [home], coastOf(graph, target)),
      target,
    })
  );
};

/** What a nation has to hand for a crossing. */
export interface Muster {
  readonly nation: number;
  /** The zone off its home port. */
  readonly home: number;
  /** Its convoys on no lane and held back for nothing. */
  readonly idleConvoys: number;
  /** Whether it has a battle fleet to hold the lane with. */
  readonly hasFleet: boolean;
  /** Its divisions on the ground its capital reaches over land. */
  readonly spare: readonly Division[];
  /** Whether that ground touches the ground of a nation it is fighting. */
  readonly facesEnemy: boolean;
  /** Its coasts the land from its capital does not reach, which a transfer sails to. */
  readonly beachheads: readonly number[];
}

/** How many divisions `muster` can send on one crossing. */
const loadOf = (muster: Muster): number =>
  Math.min(
    MOST_DIVISIONS,
    muster.spare.length,
    Math.floor(muster.idleConvoys / CONVOYS_PER_DIVISION)
  );

/**
 * The crossing `muster`'s nation starts today, if it starts one. Only a
 * nation at war whose ground reached from its capital faces none of its
 * enemies over land goes, with as many of that ground's divisions as one
 * crossing and its idle convoys take, and never without a home port to sail
 * from. Where it already holds a beachhead the land does not reach and the sea
 * does, it sends them to the lowest-numbered one, a day's sailing for each
 * zone of the lane; otherwise, with a battle fleet to cover it, it lands them on the
 * enemy coast `landfallFor` picks, after the days of preparation that takes.
 */
export const invasionPlanned = (
  beachhead: Beachhead,
  muster: Muster,
  day: number
): Option.Option<Invasion> => {
  const { nation } = muster;
  const count = loadOf(muster);
  if (
    count === 0 ||
    muster.home === UNASSIGNED ||
    muster.facesEnemy ||
    enemiesOf(beachhead.diplomacy.wars, nation).length === 0
  ) {
    return Option.none();
  }
  const aboard = {
    convoys: count * CONVOYS_PER_DIVISION,
    divisions: muster.spare.slice(0, count),
    nation,
  };
  const transfer = Option.map(
    Option.fromIterable(muster.beachheads.slice(0, 1)),
    (target): Invasion => {
      const lane = laneBetween(
        beachhead.graph,
        [muster.home],
        coastOf(beachhead.graph, target)
      );
      return {
        ...aboard,
        crossing: "transfer",
        lane,
        readyOn: day + lane.length,
        target,
      };
    }
  ).pipe(Option.filter((crossing) => crossing.lane.length > 0));
  if (Option.isSome(transfer) || !muster.hasFleet) {
    return transfer;
  }
  return Option.map(
    landfallFor(beachhead, nation, muster.home),
    (landfall) => ({
      ...aboard,
      ...landfall,
      crossing: "landing",
      readyOn: day + count * PREPARATION_DAYS_PER_DIVISION,
    })
  );
};

/**
 * Whether a crossing can still go ashore where it is bound while `holder`
 * holds its target: a landing onto an enemy's coast, and a transfer onto a
 * coast its own side still holds.
 */
const landsOn = (
  invasion: Invasion,
  diplomacy: Diplomacy,
  holder: number
): boolean => {
  if (invasion.crossing === "transfer") {
    return allied(diplomacy, invasion.nation, holder);
  }
  return atWar(diplomacy.wars, invasion.nation, holder);
};

/** How the divisions of each crossing come ashore. */
const ARRIVAL_BY = {
  landing: "landing",
  transfer: "march",
} satisfies Readonly<Record<Crossing, Arrival>>;

/** What becomes of a crossing today. */
export type Outcome =
  | { readonly kind: "waiting" }
  | { readonly kind: "landed"; readonly divisions: readonly Division[] }
  | { readonly kind: "called-off" };

const WAITING: Outcome = { kind: "waiting" };
const CALLED_OFF: Outcome = { kind: "called-off" };

/**
 * What becomes of `invasion` today, given the share of the sea its side holds
 * in each zone: it is called off once its target is no longer enemy ground or
 * it has waited too long for the sea, it goes in once it is ready and its side
 * holds more than half of every zone of the lane, and it waits otherwise. The
 * divisions go ashore on the target, still in the landing they made.
 */
export const invasionOutcome = (
  invasion: Invasion,
  owners: Int32Array,
  diplomacy: Diplomacy,
  day: number,
  heldIn: (zone: number) => number
): Outcome => {
  if (
    !landsOn(invasion, diplomacy, valueAt(owners, invasion.target)) ||
    day > invasion.readyOn + MOST_DAYS_WAITING
  ) {
    return CALLED_OFF;
  }
  if (
    day < invasion.readyOn ||
    invasion.lane.some((zone) => heldIn(zone) <= SUPREMACY_TO_LAND)
  ) {
    return WAITING;
  }
  return {
    divisions: invasion.divisions.map((division) => ({
      ...division,
      arrival: ARRIVAL_BY[invasion.crossing],
      marched: 0,
      movingTo: invasion.target,
      province: invasion.target,
    })),
    kind: "landed",
  };
};
