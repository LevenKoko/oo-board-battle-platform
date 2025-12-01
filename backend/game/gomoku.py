from typing import Optional, List
from board_battle_project.backend.game.base import AbstractBoard, AbstractGame
from board_battle_project.backend.models import Player, GameType, Move, BoardGrid

class GomokuBoard(AbstractBoard):
    def __init__(self, size: int):
        super().__init__(size)

    def place_stone(self, x: int, y: int, player: Player) -> bool:
        if not self.is_valid_coordinate(x, y) or not self.is_empty(x, y):
            return False
        self._grid[y][x] = player
        return True

class GomokuGame(AbstractGame):
    def __init__(self, board_size: int):
        super().__init__(board_size, GameType.GOMOKU)
        self.board: GomokuBoard = self._create_board(board_size)
        self.history.append(BoardGrid(grid=[row[:] for row in self.board.get_grid()]))

    def _create_board(self, size: int) -> GomokuBoard:
        return GomokuBoard(size)

    def make_move(self, x: int, y: int) -> tuple[bool, str]:
        if self.is_game_over:
            return False, f"Game is already over. {self.winner.value} won."

        if not self.board.place_stone(x, y, self.current_player):
            return False, "Invalid move: position is out of bounds or already occupied."

        self.last_move = Move(x=x, y=y, player=self.current_player)
        self.history.append(BoardGrid(grid=[row[:] for row in self.board.get_grid()])) # Save state after valid move

        self.check_game_over()

        if not self.is_game_over:
            self._switch_player()
            self.message = f"{self.current_player.value}'s turn."
        else:
            self.message = f"{self.winner.value} wins!" if self.winner else "It's a draw!"

        return True, self.message

    def check_game_over(self) -> None:
        if self.last_move is None:
            return

        x, y, player = self.last_move.x, self.last_move.y, self.last_move.player
        board_grid = self.board.get_grid()

        # Check for 5-in-a-row in all 8 directions
        directions = [
            (1, 0), (0, 1), (1, 1), (1, -1) # Horizontal, Vertical, Diagonal (\), Anti-diagonal (/)
        ]

        for dx, dy in directions:
            count = 1
            # Check one direction
            for i in range(1, 5):
                nx, ny = x + dx * i, y + dy * i
                if self.board.is_valid_coordinate(nx, ny) and board_grid[ny][nx] == player:
                    count += 1
                else:
                    break
            # Check opposite direction
            for i in range(1, 5):
                nx, ny = x - dx * i, y - dy * i
                if self.board.is_valid_coordinate(nx, ny) and board_grid[ny][nx] == player:
                    count += 1
                else:
                    break
            if count >= 5:
                self.is_game_over = True
                self.winner = player
                return

        # Check for draw (board full)
        if all(self.board._grid[r][c] is not None for r in range(self.board.size) for c in range(self.board.size)):
            self.is_game_over = True
            self.message = "Draw: Board is full."

    def pass_turn(self, player: Player) -> tuple[bool, str]:
        return False, "Passing turn is not allowed in Gomoku."
