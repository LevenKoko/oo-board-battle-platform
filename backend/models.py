from enum import Enum
from typing import List, Optional, Dict, Tuple, Union, Any # Added Union, Any
from pydantic import BaseModel, Field

# --- Enums ---

class Player(str, Enum):
    BLACK = "BLACK"
    WHITE = "WHITE"

class GameType(str, Enum):
    GOMOKU = "GOMOKU"
    GO = "GO"
    REVERSI = "REVERSI"

class AILevel(str, Enum):
    HUMAN = "HUMAN" # Not an AI, but a placeholder for player type
    GREEDY = "GREEDY"
    MINIMAX = "MINIMAX"
    MCTS = "MCTS"

class UserCreate(BaseModel):
    username: str
    password: str

class UserLogin(BaseModel):
    username: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None

class GameStatus(str, Enum):
    ONGOING = "ongoing"
    BLACK_WIN = "black_win"
    WHITE_WIN = "white_win"
    DRAW = "draw"
    RESIGNED = "resigned" # Player resigned

# --- Core Data Models (aligned with frontend types.ts) ---

class BoardGrid(BaseModel):
    # A 2D array representing the board. Null for empty cells.
    # Frontend expects (Player | null)[][]
    grid: List[List[Optional[Player]]]

class Move(BaseModel):
    x: int
    y: int
    player: Player # Player who made the move

class GameState(BaseModel):
    game_id: str = Field(..., alias="gameId") # Unique ID for the game instance
    grid: List[List[Optional[Player]]]
    current_player: Player = Field(..., alias="currentPlayer")
    history: List[BoardGrid] # History of board states for undo
    prisoners: Dict[Player, int] = {} # For Go: count of captured opponent pieces
    is_game_over: bool = Field(False, alias="isGameOver")
    winner: Optional[Player] = None
    message: Optional[str] = None
    last_move: Optional[Move] = Field(None, alias="lastMove")
    game_type: GameType = Field(..., alias="gameType")
    board_size: int = Field(..., alias="boardSize")
    valid_moves: List[Tuple[int, int]] = Field([], alias="validMoves")


# --- API Request/Response Models ---

class GameConfig(BaseModel):
    board_size: int = Field(..., alias="boardSize")
    game_type: GameType = Field(..., alias="gameType")
    
    player_black_is_ai: bool = Field(False, alias="playerBlackIsAI")
    player_white_is_ai: bool = Field(False, alias="playerWhiteIsAI")
    # Separate AI levels
    black_ai_level: Optional[AILevel] = Field(AILevel.GREEDY, alias="blackAILevel")
    white_ai_level: Optional[AILevel] = Field(AILevel.GREEDY, alias="whiteAILevel")


class StartGameResponse(BaseModel):
    game_id: str = Field(..., alias="gameId")
    state: GameState

class MakeMoveRequest(BaseModel):
    x: int
    y: int

class MoveResult(BaseModel):
    success: bool
    state: Optional[GameState] = None
    error: Optional[str] = None

class SimpleGameResponse(BaseModel):
    state: GameState

class LoadGameRequest(BaseModel):
    config: GameConfig
    state: GameState
    timestamp: int

class PlayerRequest(BaseModel):
    player: Player

class MatchInfo(BaseModel):
    id: int
    game_type: GameType = Field(..., alias="gameType")
    player_black_name: str = Field("AI", alias="playerBlackName")
    player_white_name: str = Field("AI", alias="playerWhiteName")
    result: Optional[str] = None
    start_time: str = Field(..., alias="startTime") # Use string for datetime
    end_time: Optional[str] = Field(None, alias="endTime")
    moves_json: Union[List[Dict], Dict[str, Any]] = Field(..., alias="movesJson") # Changed type

class MatchListResponse(BaseModel):
    matches: List[MatchInfo]
