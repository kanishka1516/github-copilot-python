import time

from flask import Flask, render_template, jsonify, request

LEADERBOARD_LIMIT = 10

try:
    from starter import sudoku_logic
except ImportError:  # pragma: no cover - fallback for running app.py directly
    import sudoku_logic

app = Flask(__name__)

# Keep a simple in-memory store for current puzzle, solution, and timer state
CURRENT = {
    'puzzle': None,
    'solution': None,
    'timer_started_at': None,
    'timer_completed_at': None,
    'difficulty': 'medium',
}


def _reset_timer() -> None:
    """Start a new timer for the current game."""
    CURRENT['timer_started_at'] = time.monotonic()
    CURRENT['timer_completed_at'] = None


def _get_elapsed_seconds() -> float:
    """Return the elapsed time for the current game in seconds."""
    if CURRENT.get('timer_started_at') is None:
        return 0.0

    end_time = CURRENT.get('timer_completed_at') or time.monotonic()
    return round(end_time - CURRENT['timer_started_at'], 2)


def update_leaderboard_entries(entries, name: str, time_value: float, difficulty: str, limit: int = LEADERBOARD_LIMIT):
    """Return a leaderboard list with the newest score inserted and the fastest entries retained."""
    new_entry = {
        'name': name.strip() or 'Anonymous',
        'time': round(float(time_value), 2),
        'difficulty': (difficulty or 'medium').lower(),
    }
    updated_entries = [dict(entry) for entry in entries] + [new_entry]
    updated_entries.sort(key=lambda entry: (entry['time'], entry['name'].lower()))
    return updated_entries[:limit]


@app.route('/')
def index():
    return render_template('index.html')

@app.route('/new')
def new_game():
    requested_difficulty = (request.args.get('difficulty') or CURRENT.get('difficulty') or 'medium').lower()
    difficulty = requested_difficulty if requested_difficulty in {'easy', 'medium', 'hard'} else 'medium'
    clues = request.args.get('clues')
    if clues is None:
        puzzle, solution = sudoku_logic.generate_puzzle(difficulty=difficulty)
    else:
        puzzle, solution = sudoku_logic.generate_puzzle(clues=int(clues), difficulty=difficulty)
    CURRENT['puzzle'] = puzzle
    CURRENT['solution'] = solution
    CURRENT['difficulty'] = difficulty
    _reset_timer()
    return jsonify({'puzzle': puzzle, 'elapsed_seconds': _get_elapsed_seconds(), 'difficulty': CURRENT['difficulty']})

@app.route('/hint', methods=['POST'])
def get_hint():
    data = request.get_json(silent=True) or {}
    board = data.get('board')
    puzzle = CURRENT.get('puzzle')
    solution = CURRENT.get('solution')

    if solution is None or puzzle is None:
        return jsonify({'error': 'No game in progress'}), 400

    if board is None:
        return jsonify({'error': 'Board is required'}), 400

    hint = sudoku_logic.get_hint(board, solution)
    if hint is None:
        return jsonify({'error': 'No empty cells remain'}), 400

    row, col, value = hint
    board[row][col] = value
    return jsonify({'board': board, 'row': row, 'col': col, 'value': value})


@app.route('/check', methods=['POST'])
def check_solution():
    data = request.get_json(silent=True) or {}
    board = data.get('board')
    solution = CURRENT.get('solution')
    if solution is None:
        return jsonify({'error': 'No game in progress'}), 400

    incorrect = []
    for i in range(sudoku_logic.SIZE):
        for j in range(sudoku_logic.SIZE):
            cell_value = board[i][j]
            if cell_value == sudoku_logic.EMPTY:
                continue
            if cell_value != solution[i][j]:
                incorrect.append([i, j])

    completed = len(incorrect) == 0 and all(cell != sudoku_logic.EMPTY for row in board for cell in row)
    if completed and CURRENT.get('timer_completed_at') is None:
        CURRENT['timer_completed_at'] = time.monotonic()

    if completed:
        message = 'Congratulations! You solved it!'
    elif incorrect:
        message = 'Some cells are incorrect.'
    else:
        message = 'No incorrect entries found.'

    return jsonify({
        'incorrect': incorrect,
        'completed': completed,
        'elapsed_seconds': _get_elapsed_seconds(),
        'difficulty': CURRENT.get('difficulty', 'medium'),
        'message': message,
    })


@app.route('/leaderboard', methods=['POST'])
def save_leaderboard_entry():
    data = request.get_json(silent=True) or {}
    name = data.get('name')
    time_value = data.get('time')
    difficulty = data.get('difficulty')

    if time_value is None:
        return jsonify({'error': 'Time is required'}), 400

    if not isinstance(time_value, (int, float)):
        return jsonify({'error': 'Time must be numeric'}), 400

    # The browser stores the leaderboard in localStorage, but the route exists so the
    # app can validate the payload and keep the same contract for future expansion.
    entry = {
        'name': str(name or 'Anonymous').strip() or 'Anonymous',
        'time': round(float(time_value), 2),
        'difficulty': str(difficulty or 'medium').lower(),
    }
    return jsonify({'entry': entry})


if __name__ == '__main__':
    app.run(debug=True)