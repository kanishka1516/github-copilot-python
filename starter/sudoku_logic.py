import copy
import random

SIZE = 9
EMPTY = 0
Board = list[list[int]]


def deep_copy(board: Board) -> Board:
    """Return a deep copy of the given Sudoku board."""
    return copy.deepcopy(board)


def create_empty_board() -> Board:
    """Create a new 9x9 Sudoku board filled with empty cells."""
    return [[EMPTY for _ in range(SIZE)] for _ in range(SIZE)]


def is_safe(board: Board, row: int, col: int, num: int) -> bool:
    """Return True when placing num at the given position is valid."""
    for index in range(SIZE):
        if board[row][index] == num or board[index][col] == num:
            return False

    start_row = row - row % 3
    start_col = col - col % 3
    for box_row in range(start_row, start_row + 3):
        for box_col in range(start_col, start_col + 3):
            if board[box_row][box_col] == num:
                return False

    return True


def fill_board(board: Board) -> bool:
    """Recursively fill the board with a valid solved Sudoku grid."""
    for row in range(SIZE):
        for col in range(SIZE):
            if board[row][col] != EMPTY:
                continue

            possible_numbers = list(range(1, SIZE + 1))
            random.shuffle(possible_numbers)
            for candidate in possible_numbers:
                if is_safe(board, row, col, candidate):
                    board[row][col] = candidate
                    if fill_board(board):
                        return True
                    board[row][col] = EMPTY

            return False

    return True


def remove_cells(board: Board, clues: int) -> None:
    """Remove values from the board until the number of clues is reached."""
    attempts = SIZE * SIZE - clues
    while attempts > 0:
        row = random.randrange(SIZE)
        col = random.randrange(SIZE)
        if board[row][col] != EMPTY:
            board[row][col] = EMPTY
            attempts -= 1


def count_solutions(board: Board) -> int:
    """Count the number of valid solutions for a Sudoku board."""
    board_copy = deep_copy(board)
    return _count_solutions(board_copy)


def _count_solutions(board: Board, solution_count: int = 0) -> int:
    """Recursively count solutions up to a limit of 2."""
    for row in range(SIZE):
        for col in range(SIZE):
            if board[row][col] != EMPTY:
                continue

            for candidate in range(1, SIZE + 1):
                if is_safe(board, row, col, candidate):
                    board[row][col] = candidate
                    solution_count = _count_solutions(board, solution_count)
                    board[row][col] = EMPTY
                    if solution_count >= 2:
                        return solution_count
            return solution_count

    return solution_count + 1


def ensure_unique_solution(board: Board) -> bool:
    """Return True when the provided puzzle has exactly one solution."""
    return count_solutions(board) == 1


def generate_puzzle(clues: int = 35) -> tuple[Board, Board]:
    """Generate a Sudoku puzzle and its solved solution."""
    while True:
        board = create_empty_board()
        fill_board(board)
        solution = deep_copy(board)
        remove_cells(board, clues)
        if ensure_unique_solution(board):
            return deep_copy(board), solution
