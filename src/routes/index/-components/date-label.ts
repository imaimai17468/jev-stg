import type { GameDate } from "@/shared/entities/world/calendar";

const pad = (value: number): string => String(value).padStart(2, "0");

/**
 * A date as the clock shows it.
 *
 * Fixed width and in the order that sorts, so the reader's eye stays on the map
 * rather than following a label that grows a character on the tenth.
 */
export const dateLabel = (date: GameDate): string =>
  `${date.year}-${pad(date.month)}-${pad(date.day)}`;
