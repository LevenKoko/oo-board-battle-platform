from typing import Dict, Optional, Tuple
from sqlalchemy.orm import Session
from board_battle_project.backend.game.base import AbstractGame
from board_battle_project.backend.game.gomoku import GomokuGame
from board_battle_project.backend.game.go import GoGame
from board_battle_project.backend.game.reversi import ReversiGame
from board_battle_project.backend.models import GameType, Player, MoveResult, GameState, GameConfig, AILevel
from board_battle_project.backend.ai.reversi_ai import GreedyReversiAI, MinimaxReversiAI, AIStrategy
from board_battle_project.backend.ai.gomoku_ai import GreedyGomokuAI, MinimaxGomokuAI
from board_battle_project.backend.db_models import Match, User # Import Match and User for saving game results
import json # For serializing moves_json

class GameController:
    _instance: Optional['GameController'] = None
    _active_games: Dict[str, AbstractGame] = {}
    _ai_configs: Dict[str, Dict[Player, AILevel]] = {} # game_id -> {Player.BLACK: AILevel, Player.WHITE: AILevel}
    _game_player_map: Dict[str, Tuple[Optional[int], Optional[int]]] = {} # game_id -> (black_user_id, white_user_id)

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(GameController, cls).__new__(cls)
        return cls._instance

    def create_game(self, config: GameConfig, black_user_id: Optional[int] = None, white_user_id: Optional[int] = None) -> AbstractGame:
        game: AbstractGame
        if config.game_type == GameType.GOMOKU:
            game = GomokuGame(config.board_size)
        elif config.game_type == GameType.GO:
            game = GoGame(config.board_size)
        elif config.game_type == GameType.REVERSI:
            game = ReversiGame(config.board_size)
        else:
            raise ValueError(f"Unknown game type: {config.game_type}")
        
        self._active_games[game.game_id] = game
        self._game_player_map[game.game_id] = (black_user_id, white_user_id)
        
        ai_config_for_game = {}
        if config.player_black_is_ai:
            ai_config_for_game[Player.BLACK] = config.black_ai_level or AILevel.GREEDY
        else:
            ai_config_for_game[Player.BLACK] = AILevel.HUMAN

        if config.player_white_is_ai:
            ai_config_for_game[Player.WHITE] = config.white_ai_level or AILevel.GREEDY
        else:
            ai_config_for_game[Player.WHITE] = AILevel.HUMAN
        
        self._ai_configs[game.game_id] = ai_config_for_game

        # If the first player is AI, make a move immediately
        if self._ai_configs[game.game_id].get(game.current_player) != AILevel.HUMAN:
            self._make_ai_move_if_possible(game.game_id)
        
        return game

    def get_game(self, game_id: str) -> Optional[AbstractGame]:
        return self._active_games.get(game_id)

    def _get_ai_strategy(self, game_type: GameType, ai_level: AILevel) -> Optional[AIStrategy]:
        if game_type == GameType.REVERSI:
            if ai_level == AILevel.GREEDY:
                return GreedyReversiAI()
            elif ai_level == AILevel.MINIMAX:
                return MinimaxReversiAI(depth=3) # Default depth
            elif ai_level == AILevel.MCTS:
                # Placeholder: MCTS not fully implemented, using Minimax with higher depth
                return MinimaxReversiAI(depth=4)
        elif game_type == GameType.GOMOKU:
            if ai_level == AILevel.GREEDY:
                return GreedyGomokuAI()
            elif ai_level == AILevel.MINIMAX:
                return MinimaxGomokuAI(depth=2)
            elif ai_level == AILevel.MCTS:
                return MinimaxGomokuAI(depth=3) # Slightly deeper for Hard
        
        return None

    def make_move(self, game_id: str, x: int, y: int) -> MoveResult:
        game = self.get_game(game_id)
        if not game:
            return MoveResult(success=False, error="Game not found.")
        
        # Ensure it's not an AI's turn when a human tries to move
        if self._ai_configs.get(game_id, {}).get(game.current_player) != AILevel.HUMAN:
            return MoveResult(success=False, error="It's AI's turn.")

        success, message = game.make_move(x, y)
        if success:
            # After human move, check for AI opponent
            if not game.is_game_over:
                self._make_ai_move_if_possible(game_id)
            return MoveResult(success=True, state=game.get_state())
        else:
            return MoveResult(success=False, error=message)

    def _make_ai_move_if_possible(self, game_id: str):
        game = self.get_game(game_id)
        if not game or game.is_game_over:
            return

        ai_level = self._ai_configs.get(game_id, {}).get(game.current_player)
        if ai_level and ai_level != AILevel.HUMAN:
            ai_strategy = self._get_ai_strategy(game.game_type, ai_level)
            if ai_strategy:
                if isinstance(game, ReversiGame):
                    ai_move_x, ai_move_y = ai_strategy.make_move(game, game.current_player)
                    if (ai_move_x, ai_move_y) != (-1, -1): # -1,-1 means no valid move, i.e., pass
                        game.make_move(ai_move_x, ai_move_y)
                    else:
                        game.pass_turn(game.current_player) # AI has to pass
                elif isinstance(game, GomokuGame):
                    ai_move_x, ai_move_y = ai_strategy.make_move(game, game.current_player)
                    if (ai_move_x, ai_move_y) != (-1, -1):
                        game.make_move(ai_move_x, ai_move_y)
                    else:
                        # Should not happen in Gomoku unless board full (which is game over)
                        pass
                
    def trigger_ai_move(self, game_id: str) -> MoveResult:
        game = self.get_game(game_id)
        if not game:
            return MoveResult(success=False, error="Game not found.")
        
        if game.is_game_over:
             return MoveResult(success=False, error="Game is over.")

        ai_level = self._ai_configs.get(game_id, {}).get(game.current_player)
        if ai_level == AILevel.HUMAN:
             return MoveResult(success=False, error="It's not AI's turn.")
        
        # Execute AI move
        self._make_ai_move_if_possible(game_id)
        
        return MoveResult(success=True, state=game.get_state())

    def undo_move(self, game_id: str) -> MoveResult:
        game = self.get_game(game_id)
        if not game:
            return MoveResult(success=False, error="Game not found.")
        
        success, message = game.undo_last_move()
        if success:
            # If the last move undone was an AI move, undo the human move before it too
            # This needs more sophisticated history tracking to distinguish human/AI moves
            # For now, a simple undo only reverts one step.
            return MoveResult(success=True, state=game.get_state())
        else:
            return MoveResult(success=False, error=message)

    def pass_turn(self, game_id: str, player: Player) -> MoveResult:
        game = self.get_game(game_id)
        if not game:
            return MoveResult(success=False, error="Game not found.")
        
        # Ensure it's not an AI's turn when a human tries to pass
        if self._ai_configs.get(game_id, {}).get(game.current_player) != AILevel.HUMAN:
            return MoveResult(success=False, error="It's AI's turn to pass (or make a move).")

        success, message = game.pass_turn(player)
        if success:
            if not game.is_game_over:
                self._make_ai_move_if_possible(game_id) # After human pass, check for AI opponent
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
        if game_id in self._ai_configs:
            del self._ai_configs[game_id]
        if game_id in self._game_player_map:
            del self._game_player_map[game_id]

    def load_game(self, config: GameConfig, state: GameState, black_user_id: Optional[int] = None, white_user_id: Optional[int] = None) -> AbstractGame:
        # Create a new game instance with a fresh ID
        game = self.create_game(config, black_user_id, white_user_id) # Create with new config, which will set up _ai_configs and _game_player_map
        # Load the state into this new instance
        game.load_from_state(state)
        # Re-check AI move if current player is AI after loading
        if self._ai_configs[game.game_id].get(game.current_player) != AILevel.HUMAN:
            self._make_ai_move_if_possible(game.game_id)
        return game

    def save_game_result(self, game_id: str, db: Session, black_player_id_override: Optional[int] = None, white_player_id_override: Optional[int] = None) -> None:
        game = self.get_game(game_id)
        if not game:
            print(f"Game with ID {game_id} not found for saving.")
            return

        black_user_id, white_user_id = self._game_player_map.get(game_id, (None, None))
        
        # Use overrides if provided (e.g., for AI vs AI games where no human started)
        black_user_id = black_player_id_override if black_player_id_override is not None else black_user_id
        white_user_id = white_player_id_override if white_player_id_override is not None else white_user_id

        # Prepare moves_json
        # Convert history of BoardGrid objects to a list of dicts/JSON compatible
        moves_history = []
        for board_grid in game.history:
            moves_history.append(json.loads(board_grid.model_dump_json()))

        # Get AI config
        game_ai_config = self._ai_configs.get(game_id, {})
        black_ai = game_ai_config.get(Player.BLACK)
        white_ai = game_ai_config.get(Player.WHITE)

        moves_data = {
            "meta": {
                "black_is_ai": black_ai != AILevel.HUMAN if black_ai else False,
                "white_is_ai": white_ai != AILevel.HUMAN if white_ai else False,
                "black_ai_level": black_ai.value if black_ai else None,
                "white_ai_level": white_ai.value if white_ai else None
            },
            "history": moves_history
        }

        # Determine result string
        result_str: Optional[str] = None
        if game.winner == Player.BLACK:
            result_str = "BLACK_WON"
        elif game.winner == Player.WHITE:
            result_str = "WHITE_WON"
        elif game.winner is None and game.is_game_over:
            result_str = "DRAW" # Assuming draw if game over but no winner (e.g. board full)

        new_match = Match(
            player_black_id=black_user_id,
            player_white_id=white_user_id,
            game_type=game.game_type.value, # Store enum value as string
            result=result_str,
            moves_json=moves_data, # SQLAlchemy's JSON type handles list of dicts directly
        )
        db.add(new_match)
        db.commit()
        db.refresh(new_match)
        print(f"Game {game_id} saved as match {new_match.id}")
        
        # Update user stats (wins/total games) if applicable
        if black_user_id:
            user_black = db.query(User).filter(User.id == black_user_id).first()
            if user_black:
                user_black.total_games += 1
                if result_str == "BLACK_WON":
                    user_black.wins += 1
                db.add(user_black)
        if white_user_id:
            user_white = db.query(User).filter(User.id == white_user_id).first()
            if user_white:
                user_white.total_games += 1
                if result_str == "WHITE_WON":
                    user_white.wins += 1
                db.add(user_white)
        db.commit() # Commit stat updates

        # Remove game from active games after saving
        self.remove_game(game_id)


