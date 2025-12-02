
export enum GameType {
  GO = 'GO',
  GOMOKU = 'GOMOKU',
  REVERSI = 'REVERSI',
}

export enum Player {
  BLACK = 'BLACK',
  WHITE = 'WHITE',
}

export enum AILevel {
  HUMAN = "HUMAN",
  GREEDY = "GREEDY",
  MINIMAX = "MINIMAX",
  MCTS = "MCTS",
}

export type BoardGrid = (Player | null)[][];

export interface GameConfig {
  boardSize: number;
  gameType: GameType;
  playerBlackIsAI: boolean;
  playerWhiteIsAI: boolean;
  aiLevel: AILevel; // Default/Legacy
  blackAILevel?: AILevel;
  whiteAILevel?: AILevel;
}

export interface GameState {
  gameId: string;
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
  gameType: GameType;
  boardSize: number;
  validMoves: [number, number][]; // Changed to array of tuples to match backend
}

export interface SavedGame {
  config: GameConfig;
  state: GameState;
  timestamp: number;
}

export type MoveResult = 
  | { success: true; state: GameState | null } // state can be null if AI has to move immediately
  | { success: false; error: string };

// Service Interface
export interface IGameService {
  startGame(config: GameConfig): Promise<GameState>;
  makeMove(x: number, y: number): Promise<MoveResult>;
  triggerAiMove(): Promise<MoveResult>; // Add this line
  undo(): Promise<GameState>;
  pass(currentPlayer: Player): Promise<GameState>;
  resign(currentPlayer: Player): Promise<GameState>;
  loadGame(savedGame: SavedGame): Promise<GameState>;
  getGameState(): GameState;
}
