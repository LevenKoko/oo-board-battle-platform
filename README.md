# OO Board Battle Platform

A turn-based strategy game platform (Go & Gomoku) built with Python (FastAPI) and React. Designed with strict Object-Oriented Programming principles.

**🔗 Resources:**
- **Deployed Demo:** [Visit Live Demo](https://go.leven.fun)
- **Demo Video:** [Watch on Tsinghua Cloud](https://cloud.tsinghua.edu.cn/f/6918544bd65347b594c1/)
- **Repository:** [GitHub](https://github.com/LevenKoko/oo-board-battle-platform)

## 🚀 How to Run

### Prerequisites
- Python 3.10+
- Node.js 16+ & npm

### 1. Start the Backend
The backend is built with FastAPI. It handles all game logic.

```bash
# Navigate to the project root
cd board_battle_project

# Create virtual env (optional but recommended)
# conda create -n oo-project python=3.10
# conda activate oo-project

# Install dependencies
pip install -r backend/requirements.txt

# Run the server (default port: 8000)
# Note: Run this from the root directory (board_battle_project/)
uvicorn backend.main:app --reload --port 8000
```

### 2. Start the Frontend
The frontend is a React app built with Vite.

```bash
# Open a new terminal
cd board_battle_project/frontend

# Install dependencies
npm install

# Start the development server
npm run dev
```

Open your browser and visit `http://localhost:3000` (or the port shown in your terminal).

## 🏗 Project Structure

- `backend/`: Core game logic (Python).
  - `game/`: Object-oriented implementation of Board, Game, Go, and Gomoku.
  - `main.py`: RESTful API endpoints.
- `frontend/`: User Interface (React/TypeScript).