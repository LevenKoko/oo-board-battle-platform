from abc import ABC, abstractmethod
from typing import Tuple, Optional
import random

from board_battle_project.backend.models import Player
from board_battle_project.backend.game.reversi import ReversiGame # Assuming AI is for Reversi for now

class AIStrategy(ABC):
    @abstractmethod
    def make_move(self, game: ReversiGame, player: Player) -> Tuple[int, int]:
        """
        Calculates and returns the best move (x, y) for the given player in the current game state.
        """
        pass

class GreedyReversiAI(AIStrategy):
    """
    Greedy AI for Reversi that prioritizes:
    1. Corners
    2. Edges
    3. Max flips
    """
    def make_move(self, game: ReversiGame, player: Player) -> Tuple[int, int]:
        valid_moves = game.board.get_valid_moves(player)
        if not valid_moves:
            return -1, -1 # Indicates no valid move (pass)

        best_score = -1
        best_moves = []

        board_size = game.board_size

        for x, y in valid_moves:
            score = 0
            
            # Prioritize corners
            if (x == 0 and y == 0) or \
               (x == 0 and y == board_size - 1) or \
               (x == board_size - 1 and y == 0) or \
               (x == board_size - 1 and y == board_size - 1):
                score += 100 # High score for corners
            
            # Prioritize edges (but not right next to corners - X-squares)
            elif (x == 0 or x == board_size - 1 or y == 0 or y == board_size - 1):
                # Avoid "C-squares" next to corners if possible for greedy
                is_c_square = False
                if x == 1 and (y == 0 or y == board_size - 1):
                    is_c_square = True
                if x == board_size - 2 and (y == 0 or y == board_size - 1):
                    is_c_square = True
                if y == 1 and (x == 0 or x == board_size - 1):
                    is_c_square = True
                if y == board_size - 2 and (x == 0 or x == board_size - 1):
                    is_c_square = True
                
                if not is_c_square:
                    score += 10 # Good score for edges

            # Calculate flips for the move
            temp_board = [row[:] for row in game.board._grid] # Deep copy current board state
            
            # Simulate placing the stone and flipping
            temp_game = ReversiGame(game.board_size)
            temp_game.board._grid = temp_board
            
            flippable_pieces = temp_game.board._get_flippable_pieces(x, y, player)
            score += len(flippable_pieces) # Add score based on number of flipped pieces

            if score > best_score:
                best_score = score
                best_moves = [(x, y)]
            elif score == best_score:
                best_moves.append((x, y))
            
        return random.choice(best_moves) if best_moves else (-1, -1)

