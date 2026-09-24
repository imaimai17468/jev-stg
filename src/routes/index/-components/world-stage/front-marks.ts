import { Option } from "effect";
import type { BattlePlan } from "@/shared/entities/world/army/battle-plan";
import {
  battlePlansOf,
  NO_PLAN,
} from "@/shared/entities/world/army/battle-plan";
import type { World } from "@/shared/entities/world/geography/world";
import { valueAt } from "@/shared/entities/world/grid";
import { itemAt } from "@/shared/entities/world/lookup";
import type { Province } from "@/shared/entities/world/provinces";
import { graphOf } from "@/shared/entities/world/provinces";
import { UNASSIGNED } from "@/shared/entities/world/spread";
import type { Wars } from "@/shared/entities/world/wars";
import { atWar } from "@/shared/entities/world/wars";

/**
 * One straight run of cell edges, in cell coordinates, with the direction
 * pointing into the side of it that belongs to the nation it is drawn for.
 */
export interface Edge {
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
  readonly towardX: number;
  readonly towardY: number;
}

/** A point on the map, in cell coordinates. */
export interface Point {
  readonly x: number;
  readonly y: number;
}

/** What the map draws of one nation's battle plan. */
export interface FrontMark {
  readonly nation: number;
  /** Where its ground meets an enemy's. */
  readonly front: readonly Edge[];
  /** The forward edge of its fallback line. */
  readonly fallback: readonly Edge[];
  /** Each offensive, from the border it crosses to its objective. */
  readonly offensives: readonly (readonly Point[])[];
}

/** What a run of edges is drawn as. */
type EdgeKind = "front" | "fallback";

/** What a cell edge carries for the nation on one side of it. */
type Marking = EdgeKind | "none";

/** A run still being extended along the row or column being scanned. */
interface Run {
  readonly kind: EdgeKind;
  readonly nation: number;
  readonly towardX: number;
  readonly towardY: number;
  readonly start: number;
  end: number;
}

/** What one side of a cell edge is: the province, who holds it, and what its holder's plan makes of it. */
interface Side {
  readonly province: number;
  readonly owner: number;
  readonly land: boolean;
  readonly fallback: boolean;
  readonly depth: number;
}

/**
 * The kind of line a cell edge carries for the nation holding `inside`,
 * where it carries one: the front where the other side is the ground of an
 * enemy, and the fallback line where `inside` is on it and the other side is
 * its own ground nearer the front.
 */
const markingOf = (wars: Wars, inside: Side, outside: Side): Marking => {
  if (inside.province === outside.province || !inside.land) {
    return "none";
  }
  if (outside.land && atWar(wars, inside.owner, outside.owner)) {
    return "front";
  }
  if (
    inside.fallback &&
    outside.owner === inside.owner &&
    outside.depth !== UNASSIGNED &&
    outside.depth < inside.depth
  ) {
    return "fallback";
  }
  return "none";
};

/** Every province's side of an edge, read off its holder's plan. */
const sidesOf = (
  world: World,
  owners: Int32Array,
  plans: readonly BattlePlan[]
): readonly Side[] => {
  const onFallback = new Set(plans.flatMap((plan) => plan.fallback));
  return world.provinces.map((province) => {
    const owner = valueAt(owners, province.id);
    return {
      depth: valueAt(itemAt(plans, owner, NO_PLAN).depth, province.id),
      fallback: onFallback.has(province.id),
      land: province.kind === "land",
      owner,
      province: province.id,
    };
  });
};

const NO_SIDE: Side = {
  depth: UNASSIGNED,
  fallback: false,
  land: false,
  owner: UNASSIGNED,
  province: UNASSIGNED,
};

/**
 * Collects unit edges along one row or column of the lattice into runs,
 * extending a run while the next edge of the same kind, nation and facing
 * continues it.
 */
const runCollector = () => {
  const open = new Map<string, Run>();
  const closed: Run[] = [];
  const add = (
    kind: EdgeKind,
    nation: number,
    toward: Point,
    at: number
  ): void => {
    const key = `${kind}:${nation}:${toward.x}:${toward.y}`;
    const run = Option.fromUndefinedOr(open.get(key));
    if (Option.isSome(run) && run.value.end === at) {
      run.value.end = at + 1;
      return;
    }
    if (Option.isSome(run)) {
      closed.push(run.value);
    }
    open.set(key, {
      end: at + 1,
      kind,
      nation,
      start: at,
      towardX: toward.x,
      towardY: toward.y,
    });
  };
  const flush = (): readonly Run[] => {
    const runs = [...closed, ...open.values()];
    closed.length = 0;
    open.clear();
    return runs;
  };
  return { add, flush };
};

/** A run and where the line it lies on sits across the lattice. */
interface Laid {
  readonly run: Run;
  /** The row boundary of a horizontal run, the column boundary of a vertical one. */
  readonly across: number;
  readonly horizontal: boolean;
}

