import { GameConfig, GameState, Player, BoardGrid, MoveResult, IGameService, GameType, SavedGame } from '../types';
import { processGoMove } from './goLogic'; // We will reuse existing logic files for the local mock
import { checkGomokuWin, processGomokuMove } from './gomokuLogic';

// Helper to create initial state
const createInitialState = (config: GameConfig): GameState => {
  const grid = Array(config.boardSize).fill(null).map(() => Array(config.boardSize).fill(null));
  return {
    grid,
    currentPlayer: Player.BLACK,
    history: [grid],
    prisoners: { [Player.BLACK]: 0, [Player.WHITE]: 0 },
    isGameOver: false,
    winner: null,
    message: `Game Started. ${Player.BLACK}'s turn.`,
    lastMove: null
  };
};

export class LocalGameService implements IGameService {
  private state: GameState;
  private config: GameConfig;

  constructor(config?: GameConfig) {
    this.config = config || { boardSize: 15, gameType: GameType.GO };
    this.state = createInitialState(this.config);
  }

  async startGame(config: GameConfig): Promise<GameState> {
    this.config = config;
    this.state = createInitialState(config);
    return { ...this.state };
  }

  async loadGame(savedGame: SavedGame): Promise<GameState> {
    this.config = savedGame.config;
    this.state = savedGame.state;
    return { ...this.state };
  }

  getGameState(): GameState {
    return { ...this.state };
  }

  async makeMove(x: number, y: number): Promise<MoveResult> {
    if (this.state.isGameOver) return { success: false, error: "Game is over" };
    if (this.state.grid[y][x] !== null) return { success: false, error: "Occupied" };

    const previousGrid = this.state.history.length > 1 
        ? this.state.history[this.state.history.length - 2] 
        : null;

    let result;
    // Call logic helpers
    if (this.config.gameType === GameType.GO) {
        result = processGoMove(this.state.grid, x, y, this.state.currentPlayer, previousGrid);
    } else {
        result = processGomokuMove(this.state.grid, x, y, this.state.currentPlayer);
    }

    if (!result.success) {
        return { success: false, error: result.error || "Invalid Move" };
    }

    // Update State
    const nextPlayer = this.state.currentPlayer === Player.BLACK ? Player.WHITE : Player.BLACK;
    const newGrid = result.newGrid;
    const nextHistory = [...this.state.history, newGrid];
    const nextPrisoners = { ...this.state.prisoners };
    if (result.capturedCount) {
        nextPrisoners[this.state.currentPlayer] += result.capturedCount;
    }

    let winner = null;
    let isOver = false;
    let msg = `${nextPlayer}'s turn`;

    // Win Checks
    if (this.config.gameType === GameType.GOMOKU) {
        if (checkGomokuWin(newGrid, x, y, this.state.currentPlayer)) {
            winner = this.state.currentPlayer;
            isOver = true;
            msg = `${winner} WINS!`;
        } else if (nextHistory.length === this.config.boardSize * this.config.boardSize + 1) {
            isOver = true;
            winner = 'DRAW';
            msg = "Draw";
        }
    }

    this.state = {
        grid: newGrid,
        currentPlayer: nextPlayer,
        history: nextHistory,
        prisoners: nextPrisoners,
        isGameOver: isOver,
        winner: winner,
        message: msg,
        lastMove: { x, y }
    };

    return { success: true, state: { ...this.state } };
  }

  async undo(): Promise<GameState> {
    if (this.state.history.length <= 1) return this.state;

    const newHistory = this.state.history.slice(0, -1);
    const previousGrid = newHistory[newHistory.length - 1];
    const prevPlayer = this.state.currentPlayer === Player.BLACK ? Player.WHITE : Player.BLACK;

    this.state = {
        ...this.state,
        grid: previousGrid,
        history: newHistory,
        currentPlayer: prevPlayer,
        message: `Undo. ${prevPlayer}'s turn`,
        isGameOver: false,
        winner: null,
        lastMove: null
    };
    return { ...this.state };
  }

  async pass(currentPlayer?: Player): Promise<GameState> {
    const nextPlayer = this.state.currentPlayer === Player.BLACK ? Player.WHITE : Player.BLACK;
    this.state = {
        ...this.state,
        currentPlayer: nextPlayer,
        message: `${this.state.currentPlayer} passed.`
    };
    return { ...this.state };
  }

  async resign(currentPlayer?: Player): Promise<GameState> {
    const winner = this.state.currentPlayer === Player.BLACK ? Player.WHITE : Player.BLACK;
    this.state = {
        ...this.state,
        isGameOver: true,
        winner: winner,
        message: `Resigned. ${winner} wins!`
    };
    return { ...this.state };
  }
}