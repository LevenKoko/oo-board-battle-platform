from typing import Tuple, List, Optional
import random
from board_battle_project.backend.models import Player
from board_battle_project.backend.game.gomoku import GomokuGame
from board_battle_project.backend.ai.reversi_ai import AIStrategy

class GomokuAIUtils:
    @staticmethod
    def evaluate_board(game: GomokuGame, player: Player) -> int:
        """
        Evaluate the board. 
        Score = (My Patterns Score) - (Opponent Patterns Score * Defense Factor)
        """
        if game.is_game_over:
            if game.winner == player:
                return 100000000
            elif game.winner:
                return -100000000
            else:
                return 0

        opponent = Player.WHITE if player == Player.BLACK else Player.BLACK
        
        board = game.board.get_grid()
        size = game.board.size

        my_score = GomokuAIUtils.evaluate_lines(board, size, player)
        op_score = GomokuAIUtils.evaluate_lines(board, size, opponent)

        # Defense factor: We should be very afraid of opponent's high scores
        # Increased to 1.5 to mitigate first-move advantage
        # Add tiny noise to break ties and add variety
        return my_score - int(op_score * 1.5) + random.randint(-5, 5)

    @staticmethod
    def evaluate_lines(board, size, player) -> int:
        score = 0
        # Convert board lines to strings for easier pattern matching
        # 1 = player, 0 = empty, 2 = opponent/block
        # Actually, we can process each line segment
        
        lines = []
        
        # Rows
        for y in range(size):
            lines.append(board[y])
            
        # Cols
        for x in range(size):
            col = [board[y][x] for y in range(size)]
            lines.append(col)
            
        # Diagonals
        # (1, 1)
        for k in range(size * 2 - 1):
            # Diagonal \
            line = []
            for y in range(size):
                x = y - (size - 1) + k
                if 0 <= x < size:
                    line.append(board[y][x])
            if len(line) >= 5: lines.append(line)
            
            # Diagonal /
            line2 = []
            for y in range(size):
                x = k - y
                if 0 <= x < size:
                    line2.append(board[y][x])
            if len(line2) >= 5: lines.append(line2)

        for line in lines:
            score += GomokuAIUtils.evaluate_single_line(line, player)
            
        return score

    @staticmethod
    def evaluate_single_line(line, player) -> int:
        # Convert line to a simple string representation for this player
        # P = Player, O = Opponent, . = Empty
        # We can map: Player->'1', Empty->'0', Opponent->'2'
        
        s = ""
        for cell in line:
            if cell == player:
                s += "1"
            elif cell is None:
                s += "0"
            else:
                s += "2"
        
        score = 0
        
        # Patterns
        # 11111 -> 5 (Win)
        if "11111" in s: return 10000000
        
        # Open 4: 011110
        if "011110" in s: score += 100000
        
        # Closed 4: 211110 or 011112 or 10111 or 11011 etc.
        # Actually simple regex or substring checks are easier
        
        # Rush 4 (single gap or blocked one side)
        # Blocked one side: 211110, 011112
        if "211110" in s: score += 2500
        if "011112" in s: score += 2500
        # Gap 4: 10111, 11011, 11101
        if "10111" in s: score += 3000
        if "11011" in s: score += 3000
        if "11101" in s: score += 3000

        # Open 3: 01110 (and ensuring no block immediately outside? 0011100 is better but 01110 is base)
        # To differentiate from Open 4, we should count high value patterns first and remove them?
        # Or just sum up. "011110" contains "01110" if we aren't careful? No, string matching 4 won't match 3 if we match exact
        
        # Simple heuristic summation (can overcount, but okay for simple AI)
        # Open 3
        if "01110" in s: 
            # Check if it's actually open 4 (e.g. 011101) -> handled by rush 4
            # If we see 01110, check adjacency.
            # But simply adding score is fine.
            score += 3000
        
        # Jump 3: 1011, 1101
        # Open Jump 3: 010110, 011010
        if "010110" in s: score += 2000
        if "011010" in s: score += 2000

        # Open 2: 0110
        if "001100" in s: score += 500
        elif "0110" in s: score += 200

        return score

    @staticmethod
    def get_neighbor_moves(game: GomokuGame, radius: int = 1) -> List[Tuple[int, int]]:
        """Returns empty spots that are within `radius` of existing stones."""
        moves = set()
        board = game.board.get_grid()
        size = game.board.size
        has_stones = False
        
        for y in range(size):
            for x in range(size):
                if board[y][x] is not None:
                    has_stones = True
                    for dy in range(-radius, radius + 1):
                        for dx in range(-radius, radius + 1):
                            if dy == 0 and dx == 0: continue
                            nx, ny = x + dx, y + dy
                            if 0 <= nx < size and 0 <= ny < size and board[ny][nx] is None:
                                moves.add((nx, ny))
        
        if not has_stones:
            return [(size // 2, size // 2)] # First move center
        
        return list(moves)

class GreedyGomokuAI(AIStrategy):
    def make_move(self, game: GomokuGame, player: Player) -> Tuple[int, int]:
        # Radius 2 to catch disjoint threats
        valid_moves = GomokuAIUtils.get_neighbor_moves(game, radius=2) 
        if not valid_moves:
            return game.board.size // 2, game.board.size // 2

        best_score = float('-inf')
        best_moves = [valid_moves[0]]

        for x, y in valid_moves:
            game.board._grid[y][x] = player
            score = GomokuAIUtils.evaluate_board(game, player)
            game.board._grid[y][x] = None

            if score > best_score:
                best_score = score
                best_moves = [(x, y)]
            elif score == best_score:
                best_moves.append((x, y))
        
        return random.choice(best_moves)

class MinimaxGomokuAI(AIStrategy):
    def __init__(self, depth: int = 2):
        self.depth = depth

    def make_move(self, game: GomokuGame, player: Player) -> Tuple[int, int]:
        valid_moves = GomokuAIUtils.get_neighbor_moves(game, radius=2) # Radius 2
        if not valid_moves:
            return game.board.size // 2, game.board.size // 2
        
        # Heuristic sort
        scored_moves = []
        for x, y in valid_moves:
             game.board._grid[y][x] = player
             score = GomokuAIUtils.evaluate_board(game, player)
             game.board._grid[y][x] = None
             scored_moves.append((score, (x, y)))
        
        scored_moves.sort(key=lambda x: x[0], reverse=True)
        
        # Dynamic beam width based on stage? Fixed for now.
        # Keep top 15 moves to ensure we consider blocking moves (which might have high defensive score)
        sorted_valid_moves = [m[1] for m in scored_moves[:15]] 
        
        best_eval = float('-inf')
        best_moves = [sorted_valid_moves[0]]
        alpha = float('-inf')
        beta = float('inf')

        for x, y in sorted_valid_moves:
            game.board._grid[y][x] = player
            
            eval = self._minimax(game, self.depth - 1, alpha, beta, False, player)
            game.board._grid[y][x] = None

            if eval > best_eval:
                best_eval = eval
                best_moves = [(x, y)]
            elif eval == best_eval:
                best_moves.append((x, y))
            
            alpha = max(alpha, eval)
            if beta <= alpha:
                break
        
        return random.choice(best_moves)

    def _minimax(self, game: GomokuGame, depth: int, alpha: float, beta: float, maximizing: bool, original_player: Player) -> float:
        current_score = GomokuAIUtils.evaluate_board(game, original_player)
        # Terminal check
        if abs(current_score) > 5000000: 
            return current_score

        if depth == 0:
            return current_score

        current_player = original_player if maximizing else (Player.WHITE if original_player == Player.BLACK else Player.BLACK)
        valid_moves = GomokuAIUtils.get_neighbor_moves(game, radius=1) # Radius 1 for deeper recursion to save time
        
        if len(valid_moves) > 10:
             temp_scores = []
             for x, y in valid_moves:
                 game.board._grid[y][x] = current_player
                 s = GomokuAIUtils.evaluate_board(game, current_player) # Evaluate for *current* player's perspective
                 game.board._grid[y][x] = None
                 temp_scores.append((s, (x, y)))
             
             # Sort descending (best moves first)
             temp_scores.sort(key=lambda x: x[0], reverse=True) 
             valid_moves = [m[1] for m in temp_scores[:10]]

        if maximizing:
            max_eval = float('-inf')
            for x, y in valid_moves:
                game.board._grid[y][x] = current_player
                eval = self._minimax(game, depth - 1, alpha, beta, False, original_player)
                game.board._grid[y][x] = None
                max_eval = max(max_eval, eval)
                alpha = max(alpha, eval)
                if beta <= alpha:
                    break
            return max_eval
        else:
            min_eval = float('inf')
            for x, y in valid_moves:
                game.board._grid[y][x] = current_player
                eval = self._minimax(game, depth - 1, alpha, beta, True, original_player)
                game.board._grid[y][x] = None
                min_eval = min(min_eval, eval)
                beta = min(beta, eval)
                if beta <= alpha:
                    break
            return min_eval