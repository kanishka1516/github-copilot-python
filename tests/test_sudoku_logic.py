from starter import sudoku_logic
from starter import app as flask_app


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


def test_index_page_includes_theme_toggle():
    client = flask_app.app.test_client()
    response = client.get('/')

    assert response.status_code == 200
    html = response.get_data(as_text=True)
    assert 'theme-toggle' in html
    assert 'aria-label="Toggle dark mode"' in html


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


def test_check_solution_reports_incorrect_cells():
    puzzle, solution = sudoku_logic.generate_puzzle(clues=35)
    flask_app.CURRENT['solution'] = solution
    flask_app.CURRENT['puzzle'] = puzzle

    client = flask_app.app.test_client()
    response = client.post('/check', json={'board': solution})

    assert response.status_code == 200
    assert response.get_json()['incorrect'] == []


def test_check_solution_detects_completion_when_board_is_complete():
    puzzle, solution = sudoku_logic.generate_puzzle(clues=35)
    flask_app.CURRENT['solution'] = solution
    flask_app.CURRENT['puzzle'] = puzzle

    client = flask_app.app.test_client()
    response = client.post('/check', json={'board': solution})

    assert response.get_json()['completed'] is True


def test_check_solution_reports_incorrect_cells_for_wrong_entries():
    puzzle, solution = sudoku_logic.generate_puzzle(clues=35)
    flask_app.CURRENT['solution'] = solution
    flask_app.CURRENT['puzzle'] = puzzle

    wrong_board = [row[:] for row in solution]
    wrong_board[0][0] = 1 if wrong_board[0][0] != 1 else 2

    client = flask_app.app.test_client()
    response = client.post('/check', json={'board': wrong_board})

    assert response.status_code == 200
    assert response.get_json()['incorrect'] == [[0, 0]]
    assert response.get_json()['completed'] is False


def test_new_game_starts_timer(monkeypatch):
    monkeypatch.setattr(flask_app.time, 'monotonic', lambda: 10.0)

    client = flask_app.app.test_client()
    response = client.get('/new')

    assert response.status_code == 200
    assert flask_app.CURRENT['timer_started_at'] == 10.0
    assert flask_app.CURRENT['timer_completed_at'] is None


def test_new_game_tracks_selected_difficulty():
    client = flask_app.app.test_client()
    response = client.get('/new?difficulty=hard')

    assert response.status_code == 200
    assert flask_app.CURRENT['difficulty'] == 'hard'


def test_check_solution_includes_difficulty_in_response():
    puzzle, solution = sudoku_logic.generate_puzzle(clues=35)
    flask_app.CURRENT['solution'] = solution
    flask_app.CURRENT['puzzle'] = puzzle
    flask_app.CURRENT['difficulty'] = 'hard'

    client = flask_app.app.test_client()
    response = client.post('/check', json={'board': solution})

    assert response.status_code == 200
    assert response.get_json()['difficulty'] == 'hard'


def test_check_solution_stops_timer_and_reports_elapsed_time(monkeypatch):
    monkeypatch.setattr(flask_app.time, 'monotonic', lambda: 100.0)
    client = flask_app.app.test_client()
    client.get('/new')

    solution = flask_app.CURRENT['solution']

    monkeypatch.setattr(flask_app.time, 'monotonic', lambda: 105.0)
    response = client.post('/check', json={'board': solution})

    assert response.status_code == 200
    assert response.get_json()['completed'] is True
    assert response.get_json()['elapsed_seconds'] == 5.0
    assert flask_app.CURRENT['timer_completed_at'] == 105.0


def test_update_leaderboard_keeps_fastest_ten_scores():
    existing_entries = [
        {'name': f'Player{i}', 'time': 20 + i, 'difficulty': 'easy'}
        for i in range(9)
    ]

    updated = flask_app.update_leaderboard_entries(existing_entries, 'New Player', 15, 'hard', limit=10)

    assert len(updated) == 10
    assert updated[0]['name'] == 'New Player'
    assert updated[0]['time'] == 15
    assert updated[0]['difficulty'] == 'hard'
    assert updated[-1]['name'] == 'Player8'


def test_get_hint_returns_first_empty_cell():
    solution = sudoku_logic.create_empty_board()
    assert sudoku_logic.fill_board(solution) is True
    board = [row[:] for row in solution]
    board[0][0] = sudoku_logic.EMPTY

    hint = sudoku_logic.get_hint(board, solution)

    assert hint == (0, 0, solution[0][0])


def test_hint_route_returns_hint_for_game_in_progress():
    puzzle, solution = sudoku_logic.generate_puzzle(clues=35)
    flask_app.CURRENT['solution'] = solution
    flask_app.CURRENT['puzzle'] = puzzle

    client = flask_app.app.test_client()
    response = client.post('/hint', json={'board': [row[:] for row in puzzle]})

    assert response.status_code == 200
    data = response.get_json()
    assert data['value'] == solution[data['row']][data['col']]
    assert puzzle[data['row']][data['col']] == sudoku_logic.EMPTY


def test_hint_route_requires_game_in_progress():
    flask_app.CURRENT['solution'] = None
    flask_app.CURRENT['puzzle'] = None

    client = flask_app.app.test_client()
    response = client.post('/hint', json={'board': sudoku_logic.create_empty_board()})

    assert response.status_code == 400
    assert response.get_json()['error'] == 'No game in progress'


def test_generate_puzzle_for_easy_difficulty():
    puzzle, solution = sudoku_logic.generate_puzzle(difficulty="easy")

    assert sudoku_logic.ensure_unique_solution(puzzle) is True
    assert sum(cell == sudoku_logic.EMPTY for row in puzzle for cell in row) == 81 - 40
    assert len(solution) == sudoku_logic.SIZE


def test_generate_puzzle_for_medium_difficulty():
    puzzle, solution = sudoku_logic.generate_puzzle(difficulty="medium")

    assert sudoku_logic.ensure_unique_solution(puzzle) is True
    assert sum(cell == sudoku_logic.EMPTY for row in puzzle for cell in row) == 81 - 35
    assert len(solution) == sudoku_logic.SIZE


def test_generate_puzzle_for_hard_difficulty():
    puzzle, solution = sudoku_logic.generate_puzzle(difficulty="hard")

    assert sudoku_logic.ensure_unique_solution(puzzle) is True
    assert sum(cell == sudoku_logic.EMPTY for row in puzzle for cell in row) == 81 - 30
    assert len(solution) == sudoku_logic.SIZE
