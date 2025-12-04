from typing import Dict, Optional, Tuple
from sqlalchemy.orm import Session
from pydantic import BaseModel # Added BaseModel
from board_battle_project.backend.game.base import AbstractGame
from board_battle_project.backend.game.gomoku import GomokuGame
from board_battle_project.backend.game.go import GoGame
from board_battle_project.backend.game.reversi import ReversiGame
from board_battle_project.backend.models import GameType, Player, MoveResult, GameState, GameConfig, AILevel
from board_battle_project.backend.ai.reversi_ai import GreedyReversiAI, MinimaxReversiAI, AIStrategy
from board_battle_project.backend.ai.gomoku_ai import GreedyGomokuAI, MinimaxGomokuAI
from board_battle_project.backend.db_models import Match, User 
import json 

class RoomSession(BaseModel):
    match_id: str
    black_player_id: Optional[int] = None
    white_player_id: Optional[int] = None
    black_ready: bool = False
    white_ready: bool = False
    config: Optional[GameConfig] = None
    swap_request_from: Optional[int] = None # User ID who requested swap
    last_action_was_undo: bool = False # Track consecutive undos

class GameController:
    _instance: Optional['GameController'] = None
    _active_games: Dict[str, AbstractGame] = {}
    _ai_configs: Dict[str, Dict[Player, AILevel]] = {} 
    _game_player_map: Dict[str, Tuple[Optional[int], Optional[int]]] = {} 
    _room_sessions: Dict[str, RoomSession] = {} # New: track room lobby state

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(GameController, cls).__new__(cls)
        return cls._instance

    def get_or_create_session(self, match_id: str, config: GameConfig = None, black_id: int = None, white_id: int = None) -> RoomSession:
        if match_id not in self._room_sessions:
            self._room_sessions[match_id] = RoomSession(
                match_id=match_id,
                config=config,
                black_player_id=black_id,
                white_player_id=white_id
            )
        return self._room_sessions[match_id]

    def update_session_players(self, match_id: str, user_id: int):
        session = self._room_sessions.get(match_id)
        if not session: return
        
        # Assign user to a slot if not already assigned
        if session.black_player_id == user_id or session.white_player_id == user_id:
            return # Already in
        
        if session.black_player_id is None:
            session.black_player_id = user_id
        elif session.white_player_id is None:
            session.white_player_id = user_id
    
    def request_switch_sides(self, match_id: str, user_id: int) -> RoomSession:
        session = self._room_sessions.get(match_id)
        if session:
            session.swap_request_from = user_id
        return session

    def approve_switch_sides(self, match_id: str, user_id: int) -> RoomSession:
        session = self._room_sessions.get(match_id)
        if session and session.swap_request_from:
            # Only allow if user is NOT the requester (basic check, can be stricter)
            if session.swap_request_from != user_id:
                # Perform swap
                session.black_player_id, session.white_player_id = session.white_player_id, session.black_player_id
                # Reset ready status
                session.black_ready = False
                session.white_ready = False
            # Clear request
            session.swap_request_from = None
        return session

    def reject_switch_sides(self, match_id: str, user_id: int) -> RoomSession:
        session = self._room_sessions.get(match_id)
        if session:
            session.swap_request_from = None
        return session

    def handle_player_disconnect(self, match_id: str, user_id: int) -> Tuple[Optional[RoomSession], Optional[AbstractGame], bool]: # Added bool for cleanup status
        session = self._room_sessions.get(match_id)
        game = self.get_game(match_id)
        
        cleaned_up = False

        if session:
            # Clear slots
            if session.black_player_id == user_id:
                session.black_player_id = None
                session.black_ready = False
            if session.white_player_id == user_id:
                session.white_player_id = None
                session.white_ready = False
            
            # If game is active and user was a player, trigger resign
            if game and not game.is_game_over:
                player_color = None
                if user_id == self._game_player_map.get(match_id, (None, None))[0]:
                    player_color = Player.BLACK
                elif user_id == self._game_player_map.get(match_id, (None, None))[1]:
                    player_color = Player.WHITE
                
                if player_color:
                    print(f"Player {user_id} disconnected during game. Triggering resign.")
                    game.resign(player_color)
            
            # Check if room is empty
            if session.black_player_id is None and session.white_player_id is None:
                self.remove_game(match_id) # Remove active game instance
                del self._room_sessions[match_id] # Remove room session
                cleaned_up = True

        return session, game, cleaned_up

    def toggle_ready(self, match_id: str, user_id: int) -> RoomSession:
        session = self._room_sessions.get(match_id)
        if session:
            if session.black_player_id == user_id:
                session.black_ready = not session.black_ready
            elif session.white_player_id == user_id:
                session.white_ready = not session.white_ready
        return session

    def create_game(self, config: GameConfig, black_user_id: Optional[int] = None, white_user_id: Optional[int] = None, game_id_override: Optional[str] = None) -> AbstractGame:
        game: AbstractGame
        if config.game_type == GameType.GOMOKU:
            game = GomokuGame(config.board_size)
        elif config.game_type == GameType.GO:
            game = GoGame(config.board_size)
        elif config.game_type == GameType.REVERSI:
            game = ReversiGame(config.board_size)
        else:
            raise ValueError(f"Unknown game type: {config.game_type}")
        
        if game_id_override:
            game.game_id = game_id_override
        
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
            # Reset undo flag
            session = self._room_sessions.get(game_id)
            if session:
                session.last_action_was_undo = False

            # After human move, check for AI opponent
            if not game.is_game_over:
                self._make_ai_move_if_possible(game_id)
            return MoveResult(success=True, state=game.get_state())
        else:
            return MoveResult(success=False, error=message)

    def request_undo(self, game_id: str, user_id: int) -> MoveResult:
        game = self.get_game(game_id)
        session = self._room_sessions.get(game_id)
        if not game or not session:
            return MoveResult(success=False, error="Game or session not found.")
        
        if session.last_action_was_undo:
            return MoveResult(success=False, error="Cannot undo consecutively.")

        # Determine steps to undo
        steps_to_undo = 0
        
        # Identify player color
        player_color = None
        black_id, white_id = self._game_player_map.get(game_id, (None, None))
        if user_id == black_id:
            player_color = Player.BLACK
        elif user_id == white_id:
            player_color = Player.WHITE
        
        if not player_color:
             return MoveResult(success=False, error="You are not a player.")

        if game.current_player == player_color:
            # It's my turn. Opponent just moved.
            # Requirement: Cannot undo opponent's move. Cannot undo my previous move because opponent moved.
            return MoveResult(success=False, error="Cannot undo after opponent has moved.")
        else:
            # It's opponent's turn. I just moved.
            # Requirement: I can undo my move before opponent moves.
            steps_to_undo = 1
        
        if len(game.history) <= steps_to_undo:
             return MoveResult(success=False, error="Cannot undo: Start of game.")

        # Execute Undo
        for _ in range(steps_to_undo):
            game.undo_last_move()
        
        session.last_action_was_undo = True
        return MoveResult(success=True, state=game.get_state())

    def _make_ai_move_if_possible(self, game_id: str):
        game = self.get_game(game_id)
        if not game or game.is_game_over:
            return

        ai_level = self._ai_configs.get(game_id, {}).get(game.current_player)
        print(f"DEBUG: _make_ai_move game={game_id} current={game.current_player} level={ai_level}") # DEBUG

        if ai_level and ai_level != AILevel.HUMAN:
            ai_strategy = self._get_ai_strategy(game.game_type, ai_level)
            if ai_strategy:
                print(f"DEBUG: AI Strategy found for {game.game_type}") # DEBUG
                if isinstance(game, ReversiGame):
                    ai_move_x, ai_move_y = ai_strategy.make_move(game, game.current_player)
                    print(f"DEBUG: AI calculated move ({ai_move_x}, {ai_move_y})") # DEBUG
                    if (ai_move_x, ai_move_y) != (-1, -1): 
                        success, msg = game.make_move(ai_move_x, ai_move_y)
                        print(f"DEBUG: AI make_move result: {success}, {msg}") # DEBUG
                    else:
                        print("DEBUG: AI passing turn") # DEBUG
                        game.pass_turn(game.current_player) 
                elif isinstance(game, GomokuGame):
                    ai_move_x, ai_move_y = ai_strategy.make_move(game, game.current_player)
                    print(f"DEBUG: AI calculated move ({ai_move_x}, {ai_move_y})") # DEBUG
                    if (ai_move_x, ai_move_y) != (-1, -1):
                        success, msg = game.make_move(ai_move_x, ai_move_y)
                        print(f"DEBUG: AI make_move result: {success}, {msg}") # DEBUG
                    else:
                        pass
                
    def trigger_ai_move(self, game_id: str) -> MoveResult:
        game = self.get_game(game_id)
        if not game:
            return MoveResult(success=False, error="Game not found.")
        
        if game.is_game_over:
             return MoveResult(success=False, error="Game is over.")

        ai_level = self._ai_configs.get(game_id, {}).get(game.current_player)
        print(f"DEBUG: trigger_ai_move game={game_id} player={game.current_player} level={ai_level}") # DEBUG

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

        from board_battle_project.backend.models import MatchStatus # Ensure MatchStatus is imported if not already available in scope (it is imported from models)

        new_match = Match(
            player_black_id=black_user_id,
            player_white_id=white_user_id,
            game_type=game.game_type.value, # Store enum value as string
            result=result_str,
            status=MatchStatus.COMPLETED, # Fix: Archive should be COMPLETED
            moves_json=moves_data, 
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


