from enum import Enum
from typing import List, Optional, Dict, Tuple, Union, Any 
from pydantic import BaseModel, Field, ConfigDict, model_validator

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

class MatchStatus(str, Enum):
    WAITING = "WAITING"
    PLAYING = "PLAYING"
    COMPLETED = "COMPLETED"
    ABANDONED = "ABANDONED"
    SAVED = "SAVED" # For manual saves

class GameStatus(str, Enum):
    ONGOING = "ongoing"
    BLACK_WIN = "black_win"
    WHITE_WIN = "white_win"
    DRAW = "draw"
    RESIGNED = "resigned" # Player resigned

# --- Pydantic Models ---

class GameConfig(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    board_size: int = Field(..., alias="boardSize")
    game_type: GameType = Field(..., alias="gameType")
    player_black_is_ai: bool = Field(False, alias="playerBlackIsAI")
    player_white_is_ai: bool = Field(False, alias="playerWhiteIsAI")
    ai_level: AILevel = Field(AILevel.HUMAN, alias="aiLevel")
    black_ai_level: Optional[AILevel] = Field(None, alias="blackAILevel")
    white_ai_level: Optional[AILevel] = Field(None, alias="whiteAILevel")

class Move(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    x: int
    y: int
    player: Player

class BoardGrid(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    grid: List[List[Optional[Player]]]

    @model_validator(mode='before')
    @classmethod
    def check_grid_format(cls, v: Any) -> Any:
        if isinstance(v, list):
            return {'grid': v}
        return v

class GameState(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    game_id: str = Field(..., alias="gameId")
    grid: List[List[Optional[Player]]]
    current_player: Player = Field(..., alias="currentPlayer")
    history: List[BoardGrid]
    prisoners: Dict[Player, int]
    is_game_over: bool = Field(..., alias="isGameOver")
    winner: Optional[Union[Player, str]] = None
    message: Optional[str] = ""
    last_move: Optional[Move] = Field(None, alias="lastMove")
    game_type: GameType = Field(..., alias="gameType")
    board_size: int = Field(..., alias="boardSize")
    valid_moves: List[Tuple[int, int]] = Field([], alias="validMoves")

class StartGameResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    game_id: str = Field(..., alias="gameId")
    state: GameState

class MakeMoveRequest(BaseModel):
    x: int
    y: int

class MoveResult(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    success: bool
    state: Optional[GameState] = None
    error: Optional[str] = None

class SimpleGameResponse(BaseModel):
    state: GameState

class UserCreate(BaseModel):
    username: str
    password: str

class UserResponse(BaseModel):
    id: int
    username: str
    total_games: int = 0
    wins: int = 0

class UserLogin(BaseModel):
    username: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None

class SaveGameRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    config: GameConfig
    state: GameState
    meta: Dict[str, Any] = {}

class LoadGameRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    config: GameConfig
    state: GameState
    timestamp: int

class PlayerRequest(BaseModel):
    player: Player

class MatchInfo(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    id: int
    game_type: GameType = Field(..., alias="gameType")
    player_black_name: str = Field("AI", alias="playerBlackName")
    player_white_name: str = Field("AI", alias="playerWhiteName")
    result: Optional[str] = None
    start_time: str = Field(..., alias="startTime") 
    end_time: Optional[str] = Field(None, alias="endTime")
    moves_json: Union[List[Dict], Dict[str, Any]] = Field(..., alias="movesJson") 

class MatchListResponse(BaseModel):
    matches: List[MatchInfo]