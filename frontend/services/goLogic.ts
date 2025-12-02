import { BoardGrid, Player } from '../types';

// Helper: Deep copy the grid
const copyGrid = (grid: BoardGrid): BoardGrid => grid.map(row => [...row]);

// Helper: Get opponent color
const getOpponent = (p: Player): Player => p === Player.BLACK ? Player.WHITE : Player.BLACK;

// Helper: Get neighbors
const getNeighbors = (x: number, y: number, size: number) => {
  const neighbors = [];
  if (x > 0) neighbors.push({ x: x - 1, y });
  if (x < size - 1) neighbors.push({ x: x + 1, y });
  if (y > 0) neighbors.push({ x, y: y - 1 });
  if (y < size - 1) neighbors.push({ x, y: y + 1 });
  return neighbors;
};

// Helper: Find a group of stones and its liberties
interface GroupResult {
  stones: { x: number; y: number }[];
  liberties: number;
}

const getGroup = (grid: BoardGrid, startX: number, startY: number): GroupResult => {
  const color = grid[startY][startX];
  const size = grid.length;
  const stones: { x: number; y: number }[] = [];
  const visited = new Set<string>();
  const queue = [{ x: startX, y: startY }];
  let liberties = 0;
  const libertyPoints = new Set<string>(); // Use Set to count unique empty intersections

  visited.add(`${startX},${startY}`);

  while (queue.length > 0) {
    const { x, y } = queue.shift()!;
    stones.push({ x, y });

    const neighbors = getNeighbors(x, y, size);
    for (const n of neighbors) {
      const nVal = grid[n.y][n.x];
      if (nVal === null) {
        libertyPoints.add(`${n.x},${n.y}`);
      } else if (nVal === color && !visited.has(`${n.x},${n.y}`)) {
        visited.add(`${n.x},${n.y}`);
        queue.push(n);
      }
    }
  }

  return { stones, liberties: libertyPoints.size };
};

export type GoMoveResult =
  | { success: true; newGrid: BoardGrid; capturedCount: number }
  | { success: false; error: string };

export const processGoMove = (
  grid: BoardGrid,
  x: number,
  y: number,
  player: Player,
  previousGrid: BoardGrid | null
): GoMoveResult => {
  if (grid[y][x] !== null) {
    return { success: false, error: "Position already occupied" };
  }

  const size = grid.length;
  const newGrid = copyGrid(grid);
  newGrid[y][x] = player;

  const opponent = getOpponent(player);
  let capturedCount = 0;

  // 1. Check for captures of opponent stones
  const neighbors = getNeighbors(x, y, size);
  const groupsToCheck = new Set<string>(); // Stores "x,y" representatives of groups

  neighbors.forEach(n => {
    if (newGrid[n.y][n.x] === opponent) {
      // Simple way to pick a unique ID for the group processing is just picking one stone
      // But we need to fully traverse.
      // We will just run getGroup on every opponent neighbor. 
      // Optimization: Keep track of visited stones to avoid re-checking same group.
    }
  });

  // Optimized Capture Check
  const processedOpponentStones = new Set<string>();
  
  neighbors.forEach(n => {
    if (newGrid[n.y][n.x] === opponent && !processedOpponentStones.has(`${n.x},${n.y}`)) {
      const group = getGroup(newGrid, n.x, n.y);
      if (group.liberties === 0) {
        // Capture!
        group.stones.forEach(s => {
          newGrid[s.y][s.x] = null;
          processedOpponentStones.add(`${s.x},${s.y}`); // Mark as processed/removed
          capturedCount++;
        });
      } else {
        // Mark this group as safe/processed for this move logic so we don't re-calc
        group.stones.forEach(s => processedOpponentStones.add(`${s.x},${s.y}`));
      }
    }
  });

  // 2. Check for Suicide (Self-capture)
  // If no stones were captured, the placed stone must have liberties.
  // If stones were captured, the space created grants liberties, so suicide check is implicitly passed.
  if (capturedCount === 0) {
    const selfGroup = getGroup(newGrid, x, y);
    if (selfGroup.liberties === 0) {
      return { success: false, error: "Suicide move is illegal (no liberties)" };
    }
  }

  // 3. Check for Ko (Global repetition)
  // Need to compare newGrid with previousGrid (the state before the *current* player moved, 
  // but actually Ko prevents returning to the state immediately prior to the opponent's move).
  // For simplicity in this "Assignment" context, we check if the board looks EXACTLY like the one right before.
  // However, the standard Ko rule is: you cannot repeat the board position of the previous turn.
  if (previousGrid) {
    let isSame = true;
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (newGrid[r][c] !== previousGrid[r][c]) {
          isSame = false;
          break;
        }
      }
      if (!isSame) break;
    }
    if (isSame) {
      return { success: false, error: "Ko rule: Cannot repeat previous board position immediately" };
    }
  }

  return { success: true, newGrid, capturedCount };
};