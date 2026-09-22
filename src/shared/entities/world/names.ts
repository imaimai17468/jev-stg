import { itemAt } from "./lookup";
import type { Random } from "./random";

/**
 * The stems a nation's name is drawn from.
 *
 * A generated syllable string reads as noise after the third nation, so the
 * variety between seeds comes from which stems are drawn and which form each
 * takes rather than from inventing the words.
 */
const STEMS: readonly string[] = [
  "ヴェルダニア",
  "カスティリア",
  "ノルドマルク",
  "アルヴェント",
  "ゼーラント",
  "ブリガンティア",
  "テルミナ",
  "オストリッヒ",
  "サンドリア",
  "ミラヴェル",
  "ヘルヴェチア",
  "ラグナル",
  "エステルナ",
  "コルヴィナ",
  "ドラグミア",
  "フィオレンツ",
  "ガルディア",
  "イスカンデル",
  "ノヴァリス",
  "ペルガモン",
  "キンブリア",
  "タルシス",
  "ウラニア",
  "ヨトゥンヘイム",
  "セレスティア",
  "マルカンド",
  "アドリアナ",
  "ボレアリス",
];

const FORMS: readonly string[] = [
  "共和国",
  "帝国",
  "王国",
  "連邦",
  "公国",
  "人民共和国",
];

/** The items in an order the seed decides, leaving the input untouched. */
const shuffled = <T>(items: readonly T[], random: Random): readonly T[] =>
  items
    .map((item) => ({ item, order: random.unit() }))
    .toSorted((left, right) => left.order - right.order)
    .map((entry) => entry.item);

/**
 * `count` nation names.
 *
 * The stems are drawn without replacement, so two nations never share one while
 * the pool lasts, and asking for more than it holds repeats a stem under a
 * different form rather than failing.
 */
export const nationNames = (
  count: number,
  random: Random
): readonly string[] => {
  const stems = shuffled(STEMS, random);
  const forms = Array.from({ length: count }, () =>
    itemAt(FORMS, random.below(FORMS.length), "")
  );
  return forms.map(
    (form, index) => `${itemAt(stems, index % stems.length, "")}${form}`
  );
};
