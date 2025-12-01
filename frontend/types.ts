
export enum GameType {
  GO = 'GO',
  GOMOKU = 'GOMOKU',
}

export enum Player {
  BLACK = 'BLACK',
  WHITE = 'WHITE',
}

export type BoardGrid = (Player | null)[][];

export interface GameConfig {
  boardSize: number;
  gameType: GameType;
}

export interface GameState {
  grid: BoardGrid;
  currentPlayer: Player;
  history: BoardGrid[]; 
  prisoners: {
    [Player.BLACK]: number;
    [Player.WHITE]: number;
  };
  isGameOver: boolean;
  winner: Player | 'DRAW' | null;
  message: string;
  lastMove: { x: number; y: number } | null;
}

export interface SavedGame {
  config: GameConfig;
  state: GameState;
  timestamp: number;
}

export type MoveResult = 
  | { success: true; state: GameState }
  | { success: false; error: string };

// Service Interface
export interface IGameService {
  startGame(config: GameConfig): Promise<GameState>;
  makeMove(x: number, y: number): Promise<MoveResult>;
  undo(): Promise<GameState>;
  pass(currentPlayer?: Player): Promise<GameState>;
  resign(currentPlayer?: Player): Promise<GameState>;
  loadGame(savedGame: SavedGame): Promise<GameState>;
  getGameState(): GameState;
}
