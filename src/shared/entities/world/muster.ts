import type { Diplomacy } from "./diplomacy";
import { allied } from "./diplomacy";
import type { Division, DivisionKind, Levied } from "./divisions";
import type { NationEconomy } from "./economy";
import { NO_ECONOMY } from "./economy";
import { valueAt } from "./grid";
import type { World } from "./index";
import { itemAt } from "./lookup";
import type { Nation } from "./nations";
import { NO_NATION } from "./nations";
import { landProvinces } from "./provinces";
import { UNASSIGNED } from "./spread";
import { atWar } from "./wars";

/**
 * Where a nation musters, which is its capital while it still holds it and
 * whatever else it holds after that, or nowhere once it holds nothing.
 */
export const musteringAt = (
  world: World,
  owners: Int32Array,
  nation: Nation
): number => {
  if (valueAt(owners, nation.capital) === nation.id) {
    return nation.capital;
  }
  const held = landProvinces(world.provinces).find(
    (province) => valueAt(owners, province.id) === nation.id
  );
  return held?.id ?? UNASSIGNED;
};

/** What every nation raised where it musters, and its economy afterwards. */
export interface Mustered {
  readonly divisions: readonly Division[];
  readonly economies: readonly NationEconomy[];
}

/**
 * Every nation's levy, which `levied` decides from the nation's economy, the
 * nation, the province it musters at and the kinds `unlockedFor` gives it by
 * id: none for a nation with no ground, whose economy stays as it was.
 */
export const musteredBy = (
  world: World,
  owners: Int32Array,
  economies: readonly NationEconomy[],
  unlockedFor: (nation: number) => readonly DivisionKind[],
  levied: Levied
): Mustered => {
  const divisions: Division[] = [];
  const paid = world.nations.map((nation) => {
    const economy = itemAt(economies, nation.id, NO_ECONOMY);
    const province = musteringAt(world, owners, nation);
    if (province === UNASSIGNED) {
      return economy;
    }
    const levy = levied(economy, nation, province, unlockedFor(nation.id));
    divisions.push(...levy.divisions);
    return levy.economy;
  });
  return { divisions, economies: paid };
};

/**
 * The division standing where its nation musters, or nothing where its nation
 * holds no ground to muster on.
 */
export const sentToMuster = (
  world: World,
  owners: Int32Array,
  division: Division
): readonly Division[] => {
  const home = musteringAt(
    world,
    owners,
    itemAt(world.nations, division.nation, NO_NATION)
  );
  if (home === UNASSIGNED) {
    return [];
  }
  return [
    {
      ...division,
      arrival: "march",
      marched: 0,
      movingTo: home,
      province: home,
    },
  ];
};

/**
 * The divisions with every one standing on ground held by a nation it is
 * neither allied with nor fighting sent back to where its own nation musters, or disbanded where its
 * nation holds nothing.
 *
 * A division walks onto enemy ground to attack it, and a peace signed before
 * the ground is taken leaves it standing there with nothing to fight. One that
 * attacked beside an ally stays on the ground the ally took.
 */
export const sentHome = (
  world: World,
  owners: Int32Array,
  diplomacy: Diplomacy,
  divisions: readonly Division[]
): readonly Division[] =>
  divisions.flatMap((division) => {
    const holder = valueAt(owners, division.province);
    if (
      allied(diplomacy, holder, division.nation) ||
      atWar(diplomacy.wars, holder, division.nation)
    ) {
      return [division];
    }
    return sentToMuster(world, owners, division);
  });
