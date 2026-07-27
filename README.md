# Flask Sudoku Game

A simple and polished Sudoku web app built with Python and Flask. The project includes a playable Sudoku board, difficulty selection, hints, solution checking, a timer, and a responsive interface that works well on both desktop and mobile devices.

## Project Overview

This project provides a lightweight Flask-based Sudoku experience for practicing Python web development and front-end styling. Players can start a new game, solve puzzles, request hints, and check their progress while enjoying a clean UI with light and dark mode support.

## Features

- Playable 9x9 Sudoku board
- New game generation for multiple difficulty levels
- Hint support for partial puzzle assistance
- Solution checking with feedback on incorrect entries
- Timer to track elapsed solving time
- Responsive layout for desktop and mobile screens
- Light and dark theme support
- Clean, accessible styling for controls and board cells

## Setup Instructions

### Prerequisites

- Python 3.10 or newer
- A modern web browser

### Installation

1. Clone the repository.
2. Navigate to the project directory.
3. Create and activate a virtual environment:

```bash
python3 -m venv .venv
source .venv/bin/activate
```

4. Install the dependencies:

```bash
pip install -r starter/requirements.txt
```

## How to Run the Flask App

From the project root, run:

```bash
cd starter
python app.py
```

Then open your browser at:

```text
http://127.0.0.1:5000/
```

## How to Run Tests

Run the test suite with pytest:

```bash
pytest -q
```

If you are using the project virtual environment, the command is:

```bash
.venv/bin/pytest -q
```

## Technologies Used

- Python
- Flask
- HTML/CSS
- JavaScript
- pytest
