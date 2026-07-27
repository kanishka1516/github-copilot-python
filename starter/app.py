from flask import Flask, render_template, jsonify, request

try:
    from starter import sudoku_logic
except ImportError:  # pragma: no cover - fallback for running app.py directly
    import sudoku_logic

app = Flask(__name__)

# Keep a simple in-memory store for current puzzle and solution
CURRENT = {
    'puzzle': None,
    'solution': None
}

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/new')
def new_game():
    difficulty = request.args.get('difficulty', 'medium')
    clues = request.args.get('clues')
    if clues is None:
        puzzle, solution = sudoku_logic.generate_puzzle(difficulty=difficulty)
    else:
        puzzle, solution = sudoku_logic.generate_puzzle(clues=int(clues), difficulty=difficulty)
    CURRENT['puzzle'] = puzzle
    CURRENT['solution'] = solution
    return jsonify({'puzzle': puzzle})

@app.route('/check', methods=['POST'])
def check_solution():
    data = request.json
    board = data.get('board')
    solution = CURRENT.get('solution')
    if solution is None:
        return jsonify({'error': 'No game in progress'}), 400

    incorrect = []
    for i in range(sudoku_logic.SIZE):
        for j in range(sudoku_logic.SIZE):
            if board[i][j] != solution[i][j]:
                incorrect.append([i, j])

    completed = len(incorrect) == 0 and all(cell != sudoku_logic.EMPTY for row in board for cell in row)
    return jsonify({'incorrect': incorrect, 'completed': completed})

if __name__ == '__main__':
    app.run(debug=True)