from typing import Optional, List, Tuple
from board_battle_project.backend.game.base import AbstractBoard, AbstractGame
from board_battle_project.backend.models import Player, GameType, Move, BoardGrid

class ReversiBoard(AbstractBoard):
    def __init__(self, size: int = 8):
        super().__init__(size)
        if size != 8:
            raise ValueError("Reversi board size must be 8x8.")
        
        # Initial Reversi setup
        self._grid[3][3] = Player.WHITE
        self._grid[3][4] = Player.BLACK
        self._grid[4][3] = Player.BLACK
        self._grid[4][4] = Player.WHITE

    def place_stone(self, x: int, y: int, player: Player) -> bool:
        """
        Attempts to place a stone. In Reversi, placing a stone also involves flipping.
        This method will check for valid moves, perform flips, and then place the stone.
        Returns True if successful, False otherwise.
        """
        if not self.is_valid_coordinate(x, y) or not self.is_empty(x, y):
            return False

        # Check for flippable pieces
        flipped_pieces = self._get_flippable_pieces(x, y, player)
        if not flipped_pieces:
            return False # Must flip at least one piece

        # Place the stone
        self._grid[y][x] = player
        
        # Flip pieces
        for fx, fy in flipped_pieces:
            self._grid[fy][fx] = player
            
        return True

    def _get_flippable_pieces(self, x: int, y: int, player: Player) -> List[Tuple[int, int]]:
        """
        Checks all 8 directions from (x, y) to find opponent pieces that would be flipped.
        Returns a list of (x, y) coordinates of pieces to be flipped.
        """
        if not self.is_valid_coordinate(x, y) or not self.is_empty(x, y):
            return []

        opponent = Player.WHITE if player == Player.BLACK else Player.BLACK
        flippable_in_all_directions = []

        directions = [
            (-1, -1), (-1, 0), (-1, 1),
            (0, -1), (0, 1),
            (1, -1), (1, 0), (1, 1)
        ]

        for dx, dy in directions:
            current_flippable_line = []
            
            for i in range(1, self.size): # Max distance to search
                nx, ny = x + dx * i, y + dy * i

                if not self.is_valid_coordinate(nx, ny):
                    break # Out of bounds
                
                stone = self._grid[ny][nx]

                if stone == opponent:
                    current_flippable_line.append((nx, ny))
                elif stone == player:
                    # Found own piece, so all pieces in current_flippable_line are indeed flippable
                    flippable_in_all_directions.extend(current_flippable_line)
                    break
                else: # stone is None (empty)
                    break # Line is broken, no pieces to flip in this direction
        
        return flippable_in_all_directions
    
    def get_valid_moves(self, player: Player) -> List[Tuple[int, int]]:
        """
        Returns a list of all valid (x, y) coordinates where the player can make a move.
        A move is valid if it results in at least one opponent piece being flipped.
        """
        valid_moves = []
        for y in range(self.size):
            for x in range(self.size):
                if self.is_empty(x, y):
                    if self._get_flippable_pieces(x, y, player):
                        valid_moves.append((x, y))
        return valid_moves

