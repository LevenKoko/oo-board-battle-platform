from datetime import timedelta
import os
from sqlalchemy.orm import Session
from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm

from board_battle_project.backend.models import (
    GameConfig, GameState, StartGameResponse, MakeMoveRequest,
    MoveResult, SimpleGameResponse, LoadGameRequest, PlayerRequest,
    UserCreate, Token, MatchInfo, MatchListResponse
)
from board_battle_project.backend.game.controller import GameController
from board_battle_project.backend.database import Base, engine, get_db
from board_battle_project.backend.db_models import User as DBUser, Match
from board_battle_project.backend.auth import (
    create_access_token, get_password_hash, verify_password,
    get_current_active_user, ACCESS_TOKEN_EXPIRE_MINUTES
)

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

# Create database tables
Base.metadata.create_all(bind=engine)

@app.post("/api/game/start", response_model=StartGameResponse)
async def start_game(
    config: GameConfig, 
    current_user: DBUser = Depends(get_current_active_user)
):
    if not (8 <= config.board_size <= 19):
        raise HTTPException(status_code=400, detail="Board size must be between 8 and 19.")
    
    black_user_id = current_user.id if not config.player_black_is_ai else None
    white_user_id = current_user.id if not config.player_white_is_ai else None

    # If both players are AI, but a human is logged in, and tries to create AI vs AI game,
    # the human player who started the game can be recorded as one of the players (arbitrarily black)
    # or both can be None. For now, if both are AI, both player IDs are None.
    # If one is AI and the other is human, the human player is logged.
    if config.player_black_is_ai and config.player_white_is_ai:
        # Assign current user to black_user_id so the game appears in their history
        black_user_id = current_user.id
        white_user_id = None 
    elif config.player_black_is_ai: # white is human
        black_user_id = None
        white_user_id = current_user.id
    elif config.player_white_is_ai: # black is human
        black_user_id = current_user.id
        white_user_id = None
    else: # both human, current_user starts as black. Other player is unknown for now, can be added later
        black_user_id = current_user.id
        white_user_id = None # Placeholder for 2-player human games, will be set when 2nd player joins
    
    try:
        game = game_controller.create_game(config, black_user_id, white_user_id)
        return StartGameResponse(gameId=game.game_id, state=game.get_state())
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/game/{game_id}/move", response_model=MoveResult)
async def make_move(game_id: str, move_request: MakeMoveRequest, db: Session = Depends(get_db)):
    result = game_controller.make_move(game_id, move_request.x, move_request.y)
    if not result.success:
        raise HTTPException(status_code=400, detail=result.error)
    
    game = game_controller.get_game(game_id)
    if game and game.is_game_over:
        game_controller.save_game_result(game_id, db)

    return result

@app.post("/api/game/{game_id}/trigger_ai", response_model=MoveResult)
async def trigger_ai_move(game_id: str, db: Session = Depends(get_db)):
    result = game_controller.trigger_ai_move(game_id)
    if not result.success:
        # It might be expected if frontend polls but it's not AI turn, so maybe not 400?
        # But for now, let's return 400 if it fails (e.g. wrong turn)
        raise HTTPException(status_code=400, detail=result.error)
    
    game = game_controller.get_game(game_id)
    if game and game.is_game_over:
        game_controller.save_game_result(game_id, db)
        
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
async def pass_turn(game_id: str, request: PlayerRequest, db: Session = Depends(get_db)):
    game = game_controller.get_game(game_id)
    if not game:
        raise HTTPException(status_code=404, detail="Game not found.")
    
    success, message = game.pass_turn(request.player)
    if not success:
        raise HTTPException(status_code=400, detail=message)
    
    if game.is_game_over:
        game_controller.save_game_result(game_id, db)
    
    return SimpleGameResponse(state=game.get_state())


@app.post("/api/game/{game_id}/resign", response_model=SimpleGameResponse)
async def resign_game(game_id: str, request: PlayerRequest, db: Session = Depends(get_db)):
    game = game_controller.get_game(game_id)
    if not game:
        raise HTTPException(status_code=404, detail="Game not found.")
    
    game.resign(request.player)
    
    if game.is_game_over:
        game_controller.save_game_result(game_id, db)

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
            request.config, # Pass config directly
            request.state
        )
        return StartGameResponse(gameId=game.game_id, state=game.get_state())
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

if os.path.exists("frontend_dist"):
    app.mount("/", StaticFiles(directory="frontend_dist", html=True), name="static")


