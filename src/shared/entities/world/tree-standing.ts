/**
 * Where one node of a tree, a national focus or a technology, stands for a
 * nation: finished, being worked on, free to start once a slot or the focus
 * is free, still waiting on what leads to it, or ruled out by a rival it took.
 */
export type TreeStanding = "done" | "underway" | "open" | "locked" | "excluded";
