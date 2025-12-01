import { BoardGrid, Player } from '../types';
import { DIRECTIONS } from '../constants';

export const checkGomokuWin = (grid: BoardGrid, x: number, y: number, player: Player): boolean => {
  const size = grid.length;

  for (const [dx, dy] of DIRECTIONS) {
    let count = 1; // Start with the placed stone

    // Check forward direction
    let curX = x + dx;
    let curY = y + dy;
    while (curX >= 0 && curX < size && curY >= 0 && curY < size && grid[curY][curX] === player) {
      count++;
      curX += dx;
      curY += dy;
    }

    // Check backward direction
    curX = x - dx;
    curY = y - dy;
    while (curX >= 0 && curX < size && curY >= 0 && curY < size && grid[curY][curX] === player) {
      count++;
      curX -= dx;
      curY -= dy;
    }

    if (count >= 5) return true;
  }

  return false;
};

export type GomokuMoveResult =
  | { success: true; newGrid: BoardGrid; capturedCount: number }
  | { success: false; error: string };

export const processGomokuMove = (grid: BoardGrid, x: number, y: number, player: Player): GomokuMoveResult => {
  if (grid[y][x] !== null) {
    return { success: false, error: "Position already occupied" };
  }

  const newGrid = grid.map(row => [...row]);
  newGrid[y][x] = player;

  // Gomoku doesn't have capturing in standard rules (Standard Gomoku).
  // Renju has more complex rules but standard 5-in-a-row is requested.
  return { success: true, newGrid, capturedCount: 0 };
};