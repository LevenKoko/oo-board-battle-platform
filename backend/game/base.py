from abc import ABC, abstractmethod
from typing import List, Optional, Tuple # Added Tuple
import uuid

from board_battle_project.backend.models import Player, GameState, GameType, Move, BoardGrid

class AbstractBoard(ABC):
    def __init__(self, size: int):
        if not (8 <= size <= 19):
            raise ValueError("Board size must be between 8 and 19.")
        self.size = size
        self._grid: List[List[Optional[Player]]] = [[None for _ in range(size)] for _ in range(size)]

    @abstractmethod
    def place_stone(self, x: int, y: int, player: Player) -> bool:
        """Attempt to place a stone at (x, y). Returns True if successful, False otherwise."""
        pass

    def get_stone(self, x: int, y: int) -> Optional[Player]:
        """Get the player at (x, y), or None if empty or out of bounds."""
        if 0 <= x < self.size and 0 <= y < self.size:
            return self._grid[y][x]
        return None

    def is_valid_coordinate(self, x: int, y: int) -> bool:
        """Check if (x, y) is within board bounds."""
        return 0 <= x < self.size and 0 <= y < self.size

    def is_empty(self, x: int, y: int) -> bool:
        """Check if (x, y) is empty and within bounds."""
        return self.is_valid_coordinate(x, y) and self._grid[y][x] is None

    def get_grid(self) -> List[List[Optional[Player]]]:
        """Return a copy of the current grid."""
        return [row[:] for row in self._grid] # Return a copy to prevent external modification

    def clear_cell(self, x: int, y: int):
        """Clear a stone from the cell (x, y)."""
        if self.is_valid_coordinate(x, y):
            self._grid[y][x] = None

class AbstractGame(ABC):
    def __init__(self, board_size: int, game_type: GameType):
        self.game_id: str = str(uuid.uuid4())
        self.board_size: int = board_size
        self.game_type: GameType = game_type
        self.current_player: Player = Player.BLACK # Black always starts
        self.is_game_over: bool = False
        self.winner: Optional[Player] = None
        self.message: Optional[str] = None
        self.history: List[BoardGrid] = [] # Stores previous BoardGrids for undo
        self.last_move: Optional[Move] = None # Stores the last move made
        self.prisoners: dict[Player, int] = {Player.BLACK: 0, Player.WHITE: 0} # For Go

    @abstractmethod
    def _create_board(self, size: int) -> AbstractBoard:
        """Factory method for creating a specific board type."""
        pass

    @abstractmethod
    def make_move(self, x: int, y: int) -> tuple[bool, str]:
        """Attempt to make a move. Returns (success, message)."""
        pass

    @abstractmethod
    def check_game_over(self) -> None:
        """Check if the game has ended and set winner/message."""
        pass

    def _switch_player(self) -> None:
        """Switch the current player."""
        self.current_player = Player.WHITE if self.current_player == Player.BLACK else Player.BLACK

    def get_valid_moves_for_current_player(self) -> List[Tuple[int, int]]:
        """
        Returns a list of all valid (x, y) coordinates where the current player can make a move.
        Default implementation returns an empty list, should be overridden by games that support it.
        """
        return []

    def get_state(self) -> GameState:
        """Return the current game state as a Pydantic model."""
        return GameState(
            gameId=self.game_id,
            grid=self.board.get_grid(),
            currentPlayer=self.current_player,
            history=self.history,
            prisoners=self.prisoners,
            isGameOver=self.is_game_over,
            winner=self.winner,
            message=self.message,
            lastMove=self.last_move,
            gameType=self.game_type,
            boardSize=self.board_size,
            validMoves=self.get_valid_moves_for_current_player() # Include valid moves
        )

    def undo_last_move(self) -> tuple[bool, str]:
        """Undo the last move."""
        if self.is_game_over:
            return False, "Cannot undo, game is over."
        if not self.history or len(self.history) < 2: # Need at least one move to undo + initial state
            return False, "No moves to undo."

        # Revert board to previous state
        previous_board_grid = self.history.pop(-1) # Pop current state
        self.board._grid = [row[:] for row in self.history[-1].grid] # Load the state before the last move
        self._switch_player() # Switch player back

        self.message = "Last move undone."
        self.last_move = None # Clear last move after undo
        # Note: Undo for Go might need more complex logic to revert prisoner counts

        return True, "Successfully undone last move."

    def resign(self, player: Player) -> None:
        """A player resigns the game."""
        self.is_game_over = True
        self.winner = Player.WHITE if player == Player.BLACK else Player.BLACK
        self.message = f"{player.value} has resigned. {self.winner.value} wins!"

    @abstractmethod
    def pass_turn(self, player: Player) -> tuple[bool, str]:
        """Pass the current turn (primarily for Go)."""
        pass

    def load_from_state(self, state: GameState):
        """Load game state from a GameState object."""
        self.current_player = state.current_player
        self.is_game_over = state.is_game_over
        self.winner = state.winner
        self.message = state.message
        self.last_move = state.last_move
        self.prisoners = state.prisoners
        self.history = state.history
        
        # Restore board grid
        # state.grid is List[List[Optional[Player]]]
        # self.board._grid is the same structure
        self.board._grid = [row[:] for row in state.grid]