class ReversiGame(AbstractGame):
    def __init__(self, board_size: int = 8):
        if board_size != 8:
            raise ValueError("Reversi board size must be 8x8.")
        super().__init__(board_size, GameType.REVERSI)
        self.board: ReversiBoard = self._create_board(board_size)
        self.history.append(BoardGrid(grid=[row[:] for row in self.board.get_grid()]))
        self.pass_count: int = 0 # To track consecutive passes

    def _create_board(self, size: int) -> ReversiBoard:
        return ReversiBoard(size)

    def make_move(self, x: int, y: int) -> tuple[bool, str]:
        if self.is_game_over:
            return False, f"Game is already over. {self.winner.value} won."
        
        # Check if the move is valid according to Reversi rules (must flip pieces)
        if not self.board.is_empty(x,y) or not self.board._get_flippable_pieces(x, y, self.current_player):
             return False, "Invalid move: position is out of bounds, already occupied, or does not flip any opponent pieces."

        # Make the move (places stone and flips)
        if not self.board.place_stone(x, y, self.current_player):
            return False, "Failed to place stone or flip pieces." # Should not happen if _get_flippable_pieces passed

        self.last_move = Move(x=x, y=y, player=self.current_player)
        self.history.append(BoardGrid(grid=[row[:] for row in self.board.get_grid()])) # Save state after valid move
        self.pass_count = 0 # Reset pass count on a successful move

        self.check_game_over()

        if not self.is_game_over:
            self._switch_player()
            # Check if the new current player can make any moves. If not, force a pass.
            valid_moves_for_next_player = self.board.get_valid_moves(self.current_player)
            if not valid_moves_for_next_player:
                # Forced pass for the current player
                opponent_player = Player.WHITE if self.current_player == Player.BLACK else Player.BLACK
                self.message = f"{self.current_player.value} has no valid moves and must pass. {opponent_player.value}'s turn again."
                self._switch_player() # Switch back to the previous player
                self.pass_count += 1
                if self.pass_count >= 2: # Both players passed consecutively
                    self.is_game_over = True
                    self.message = "Both players passed consecutively. Game over!"
                    self._determine_reversi_winner()
            else:
                self.message = f"{self.current_player.value}'s turn."
        else:
            if not self.winner: # Game over but no specific winner yet (e.g., board full)
                self._determine_reversi_winner()
            self.message = f"{self.winner.value} wins!" if self.winner else "It's a draw!"

        return True, self.message

    def pass_turn(self, player: Player) -> tuple[bool, str]:
        if self.is_game_over:
            return False, "Game is already over."
        if player != self.current_player:
            return False, "It's not your turn to pass."

        # Only allow explicit pass if there are no valid moves.
        # Otherwise, player must make a move.
        valid_moves = self.board.get_valid_moves(self.current_player)
        if valid_moves:
            return False, "You have valid moves, you cannot pass."
        
        self.pass_count += 1
        self._switch_player()
        if self.pass_count >= 2:
            self.is_game_over = True
            self.message = "Both players passed consecutively. Game over!"
            self._determine_reversi_winner()
            return True, self.message
        
        self.message = f"{player.value} passed. {self.current_player.value}'s turn."
        return True, self.message

    def check_game_over(self) -> None:
        """
        Check for Reversi specific game over conditions:
        1. Board is full.
        2. No valid moves for EITHER player.
        """
        if self.is_game_over: # Already game over
            return

        # Condition 1: Board is full
        if all(self.board._grid[r][c] is not None for r in range(self.board.size) for c in range(self.board.size)):
            self.is_game_over = True
            self.message = "Board is full."
            self._determine_reversi_winner()
            return
        
        # Condition 2: No valid moves for current player AND no valid moves for opponent
        # Note: Forced passes are handled in make_move, but this is a final check for termination
        current_player_has_moves = self.board.get_valid_moves(self.current_player)
        opponent_player = Player.WHITE if self.current_player == Player.BLACK else Player.BLACK
        opponent_has_moves = self.board.get_valid_moves(opponent_player)

        if not current_player_has_moves and not opponent_has_moves:
            self.is_game_over = True
            self.message = "No valid moves for either player. Game over!"
            self._determine_reversi_winner()
            return

    def _determine_reversi_winner(self) -> None:
        """Determines the winner based on disc count for Reversi."""
        black_count = sum(row.count(Player.BLACK) for row in self.board.get_grid())
        white_count = sum(row.count(Player.WHITE) for row in self.board.get_grid())

        if black_count > white_count:
            self.winner = Player.BLACK
        elif white_count > black_count:
            self.winner = Player.WHITE
        else:
            self.winner = None # Draw
        
        self.message = f"Black: {black_count}, White: {white_count}. "
        if self.winner:
            self.message += f"{self.winner.value} wins!"
        else:
            self.message += "It's a draw!"

    def get_valid_moves_for_current_player(self) -> List[Tuple[int, int]]:
        """Expose valid moves for external use (e.g., AI or frontend hints)."""
        return self.board.get_valid_moves(self.current_player)
