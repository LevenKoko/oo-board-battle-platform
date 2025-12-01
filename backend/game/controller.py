from typing import Dict, Optional
from board_battle_project.backend.game.base import AbstractGame
from board_battle_project.backend.game.gomoku import GomokuGame
from board_battle_project.backend.game.go import GoGame
from board_battle_project.backend.models import GameType, Player, MoveResult, GameState

class GameController:
    _instance: Optional['GameController'] = None
    _active_games: Dict[str, AbstractGame] = {}

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(GameController, cls).__new__(cls)
        return cls._instance

    def create_game(self, game_type: GameType, board_size: int) -> AbstractGame:
        if game_type == GameType.GOMOKU:
            game = GomokuGame(board_size)
        elif game_type == GameType.GO:
            game = GoGame(board_size)
        else:
            raise ValueError(f"Unknown game type: {game_type}")
        
        self._active_games[game.game_id] = game
        return game

    def get_game(self, game_id: str) -> Optional[AbstractGame]:
        return self._active_games.get(game_id)

    def make_move(self, game_id: str, x: int, y: int) -> MoveResult:
        game = self.get_game(game_id)
        if not game:
            return MoveResult(success=False, error="Game not found.")
        
        success, message = game.make_move(x, y)
        if success:
            return MoveResult(success=True, state=game.get_state())
        else:
            return MoveResult(success=False, error=message)

    def undo_move(self, game_id: str) -> MoveResult:
        game = self.get_game(game_id)
        if not game:
            return MoveResult(success=False, error="Game not found.")
        
        success, message = game.undo_last_move()
        if success:
            return MoveResult(success=True, state=game.get_state())
        else:
            return MoveResult(success=False, error=message)

    def pass_turn(self, game_id: str, player: Player) -> MoveResult:
        game = self.get_game(game_id)
        if not game:
            return MoveResult(success=False, error="Game not found.")
        
        success, message = game.pass_turn(player)
        if success:
            return MoveResult(success=True, state=game.get_state())
        else:
            return MoveResult(success=False, error=message)

    def resign_game(self, game_id: str, player: Player) -> MoveResult:
        game = self.get_game(game_id)
        if not game:
            return MoveResult(success=False, error="Game not found.")
        
        game.resign(player)
        return MoveResult(success=True, state=game.get_state())

    def remove_game(self, game_id: str) -> None:
        if game_id in self._active_games:
            del self._active_games[game_id]

    def load_game(self, game_type: GameType, board_size: int, state: GameState) -> AbstractGame:
        # Create a new game instance with a fresh ID
        game = self.create_game(game_type, board_size)
        # Load the state into this new instance
        game.load_from_state(state)
        # Ensure the game ID in the state matches the new instance's ID (optional, but good for consistency)
        # Actually, AbstractGame.get_state() uses self.game_id, so it will return the new ID.
        return game