class MinimaxReversiAI(AIStrategy):
    """
    Minimax AI for Reversi with Alpha-Beta pruning.
    """
    def __init__(self, depth: int = 3):
        self.depth = depth

    def make_move(self, game: ReversiGame, player: Player) -> Tuple[int, int]:
        best_score = float('-inf')
        
        valid_moves = game.board.get_valid_moves(player)
        if not valid_moves:
            return -1, -1
            
        # Initialize with all valid moves to allow random choice if all evals are equal (e.g. start)
        best_moves = valid_moves[:] 

        for move in valid_moves:
            x, y = move
            # Create a deep copy of the game state for simulation
            sim_game = ReversiGame(game.board_size)
            sim_game.current_player = game.current_player
            sim_game.is_game_over = game.is_game_over
            sim_game.winner = game.winner
            sim_game.message = game.message
            sim_game.last_move = game.last_move
            sim_game.pass_count = game.pass_count
            sim_game.board._grid = [row[:] for row in game.board._grid] # Deep copy the board grid

            # Simulate the move
            # Note: make_move in ReversiGame will update current_player and check game over
            success, _ = sim_game.make_move(x, y) 
            
            if success:
                # Evaluate the state after the move
                # Minimax assumes the opponent will play optimally (to minimize our score)
                score = self._minimax(sim_game, self.depth - 1, float('-inf'), float('inf'), False, player)
                
                if score > best_score:
                    best_score = score
                    best_moves = [(x, y)]
                elif score == best_score:
                    best_moves.append((x, y))

        return random.choice(best_moves) if best_moves else (-1, -1)

    def _minimax(self, game: ReversiGame, depth: int, alpha: float, beta: float, maximizing_player: bool, original_player: Player) -> float:
        if depth == 0 or game.is_game_over:
            return self._evaluate_board(game, original_player)

        current_ai_player = original_player if maximizing_player else (Player.WHITE if original_player == Player.BLACK else Player.BLACK)
        
        valid_moves = game.board.get_valid_moves(current_ai_player)

        if not valid_moves: # If current player has no moves, force a pass
            sim_game_pass = ReversiGame(game.board_size)
            sim_game_pass.current_player = game.current_player
            sim_game_pass.is_game_over = game.is_game_over
            sim_game_pass.winner = game.winner
            sim_game_pass.message = game.message
            sim_game_pass.last_move = game.last_move
            sim_game_pass.pass_count = game.pass_count
            sim_game_pass.board._grid = [row[:] for row in game.board._grid]
            
            sim_game_pass._switch_player() # Simulate pass
            # Check if game ends after this pass
            if game.pass_count + 1 >= 2 and not game.board.get_valid_moves(sim_game_pass.current_player):
                sim_game_pass.is_game_over = True # Both players passed consecutively
            
            return self._minimax(sim_game_pass, depth - 1, alpha, beta, not maximizing_player, original_player)


        if maximizing_player:
            max_eval = float('-inf')
            for move in valid_moves:
                x, y = move
                sim_game = ReversiGame(game.board_size)
                sim_game.current_player = game.current_player
                sim_game.is_game_over = game.is_game_over
                sim_game.winner = game.winner
                sim_game.message = game.message
                sim_game.last_move = game.last_move
                sim_game.pass_count = game.pass_count
                sim_game.board._grid = [row[:] for row in game.board._grid]
                
                sim_game.make_move(x, y) # This will also switch player internally
                
                eval = self._minimax(sim_game, depth - 1, alpha, beta, False, original_player)
                max_eval = max(max_eval, eval)
                alpha = max(alpha, eval)
                if beta <= alpha:
                    break
            return max_eval
        else:
            min_eval = float('inf')
            for move in valid_moves:
                x, y = move
                sim_game = ReversiGame(game.board_size)
                sim_game.current_player = game.current_player
                sim_game.is_game_over = game.is_game_over
                sim_game.winner = game.winner
                sim_game.message = game.message
                sim_game.last_move = game.last_move
                sim_game.pass_count = game.pass_count
                sim_game.board._grid = [row[:] for row in game.board._grid]
                
                sim_game.make_move(x, y) # This will also switch player internally

                eval = self._minimax(sim_game, depth - 1, alpha, beta, True, original_player)
                min_eval = min(min_eval, eval)
                beta = min(beta, eval)
                if beta <= alpha:
                    break
            return min_eval

    def _evaluate_board(self, game: ReversiGame, original_player: Player) -> float:
        """
        Evaluation function for Reversi.
        Calculates a score based on disc count, corners, and mobility.
        """
        if game.is_game_over:
            if game.winner == original_player:
                return float('inf') # Win
            elif game.winner == (Player.WHITE if original_player == Player.BLACK else Player.BLACK):
                return float('-inf') # Loss
            else:
                return 0 # Draw

        score = 0
        opponent_player = Player.WHITE if original_player == Player.BLACK else Player.BLACK
        
        # Disc count difference (major factor)
        player_discs = sum(row.count(original_player) for row in game.board._grid)
        opponent_discs = sum(row.count(opponent_player) for row in game.board._grid)
        score += (player_discs - opponent_discs) * 1
        
        # Corners (highly valuable)
        corners = [(0, 0), (0, game.board_size - 1), (game.board_size - 1, 0), (game.board_size - 1, game.board_size - 1)]
        for x, y in corners:
            if game.board.get_stone(x, y) == original_player:
                score += 20 # High value for owning corners
            elif game.board.get_stone(x, y) == opponent_player:
                score -= 20 # Penalty for opponent owning corners

        # Mobility (number of valid moves)
        player_mobility = len(game.board.get_valid_moves(original_player))
        opponent_mobility = len(game.board.get_valid_moves(opponent_player))
        score += (player_mobility - opponent_mobility) * 0.5 # Encourage mobility

        return score + random.uniform(-0.5, 0.5) # Add random noise
