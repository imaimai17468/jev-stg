/** The cell lattice every field in a world is sampled on. */
export interface Grid {
  readonly width: number;
  readonly height: number;
}

/**
 * The value at `index`, or 0 where the index is outside the buffer.
 *
 * `noUncheckedIndexedAccess` types every buffer read as possibly absent, so the
 * whole world reads through this one function rather than each call site
 * carrying its own fallback and its own branch.
 */
export const valueAt = (values: ArrayLike<number>, index: number): number =>
  values[index] ?? 0;

export const cellCount = (grid: Grid): number => grid.width * grid.height;

export const cellX = (grid: Grid, cell: number): number => cell % grid.width;

export const cellY = (grid: Grid, cell: number): number =>
  Math.floor(cell / grid.width);

/**
 * Calls `visit` with each of the cell's four orthogonal neighbours that lies
 * inside the grid. The world does not wrap, so a cell on the rim has three
 * neighbours and a corner has two.
 */
export const visitNeighbours = (
  grid: Grid,
  cell: number,
  visit: (neighbour: number) => void
): void => {
  const x = cellX(grid, cell);
  const y = cellY(grid, cell);
  if (x > 0) {
    visit(cell - 1);
  }
  if (x < grid.width - 1) {
    visit(cell + 1);
  }
  if (y > 0) {
    visit(cell - grid.width);
  }
  if (y < grid.height - 1) {
    visit(cell + grid.width);
  }
};