/** The run as an edge in cell coordinates. */
const edgeOf = ({ across, horizontal, run }: Laid): Edge => {
  if (horizontal) {
    return {
      towardX: run.towardX,
      towardY: run.towardY,
      x1: run.start,
      x2: run.end,
      y1: across,
      y2: across,
    };
  }
  return {
    towardX: run.towardX,
    towardY: run.towardY,
    x1: across,
    x2: across,
    y1: run.start,
    y2: run.end,
  };
};

const UP: Point = { x: 0, y: -1 };
const DOWN: Point = { x: 0, y: 1 };
const LEFT: Point = { x: -1, y: 0 };
const RIGHT: Point = { x: 1, y: 0 };

/**
 * Every run of cell edges that carries a front or a fallback line, for
 * whichever nation's side of it the line belongs to.
 */
const edgeRuns = (
  world: World,
  wars: Wars,
  sides: readonly Side[]
): readonly Laid[] => {
  const { height, width } = world.grid;
  const sideAt = (x: number, y: number): Side =>
    itemAt(sides, valueAt(world.cellProvince, y * width + x), NO_SIDE);
  const laid: Laid[] = [];
  const collector = runCollector();
  const visit = (inside: Side, outside: Side, toward: Point, at: number) => {
    const marking = markingOf(wars, inside, outside);
    if (marking !== "none") {
      collector.add(marking, inside.owner, toward, at);
    }
  };
  for (let y = 1; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const above = sideAt(x, y - 1);
      const below = sideAt(x, y);
      visit(above, below, UP, x);
      visit(below, above, DOWN, x);
    }
    for (const run of collector.flush()) {
      laid.push({ across: y, horizontal: true, run });
    }
  }
  for (let x = 1; x < width; x += 1) {
    for (let y = 0; y < height; y += 1) {
      const left = sideAt(x - 1, y);
      const right = sideAt(x, y);
      visit(left, right, LEFT, y);
      visit(right, left, RIGHT, y);
    }
    for (const run of collector.flush()) {
      laid.push({ across: x, horizontal: false, run });
    }
  }
  return laid;
};

/** Stands in for a province the world does not hold. Nothing reads it but the caller. */
const NOWHERE: Province = {
  cells: 0,
  id: UNASSIGNED,
  kind: "sea",
  neighbours: [],
  x: 0,
  y: 0,
};

/** Where a province's counters sit, which the offensives run through. */
const centreOf = (world: World, province: number): Point => {
  const { x, y } = itemAt(world.provinces, province, NOWHERE);
  return { x, y };
};

/**
 * An offensive's route as the arrow runs it: from halfway across the border
 * it crosses, through the centre of every enemy province, to the objective.
 */
const arrowOf = (
  world: World,
  offensive: readonly number[]
): readonly Point[] => {
  const points = offensive.map((province) => centreOf(world, province));
  return points.flatMap((point, step) => {
    if (step === 0) {
      return [];
    }
    if (step === 1) {
      const from = itemAt(points, 0, point);
      return [{ x: (from.x + point.x) / 2, y: (from.y + point.y) / 2 }, point];
    }
    return [point];
  });
};

/**
 * What the map draws of every nation's battle plan: where its ground meets
 * its enemies', on its own side of the border so two enemies' lines lie side
 * by side, its fallback line along the edge facing the front, and an arrow
 * for each offensive. A nation with no front draws nothing.
 */
export const frontMarks = (
  world: World,
  owners: Int32Array,
  wars: Wars,
  plans: readonly BattlePlan[]
): readonly FrontMark[] => {
  if (plans.every((plan) => plan.fronts.length === 0)) {
    return [];
  }
  const laid = edgeRuns(world, wars, sidesOf(world, owners, plans));
  return plans.flatMap((plan, nation) => {
    if (plan.fronts.length === 0) {
      return [];
    }
    const drawn = (kind: EdgeKind): readonly Edge[] =>
      laid.flatMap((run) => {
        if (run.run.nation !== nation || run.run.kind !== kind) {
          return [];
        }
        return [edgeOf(run)];
      });
    return [
      {
        fallback: drawn("fallback"),
        front: drawn("front"),
        nation,
        offensives: plan.fronts.flatMap((front) => {
          const arrow = arrowOf(world, front.offensive);
          if (arrow.length === 0) {
            return [];
          }
          return [arrow];
        }),
      },
    ];
  });
};

/** What the map draws of the battle plan every nation of `world` fights by under `wars`. */
export const frontsOf = (
  world: World,
  owners: Int32Array,
  wars: Wars
): readonly FrontMark[] =>
  frontMarks(
    world,
    owners,
    wars,
    battlePlansOf(
      world.provinces,
      world.nations,
      graphOf(world.provinces),
      owners,
      wars
    )
  );
