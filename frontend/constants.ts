import { GameType } from './types';

export const MIN_BOARD_SIZE = 8;
export const MAX_BOARD_SIZE = 19;
export const DEFAULT_BOARD_SIZE = 15; // Good middle ground for both

export const DIRECTIONS = [
  [0, 1],   // Horizontal
  [1, 0],   // Vertical
  [1, 1],   // Diagonal Down-Right
  [1, -1],  // Diagonal Down-Left
];

export const GAME_DESCRIPTIONS = {
  [GameType.GO]: "Territory control. Capture stones by surrounding them. Suicide is forbidden unless it captures.",
  [GameType.GOMOKU]: "Five in a row. The first player to align 5 stones horizontally, vertically, or diagonally wins.",
};

// Visual helper: Star points (Hoshi) calculation
export const getStarPoints = (size: number): { x: number, y: number }[] => {
  if (size < 12) return [];
  
  const points: { x: number, y: number }[] = [];
  const corner = size >= 13 ? 3 : 2; // 0-indexed: 3 is 4th line
  const center = Math.floor(size / 2);

  // Corners
  points.push({ x: corner, y: corner });
  points.push({ x: size - 1 - corner, y: corner });
  points.push({ x: corner, y: size - 1 - corner });
  points.push({ x: size - 1 - corner, y: size - 1 - corner });

  // Center
  if (size % 2 !== 0) {
    points.push({ x: center, y: center });
    
    // Sides (for 19x19)
    if (size >= 18) {
      points.push({ x: center, y: corner });
      points.push({ x: center, y: size - 1 - corner });
      points.push({ x: corner, y: center });
      points.push({ x: size - 1 - corner, y: center });
    }
  }

  return points;
};