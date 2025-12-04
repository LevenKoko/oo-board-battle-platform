import { 
  IGameService, GameConfig, GameState, MoveResult, Player, SavedGame,
  UserCreate, UserLogin, Token, MatchInfo, MatchListResponse
} from '../types';
import { LocalGameService } from './localGame';

// Toggle this to false if you are running the python server
const USE_MOCK_BACKEND = false; 
const API_BASE_URL = '/api';
const GAME_API_URL = `${API_BASE_URL}/game`;
const AUTH_API_URL = `${API_BASE_URL}/auth`;
const REPLAY_API_URL = `${API_BASE_URL}/replays`;
const ROOMS_API_URL = `${API_BASE_URL}/rooms`;

let authToken: string | null = null; // Store token in memory

// Generic fetch wrapper for API calls
async function apiFetch<T>(
  url: string, 
  method: string = 'GET', 
  body: object | null = null, 
  requiresAuth: boolean = false
): Promise<T> {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  if (requiresAuth) {
    const token = AuthService.getToken();
    if (!token) {
      throw new Error("Authentication token not found.");
    }
    headers['Authorization'] = `Bearer ${token}`;
  }

  const options: RequestInit = {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  };

  const res = await fetch(url, options);
  const data = await res.json();

  if (!res.ok) {
    console.error(`API Error (${method} ${url}):`, data);
    throw new Error(data.detail || data.error || `API request failed with status ${res.status}`);
  }
  return data as T;
}

export class AuthService {
  static setToken(token: string) {
    authToken = token;
    localStorage.setItem('authToken', token); // Persist token
  }

  static getToken(): string | null {
    if (!authToken) {
      authToken = localStorage.getItem('authToken');
    }
    return authToken;
  }

  static removeToken() {
    authToken = null;
    localStorage.removeItem('authToken');
  }

  static async register(credentials: UserCreate): Promise<UserCreate> {
    return apiFetch<UserCreate>(`${AUTH_API_URL}/register`, 'POST', credentials);
  }

  static async login(credentials: UserLogin): Promise<Token> {
    // Note: login uses x-www-form-urlencoded
    const formBody = new URLSearchParams();
    formBody.append('username', credentials.username);
    formBody.append('password', credentials.password);

    const headers: HeadersInit = {};
    headers['Content-Type'] = 'application/x-www-form-urlencoded';

    const res = await fetch(`${AUTH_API_URL}/login`, {
      method: 'POST',
      headers,
      body: formBody.toString(),
    });
    const data = await res.json();

    if (!res.ok) {
        console.error("API Error on login:", data);
        throw new Error(data.detail || data.error || "Login failed");
    }
    AuthService.setToken(data.access_token);
    return data as Token;
  }

  static async fetchCurrentUser(): Promise<UserCreate | null> {
    try {
      const user = await apiFetch<UserCreate>(`${API_BASE_URL}/users/me`, 'GET', null, true);
      return user;
    } catch (error) {
      console.error("Failed to fetch current user:", error);
      AuthService.removeToken(); // Clear invalid token
      return null;
    }
  }

  static isAuthenticated(): boolean {
    return !!AuthService.getToken();
  }
}

export class RoomService {
    static async fetchRooms(): Promise<MatchListResponse> {
        return apiFetch<MatchListResponse>(`${ROOMS_API_URL}`, 'GET', null, true);
    }

    static async createRoom(config: GameConfig): Promise<MatchInfo> {
        return apiFetch<MatchInfo>(`${ROOMS_API_URL}/create`, 'POST', config, true);
    }

    static async joinRoom(roomId: number): Promise<MatchInfo> {
        return apiFetch<MatchInfo>(`${ROOMS_API_URL}/${roomId}/join`, 'POST', null, true);
    }
}

export class ReplayService {
    static async fetchMyReplays(): Promise<MatchListResponse> {
        return apiFetch<MatchListResponse>(`${REPLAY_API_URL}/me`, 'GET', null, true);
    }

    static async fetchReplayById(matchId: number): Promise<MatchInfo> {
        return apiFetch<MatchInfo>(`${REPLAY_API_URL}/${matchId}`, 'GET', null, true);
    }

    static async deleteReplay(matchId: number): Promise<void> {
        return apiFetch<void>(`${REPLAY_API_URL}/${matchId}`, 'DELETE', null, true);
    }

    static async saveReplay(config: GameConfig, state: GameState, meta: any = {}): Promise<MatchInfo> {
        return apiFetch<MatchInfo>(`${REPLAY_API_URL}/save`, 'POST', { config, state, meta }, true);
    }
}

export class RemoteGameService implements IGameService {
  private gameId: string | null = null;
  private currentState: GameState | null = null;

  constructor() {
    // Attempt to restore gameId from session storage if page refreshed during a game
    this.gameId = sessionStorage.getItem('activeGameId');
  }

  async startGame(config: GameConfig): Promise<GameState> {
    const data = await apiFetch<any>(`${GAME_API_URL}/start`, 'POST', config, true);
    
    this.gameId = data.gameId;
    this.currentState = data.state;
    sessionStorage.setItem('activeGameId', data.gameId); // Persist game ID
    return data.state;
  }

  async loadGame(savedGame: SavedGame): Promise<GameState> {
    const data = await apiFetch<any>(`${GAME_API_URL}/load`, 'POST', savedGame, true);
    
    this.gameId = data.gameId;
    this.currentState = data.state;
    sessionStorage.setItem('activeGameId', data.gameId);
    return data.state;
  }

  async makeMove(x: number, y: number): Promise<MoveResult> {
    if (!this.gameId) throw new Error("No game started");
    
    const data = await apiFetch<any>(`${GAME_API_URL}/${this.gameId}/move`, 'POST', { x, y }, true);
    
    if (!data.success) {
        return { success: false, error: data.error || "Failed to make move" };
    }
    this.currentState = data.state;
    return { success: true, state: data.state };
  }

  async triggerAiMove(): Promise<MoveResult> {
    if (!this.gameId) throw new Error("No game started");
    
    const data = await apiFetch<any>(`${GAME_API_URL}/${this.gameId}/trigger_ai`, 'POST', {}, true);
    
    if (!data.success) {
        return { success: false, error: data.error || "Failed to trigger AI" };
    }
    this.currentState = data.state;
    return { success: true, state: data.state };
  }

  async undo(): Promise<GameState> {
    if (!this.gameId) throw new Error("No game started");
    const data = await apiFetch<any>(`${GAME_API_URL}/${this.gameId}/undo`, 'POST', null, true);
    this.currentState = data.state;
    return data.state;
  }

  async pass(currentPlayer: Player): Promise<GameState> {
    if (!this.gameId) throw new Error("No game started");
    const data = await apiFetch<any>(`${GAME_API_URL}/${this.gameId}/pass`, 'POST', { player: currentPlayer }, true);
    this.currentState = data.state;
    return data.state;
  }

  async resign(currentPlayer: Player): Promise<GameState> {
    if (!this.gameId) throw new Error("No game started");
    const data = await apiFetch<any>(`${GAME_API_URL}/${this.gameId}/resign`, 'POST', { player: currentPlayer }, true);
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