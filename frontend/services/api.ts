import { IGameService, GameConfig, GameState, MoveResult, Player, SavedGame } from '../types';
import { LocalGameService } from './localGame';

// Toggle this to false if you are running the python server
const USE_MOCK_BACKEND = false; 
const API_URL = '/api/game';

export class RemoteGameService implements IGameService {
  private gameId: string | null = null;
  private currentState: GameState | null = null;

  async startGame(config: GameConfig): Promise<GameState> {
    const res = await fetch(`${API_URL}/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });
    const data = await res.json();
    if (!res.ok) {
        console.error("API Error on startGame:", data);
        throw new Error(data.detail || "Failed to start game");
    }
    
    this.gameId = data.gameId;
    this.currentState = data.state;
    return data.state;
  }

  async loadGame(savedGame: SavedGame): Promise<GameState> {
    const res = await fetch(`${API_URL}/load`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(savedGame)
    });
    const data = await res.json();
    if (!res.ok) {
        console.error("API Error on loadGame:", data);
        throw new Error(data.detail || "Failed to load game");
    }
    
    this.gameId = data.gameId;
    this.currentState = data.state;
    return data.state;
  }

  async makeMove(x: number, y: number): Promise<MoveResult> {
    if (!this.gameId) throw new Error("No game started");
    
    const res = await fetch(`${API_URL}/${this.gameId}/move`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ x, y })
    });
    const data = await res.json();
    
    if (!res.ok || !data.success) { // Check res.ok for HTTP errors and data.success for backend logic errors
        console.error("API Error on makeMove:", data);
        return { success: false, error: data.detail || data.error || "Failed to make move" };
    }
    this.currentState = data.state;
    return { success: true, state: data.state };
  }

  async undo(): Promise<GameState> {
    if (!this.gameId) throw new Error("No game started");
    const res = await fetch(`${API_URL}/${this.gameId}/undo`, { method: 'POST' });
    const data = await res.json();
    if (!res.ok) {
        console.error("API Error on undo:", data);
        throw new Error(data.detail || "Failed to undo move");
    }
    this.currentState = data.state;
    return data.state;
  }

  async pass(currentPlayer: Player): Promise<GameState> { // Added currentPlayer parameter
    if (!this.gameId) throw new Error("No game started");
    const res = await fetch(`${API_URL}/${this.gameId}/pass`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ player: currentPlayer }) // Send wrapped object
    });
    const data = await res.json();
    if (!res.ok) {
        console.error("API Error on pass:", data);
        throw new Error(data.detail || "Failed to pass turn");
    }
    this.currentState = data.state;
    return data.state;
  }

  async resign(currentPlayer: Player): Promise<GameState> { // Added currentPlayer parameter
     if (!this.gameId) throw new Error("No game started");
    const res = await fetch(`${API_URL}/${this.gameId}/resign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ player: currentPlayer }) // Send wrapped object
    });
    const data = await res.json();
    if (!res.ok) {
        console.error("API Error on resign:", data);
        throw new Error(data.detail || "Failed to resign game");
    }
    this.currentState = data.state;
    return data.state;
  }

  getGameState(): GameState {
      if (!this.currentState) throw new Error("Game not initialized");
      return this.currentState;
  }
}

// Factory to get the appropriate service
export const getGameService = (): IGameService => {
    return USE_MOCK_BACKEND ? new LocalGameService() : new RemoteGameService();
};