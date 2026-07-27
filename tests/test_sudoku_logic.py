from starter import sudoku_logic


def assert_valid_board(board):
    assert len(board) == sudoku_logic.SIZE
    for row in board:
        assert len(row) == sudoku_logic.SIZE

    for row in board:
        values = [value for value in row if value != sudoku_logic.EMPTY]
        assert len(values) == len(set(values))

    for col in range(sudoku_logic.SIZE):
        values = [board[row][col] for row in range(sudoku_logic.SIZE) if board[row][col] != sudoku_logic.EMPTY]
        assert len(values) == len(set(values))

    for box_row in range(0, sudoku_logic.SIZE, 3):
        for box_col in range(0, sudoku_logic.SIZE, 3):
            values = []
            for row in range(box_row, box_row + 3):
                for col in range(box_col, box_col + 3):
                    value = board[row][col]
                    if value != sudoku_logic.EMPTY:
                        values.append(value)
            assert len(values) == len(set(values))


def test_create_empty_board_returns_empty_grid():
    board = sudoku_logic.create_empty_board()

    assert_valid_board(board)
    assert all(cell == sudoku_logic.EMPTY for row in board for cell in row)


def test_is_safe_detects_conflicting_values():
    board = sudoku_logic.create_empty_board()
    board[0][0] = 1

    assert sudoku_logic.is_safe(board, 0, 1, 1) is False
    assert sudoku_logic.is_safe(board, 0, 1, 2) is True


def test_fill_board_solves_an_empty_board():
    board = sudoku_logic.create_empty_board()

    assert sudoku_logic.fill_board(board) is True
    assert all(cell != sudoku_logic.EMPTY for row in board for cell in row)
    assert_valid_board(board)


def test_remove_cells_reduces_the_number_of_clues():
    board = sudoku_logic.create_empty_board()
    sudoku_logic.fill_board(board)

    sudoku_logic.remove_cells(board, clues=35)

    empty_cells = sum(cell == sudoku_logic.EMPTY for row in board for cell in row)
    assert empty_cells == 81 - 35


def test_generate_puzzle_returns_a_puzzle_and_solution():
    puzzle, solution = sudoku_logic.generate_puzzle(clues=35)

    assert_valid_board(solution)
    assert len(puzzle) == sudoku_logic.SIZE
    assert len(solution) == sudoku_logic.SIZE
    assert sum(cell == sudoku_logic.EMPTY for row in puzzle for cell in row) == 81 - 35
    assert sum(cell == sudoku_logic.EMPTY for row in solution for cell in row) == 0


def test_generated_puzzle_has_a_unique_solution():
    puzzle, _ = sudoku_logic.generate_puzzle(clues=35)

    assert sudoku_logic.ensure_unique_solution(puzzle) is True
