from typing import Optional, List, Set, Tuple
from board_battle_project.backend.game.base import AbstractBoard, AbstractGame
from board_battle_project.backend.models import Player, GameType, Move, BoardGrid

class GoBoard(AbstractBoard):
    def __init__(self, size: int):
        super().__init__(size)

    def place_stone(self, x: int, y: int, player: Player) -> bool:
        if not self.is_valid_coordinate(x, y) or not self.is_empty(x, y):
            return False
        self._grid[y][x] = player
        return True

    def remove_stones(self, stones: Set[Tuple[int, int]]):
        for x, y in stones:
            self._grid[y][x] = None

class GoGame(AbstractGame):
    def __init__(self, board_size: int):
        super().__init__(board_size, GameType.GO)
        self.board: GoBoard = self._create_board(board_size)
        self.history.append(BoardGrid(grid=[row[:] for row in self.board.get_grid()]))
        self._consecutive_passes = 0 # For Go game ending condition

    def _create_board(self, size: int) -> GoBoard:
        return GoBoard(size)

    def _get_connected_stones(self, x: int, y: int) -> Set[Tuple[int, int]]:
        """DFS to find all connected stones of the same color."""
        target_player = self.board.get_stone(x, y)
        if target_player is None:
            return set()

        connected = set()
        stack = [(x, y)]
        while stack:
            cx, cy = stack.pop()
            if (cx, cy) in connected:
                continue
            connected.add((cx, cy))

            for dx, dy in [(0, 1), (0, -1), (1, 0), (-1, 0)]:
                nx, ny = cx + dx, cy + dy
                if self.board.is_valid_coordinate(nx, ny) and self.board.get_stone(nx, ny) == target_player:
                    stack.append((nx, ny))
        return connected

    def _get_liberties(self, stones: Set[Tuple[int, int]]) -> Set[Tuple[int, int]]:
        """Calculate liberties for a given set of connected stones."""
        liberties = set()
        for x, y in stones:
            for dx, dy in [(0, 1), (0, -1), (1, 0), (-1, 0)]:
                nx, ny = x + dx, y + dy
                if self.board.is_valid_coordinate(nx, ny) and self.board.is_empty(nx, ny):
                    liberties.add((nx, ny))
        return liberties

    def _get_group_liberties(self, x: int, y: int) -> Set[Tuple[int, int]]:
        """Get liberties for the group of stones connected to (x, y)."""
        group = self._get_connected_stones(x, y)
        return self._get_liberties(group)

    def _capture_stones(self, opponent: Player) -> int:
        """
        Check for and capture opponent's stones that have no liberties.
        Returns the number of stones captured.
        """
        captured_count = 0
        visited = set()
        current_board_grid = self.board.get_grid() # snapshot for iteration

        for y in range(self.board.size):
            for x in range(self.board.size):
                if current_board_grid[y][x] == opponent and (x, y) not in visited:
                    group = self._get_connected_stones(x, y)
                    visited.update(group)
                    liberties = self._get_liberties(group)
                    if not liberties:
                        self.board.remove_stones(group)
                        captured_count += len(group)
        return captured_count

    def make_move(self, x: int, y: int) -> tuple[bool, str]:
        if self.is_game_over:
            return False, f"Game is already over. {self.winner.value} won."
        if not self.board.is_valid_coordinate(x, y) or not self.board.is_empty(x, y):
            return False, "Invalid move: position is out of bounds or already occupied."
        
        # Temporarily place the stone to check for captures and suicide
        original_grid = self.board.get_grid()
        self.board._grid = [row[:] for row in original_grid] # Deep copy for rollback
        self.board.place_stone(x, y, self.current_player)

        opponent_player = Player.WHITE if self.current_player == Player.BLACK else Player.BLACK
        captured_by_move = 0
        
        # Check for captures caused by this move
        captured_groups_after_move = set()
        for dx, dy in [(0, 1), (0, -1), (1, 0), (-1, 0)]:
            nx, ny = x + dx, y + dy
            if self.board.is_valid_coordinate(nx, ny) and self.board.get_stone(nx, ny) == opponent_player:
                group = self._get_connected_stones(nx, ny)
                if group not in captured_groups_after_move: # Avoid processing the same group multiple times
                    liberties = self._get_liberties(group)
                    if not liberties:
                        captured_by_move += len(group)
                        self.board.remove_stones(group)
                        captured_groups_after_move.add(frozenset(group)) # Store as frozenset to be hashable

        # After potentially capturing, check if the *current* player's stone is a suicide move
        # A suicide move is when the placed stone's group has no liberties AND no captures occurred
        current_group_liberties = self._get_group_liberties(x, y)
        if not current_group_liberties and captured_by_move == 0:
            self.board._grid = original_grid # Rollback the board
            return False, "Invalid move: Suicide move (no liberties and no captures)."

        # If move is valid, apply changes
        self.board._grid = [row[:] for row in self.board.get_grid()] # Finalize the board state

        self.prisoners[self.current_player] += captured_by_move
        self.last_move = Move(x=x, y=y, player=self.current_player)
        self.history.append(BoardGrid(grid=[row[:] for row in self.board.get_grid()])) # Save state after valid move
        self._consecutive_passes = 0 # Reset consecutive passes on a valid move

        self.check_game_over() # Check if two consecutive passes occurred

        if not self.is_game_over:
            self._switch_player()
            self.message = f"{self.current_player.value}'s turn. Captured {captured_by_move} stones."
        else:
            self.message = f"Game Over! {self.winner.value} wins!" if self.winner else "Game Over!"

        return True, self.message

    def pass_turn(self, player: Player) -> tuple[bool, str]:
        if self.is_game_over:
            return False, "Game is already over."
        if player != self.current_player:
            return False, "It's not your turn to pass."

        self.last_move = None # No physical move
        self.message = f"{player.value} passed."
        self._consecutive_passes += 1
        self.history.append(BoardGrid(grid=[row[:] for row in self.board.get_grid()])) # Save current board state for history/undo

        self.check_game_over() # Check for two consecutive passes

        if not self.is_game_over:
            self._switch_player()
        
        return True, self.message

    def check_game_over(self) -> None:
        if self._consecutive_passes >= 2:
            self.is_game_over = True
            self.message = "Both players passed consecutively. Game Over!"
            self._determine_winner_simplified()

    def _determine_winner_simplified(self) -> None:
        """Simplified winner determination for Go."""
        black_score = self.prisoners[Player.BLACK]
        white_score = self.prisoners[Player.WHITE]

        # Count territory (very simplified, just empty cells surrounded by one color)
        # This is a very basic territory count, a real Go game would be much more complex.
        # For simplicity, count empty cells that only border one player's stones.
        territory_black = 0
        territory_white = 0
        
        visited_empty = set()

        for y in range(self.board.size):
            for x in range(self.board.size):
                if self.board.is_empty(x, y) and (x, y) not in visited_empty:
                    empty_group = self._get_connected_stones_of_empty_cells(x, y)
                    visited_empty.update(empty_group)
                    
                    bordering_players = set()
                    for ex, ey in empty_group:
                        for dx, dy in [(0, 1), (0, -1), (1, 0), (-1, 0)]:
                            nx, ny = ex + dx, ey + dy
                            if self.board.is_valid_coordinate(nx, ny) and not self.board.is_empty(nx, ny):
                                bordering_players.add(self.board.get_stone(nx, ny))
                    
                    if len(bordering_players) == 1:
                        if Player.BLACK in bordering_players:
                            territory_black += len(empty_group)
                        elif Player.WHITE in bordering_players:
                            territory_white += len(empty_group)
                            
        black_score += territory_black
        white_score += territory_white

        # Komi: White gets an advantage for going second. Standard komi is 6.5 or 7.5.
        # Let's use 6.5 for now (common in Japanese rules)
        white_score += 6.5

        if black_score > white_score:
            self.winner = Player.BLACK
        elif white_score > black_score:
            self.winner = Player.WHITE
        else:
            self.winner = None # Draw, though rare in Go

        self.message += f" Final Score: Black {black_score} vs White {white_score} (including Komi)."
    
    def _get_connected_stones_of_empty_cells(self, x: int, y: int) -> Set[Tuple[int, int]]:
        """DFS to find all connected empty cells."""
        connected_empty = set()
        stack = [(x, y)]
        while stack:
            cx, cy = stack.pop()
            if (cx, cy) in connected_empty:
                continue
            connected_empty.add((cx, cy))

            for dx, dy in [(0, 1), (0, -1), (1, 0), (-1, 0)]:
                nx, ny = cx + dx, cy + dy
                if self.board.is_valid_coordinate(nx, ny) and self.board.is_empty(nx, ny):
                    stack.append((nx, ny))
        return connected_empty
