from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from typing import Dict
import os

from board_battle_project.backend.models import (
    GameConfig, GameState, StartGameResponse, MakeMoveRequest,
    MoveResult, SimpleGameResponse, Player, LoadGameRequest, PlayerRequest
)
from board_battle_project.backend.game.controller import GameController

app = FastAPI(
    title="Board Battle API",
    description="Backend API for Gomoku and Go games."
)

# Allow CORS for frontend development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Adjust in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

game_controller = GameController()

@app.post("/api/game/start", response_model=StartGameResponse)
async def start_game(config: GameConfig):
    if not (8 <= config.board_size <= 19):
        raise HTTPException(status_code=400, detail="Board size must be between 8 and 19.")
    
    try:
        game = game_controller.create_game(config.game_type, config.board_size)
        return StartGameResponse(gameId=game.game_id, state=game.get_state())
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/game/{game_id}/move", response_model=MoveResult)
async def make_move(game_id: str, move_request: MakeMoveRequest):
    result = game_controller.make_move(game_id, move_request.x, move_request.y)
    if not result.success:
        raise HTTPException(status_code=400, detail=result.error)
    return result

@app.post("/api/game/{game_id}/undo", response_model=SimpleGameResponse)
async def undo_move(game_id: str):
    game = game_controller.get_game(game_id)
    if not game:
        raise HTTPException(status_code=404, detail="Game not found.")
    
    success, message = game.undo_last_move()
    if not success:
        raise HTTPException(status_code=400, detail=message)
    return SimpleGameResponse(state=game.get_state())

@app.post("/api/game/{game_id}/pass", response_model=SimpleGameResponse)
async def pass_turn(game_id: str, request: PlayerRequest): # Updated to use request body
    game = game_controller.get_game(game_id)
    if not game:
        raise HTTPException(status_code=404, detail="Game not found.")
    
    success, message = game.pass_turn(request.player)
    if not success:
        raise HTTPException(status_code=400, detail=message)
    return SimpleGameResponse(state=game.get_state())


@app.post("/api/game/{game_id}/resign", response_model=SimpleGameResponse)
async def resign_game(game_id: str, request: PlayerRequest): # Updated to use request body
    game = game_controller.get_game(game_id)
    if not game:
        raise HTTPException(status_code=404, detail="Game not found.")
    
    game.resign(request.player)
    return SimpleGameResponse(state=game.get_state())

@app.get("/api/game/{game_id}/state", response_model=GameState)
async def get_game_state(game_id: str):
    game = game_controller.get_game(game_id)
    if not game:
        raise HTTPException(status_code=404, detail="Game not found.")
    return game.get_state()

@app.post("/api/game/load", response_model=StartGameResponse)
async def load_game(request: LoadGameRequest):
    try:
        game = game_controller.load_game(
            request.config.game_type, 
            request.config.board_size, 
            request.state
        )
        return StartGameResponse(gameId=game.game_id, state=game.get_state())
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

if os.path.exists("frontend_dist"):
    app.mount("/", StaticFiles(directory="frontend_dist", html=True), name="static")