# --- Auth Routes ---
@app.post("/api/auth/register", response_model=UserCreate)
async def register_user(user: UserCreate, db: Session = Depends(get_db)):
    db_user = db.query(DBUser).filter(DBUser.username == user.username).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Username already registered")
    
    hashed_password = get_password_hash(user.password)
    db_user = DBUser(username=user.username, hashed_password=hashed_password)
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return user

@app.post("/api/auth/login", response_model=Token)
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(DBUser).filter(DBUser.username == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/api/users/me", response_model=UserCreate) # Using UserCreate as a simplified response model for now
async def read_users_me(current_user: DBUser = Depends(get_current_active_user)):
    return UserCreate(username=current_user.username, password="[PROTECTED]") # Don't expose password hash


# --- Replay Routes ---
@app.get("/api/replays/me", response_model=MatchListResponse)
async def get_my_replays(current_user: DBUser = Depends(get_current_active_user), db: Session = Depends(get_db)):
    matches = db.query(Match).filter(
        (Match.player_black_id == current_user.id) | (Match.player_white_id == current_user.id)
    ).order_by(Match.start_time.desc()).all()

    replay_list = []
    for match in matches:
        # Check metadata for AI status
        black_is_ai = False
        white_is_ai = False
        black_ai_level = ""
        white_ai_level = ""
        
        if isinstance(match.moves_json, dict) and "meta" in match.moves_json:
            meta = match.moves_json["meta"]
            black_is_ai = meta.get("black_is_ai", False)
            white_is_ai = meta.get("white_is_ai", False)
            black_ai_level = meta.get("black_ai_level", "")
            white_ai_level = meta.get("white_ai_level", "")

        player_black_name = f"AI ({black_ai_level})" if black_is_ai and black_ai_level else "AI"
        if not black_is_ai and match.player_black_id:
            player_black_user = db.query(DBUser).filter(DBUser.id == match.player_black_id).first()
            if player_black_user:
                player_black_name = player_black_user.username
        
        player_white_name = f"AI ({white_ai_level})" if white_is_ai and white_ai_level else "AI"
        if not white_is_ai and match.player_white_id:
            player_white_user = db.query(DBUser).filter(DBUser.id == match.player_white_id).first()
            if player_white_user:
                player_white_name = player_white_user.username

        replay_list.append(MatchInfo(
            id=match.id,
            gameType=match.game_type,
            playerBlackName=player_black_name,
            playerWhiteName=player_white_name,
            result=match.result,
            startTime=match.start_time.isoformat() if match.start_time else None,
            endTime=match.end_time.isoformat() if match.end_time else None,
            movesJson=[] # Don't send all moves in list view to save bandwidth
        ))
    return MatchListResponse(matches=replay_list)

@app.get("/api/replays/{match_id}", response_model=MatchInfo)
async def get_replay_by_id(match_id: int, current_user: DBUser = Depends(get_current_active_user), db: Session = Depends(get_db)):
    match = db.query(Match).filter(Match.id == match_id).first()

    if not match:
        raise HTTPException(status_code=404, detail="Replay not found.")
    
    # Ensure user is authorized to view this replay (either participated or admin/public game)
    # For now, allowing only participants to view their own replays
    if not (match.player_black_id == current_user.id or match.player_white_id == current_user.id):
        raise HTTPException(status_code=403, detail="Not authorized to view this replay.")
    
    # Check metadata for AI status
    black_is_ai = False
    white_is_ai = False
    black_ai_level = ""
    white_ai_level = ""
    
    if isinstance(match.moves_json, dict) and "meta" in match.moves_json:
        meta = match.moves_json["meta"]
        black_is_ai = meta.get("black_is_ai", False)
        white_is_ai = meta.get("white_is_ai", False)
        black_ai_level = meta.get("black_ai_level", "")
        white_ai_level = meta.get("white_ai_level", "")

    player_black_name = f"AI ({black_ai_level})" if black_is_ai and black_ai_level else "AI"
    if not black_is_ai and match.player_black_id:
        player_black_user = db.query(DBUser).filter(DBUser.id == match.player_black_id).first()
        if player_black_user:
            player_black_name = player_black_user.username
    
    player_white_name = f"AI ({white_ai_level})" if white_is_ai and white_ai_level else "AI"
    if not white_is_ai and match.player_white_id:
        player_white_user = db.query(DBUser).filter(DBUser.id == match.player_white_id).first()
        if player_white_user:
            player_white_name = player_white_user.username

    return MatchInfo(
        id=match.id,
        gameType=match.game_type,
        playerBlackName=player_black_name,
        playerWhiteName=player_white_name,
        result=match.result,
        startTime=match.start_time.isoformat() if match.start_time else None,
        endTime=match.end_time.isoformat() if match.end_time else None,
        movesJson=match.moves_json # Send all moves for specific replay view
    )

