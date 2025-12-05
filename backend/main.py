from datetime import timedelta
import os
from sqlalchemy.orm import Session
from fastapi import Depends, FastAPI, HTTPException, status, WebSocket, WebSocketDisconnect, Query
from board_battle_project.backend.auth import (
    create_access_token, get_password_hash, verify_password,
    get_current_active_user, ACCESS_TOKEN_EXPIRE_MINUTES, SECRET_KEY, ALGORITHM # Import SECRET_KEY, ALGORITHM
)
from board_battle_project.backend.connection_manager import ConnectionManager
from jose import JWTError, jwt
import json # Added json import

# ... (imports)

from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.exceptions import RequestValidationError # Added import
from fastapi.responses import JSONResponse # Added import

from board_battle_project.backend.models import (
    GameConfig, GameState, StartGameResponse, MakeMoveRequest,
    MoveResult, SimpleGameResponse, LoadGameRequest, PlayerRequest, Player, # Added Player
    UserCreate, UserResponse, Token, TokenData, MatchInfo, MatchListResponse # Added TokenData
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

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request, exc):
    print(f"Validation Error: {exc.errors()}")
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": exc.errors()},
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
connection_manager = ConnectionManager()

# Create database tables
Base.metadata.create_all(bind=engine)

async def get_user_from_token(token: str, db: Session):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
        token_data = TokenData(username=username)
    except JWTError:
        raise credentials_exception
    user = db.query(DBUser).filter(DBUser.username == token_data.username).first()
    if user is None:
        raise credentials_exception
    return user

@app.websocket("/ws/game/{room_id}")
async def websocket_endpoint(websocket: WebSocket, room_id: str, token: str = Query(...), db: Session = Depends(get_db)):
    print(f"WS: Attempting connection to room {room_id}")
    try:
        user = await get_user_from_token(token, db)
        print(f"WS: User {user.username} (ID: {user.id}) authenticated for room {room_id}")
    except Exception as e:
        print(f"WS: Auth failed: {e}")
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    await connection_manager.connect(websocket, room_id)
    
    # Room Lobby Logic
    match = db.query(Match).filter(Match.id == room_id).first()
    config = None
    if match and match.moves_json and "meta" in match.moves_json:
        config_dict = match.moves_json["meta"].get("config")
        if config_dict:
            config = GameConfig(**config_dict)

    # Initialize/Get Session
    session = game_controller.get_or_create_session(
        match_id=room_id, 
        config=config,
        black_id=match.player_black_id if match else None,
        white_id=match.player_white_id if match else None
    )
    game_controller.update_session_players(room_id, user.id)
    
    # Restore match status if it was abandoned (e.g. due to temporary disconnect)
    if match and match.status == MatchStatus.ABANDONED:
        print(f"WS: Restoring room {room_id} status from ABANDONED to WAITING")
        match.status = MatchStatus.WAITING
        db.commit()
    
    # Broadcast initial room state
    await connection_manager.broadcast(room_id, {
        "type": "ROOM_UPDATE",
        "session": json.loads(session.model_dump_json())
    })

    try:
        # Send initial state if game exists (reconnect)
        game = game_controller.get_game(room_id)
        if game:
             await websocket.send_json({
                 "type": "GAME_STATE",
                 "state": json.loads(game.get_state().model_dump_json(by_alias=True))
             })

        while True:
            data = await websocket.receive_json()
            print(f"WS: Received data from {user.username}: {data}")
            
            action = data.get("action")
            
            if action == "REQUEST_SWITCH":
                session = game_controller.request_switch_sides(room_id, user.id)
                await connection_manager.broadcast(room_id, {
                    "type": "ROOM_UPDATE",
                    "session": json.loads(session.model_dump_json())
                })
            
            elif action == "APPROVE_SWITCH":
                session = game_controller.approve_switch_sides(room_id, user.id)
                await connection_manager.broadcast(room_id, {
                    "type": "ROOM_UPDATE",
                    "session": json.loads(session.model_dump_json())
                })

            elif action == "REJECT_SWITCH":
                session = game_controller.reject_switch_sides(room_id, user.id)
                await connection_manager.broadcast(room_id, {
                    "type": "ROOM_UPDATE",
                    "session": json.loads(session.model_dump_json())
                })
            
            elif action == "TOGGLE_READY":
                session = game_controller.toggle_ready(room_id, user.id)
                await connection_manager.broadcast(room_id, {
                    "type": "ROOM_UPDATE",
                    "session": json.loads(session.model_dump_json())
                })
                
                # Check if both ready -> Start Game
                if session.black_ready and session.white_ready and session.black_player_id and session.white_player_id:
                    print(f"WS: Both players ready in room {room_id}. Starting game...")
                    # Create/Reset Game
                    game_controller.create_game(
                        config=session.config, 
                        black_user_id=session.black_player_id, 
                        white_user_id=session.white_player_id, 
                        game_id_override=room_id
                    )
                    game = game_controller.get_game(room_id)
                    
                    # Broadcast Start
                    await connection_manager.broadcast(room_id, {
                        "type": "GAME_START",
                        "state": json.loads(game.get_state().model_dump_json(by_alias=True))
                    })
                    
                    # Update Match status in DB (optional, but good for consistency)
                    # Note: we are in async loop, DB session usage might be tricky if not scoped correctly
                    # db is from Depends, should be usable.
                    match = db.query(Match).filter(Match.id == room_id).first()
                    if match:
                        match.status = MatchStatus.PLAYING
                        match.player_black_id = session.black_player_id
                        match.player_white_id = session.white_player_id
                        db.commit()

            elif action == "REMATCH":
                # Reset ready status
                session.black_ready = False
                session.white_ready = False
                # Optionally remove the old game instance
                game_controller.remove_game(room_id)
                
                await connection_manager.broadcast(room_id, {
                    "type": "ROOM_UPDATE",
                    "session": json.loads(session.model_dump_json())
                })

            elif action == "LEAVE":
                print(f"WS: User {user.username} leaving room {room_id} explicitly.")
                session, game, cleaned_up = game_controller.handle_player_disconnect(room_id, user.id)
                
                if session:
                    await connection_manager.broadcast(room_id, {
                        "type": "ROOM_UPDATE",
                        "session": json.loads(session.model_dump_json())
                    })
                
                if cleaned_up:
                    print(f"WS: Room {room_id} is empty after LEAVE, setting match status to ABANDONED.")
                    try:
                        match = db.query(Match).filter(Match.id == int(room_id)).first()
                        if match:
                            match.status = MatchStatus.ABANDONED
                            db.commit()
                    except Exception as e:
                        print(f"WS: DB Error during LEAVE cleanup: {e}")
                        db.rollback()
                
                break # Close connection

            elif action == "RESIGN":
                game = game_controller.get_game(room_id)
                if not game:
                    await websocket.send_json({"type": "ERROR", "message": "Game not found."})
                    continue
                
                # Determine which player is resigning
                black_id, white_id = game_controller._game_player_map.get(room_id, (None, None))
                resigning_player = None
                if user.id == black_id:
                    resigning_player = Player.BLACK
                elif user.id == white_id:
                    resigning_player = Player.WHITE
                
                if resigning_player:
                    game_controller.resign_game(room_id, resigning_player)
                    await connection_manager.broadcast(room_id, {
                        "type": "GAME_STATE",
                        "state": json.loads(game.get_state().model_dump_json(by_alias=True))
                    })
                    game_controller.save_game_result(room_id, db)
                else:
                    await websocket.send_json({"type": "ERROR", "message": "You are not a player in this game."})

            elif action == "UNDO":
                result = game_controller.request_undo(room_id, user.id)
                if result.success:
                    await connection_manager.broadcast(room_id, {
                        "type": "GAME_STATE",
                        "state": json.loads(result.state.model_dump_json(by_alias=True))
                    })
                else:
                    await websocket.send_json({"type": "ERROR", "message": result.error})

            elif action == "PASS":
                game = game_controller.get_game(room_id)
                if game:
                    black_id, white_id = game_controller._game_player_map.get(room_id, (None, None))
                    is_black = user.id == black_id
                    is_white = user.id == white_id
                    
                    if (game.current_player == Player.BLACK and not is_black) or \
                       (game.current_player == Player.WHITE and not is_white):
                           await websocket.send_json({"type": "ERROR", "message": "Not your turn to pass."})
                           continue

                    result = game_controller.pass_turn(room_id, game.current_player)
                    if result.success:
                        await connection_manager.broadcast(room_id, {
                            "type": "GAME_STATE",
                            "state": json.loads(result.state.model_dump_json(by_alias=True))
                        })
                        if result.state.is_game_over:
                             game_controller.save_game_result(room_id, db)
                    else:
                        await websocket.send_json({"type": "ERROR", "message": result.error})

            elif action == "MOVE":
                x = data.get("x")
                y = data.get("y")
                
                game = game_controller.get_game(room_id)
                if game:
                    # Strict turn check against session/controller map
                    black_id, white_id = game_controller._game_player_map.get(room_id, (None, None))
                    is_black = user.id == black_id
                    is_white = user.id == white_id
                    
                    print(f"WS: Turn check - Current: {game.current_player}, User is Black? {is_black}, User is White? {is_white}")

                    if (game.current_player == Player.BLACK and not is_black) or \
                       (game.current_player == Player.WHITE and not is_white):
                           print("WS: Not user's turn")
                           await websocket.send_json({"type": "ERROR", "message": "Not your turn"})
                           continue

                    result = game_controller.make_move(room_id, x, y)
                    if result.success:
                        print(f"WS: Move success. Broadcasting to room {room_id}")
                        # Broadcast new state
                        await connection_manager.broadcast(room_id, {
                            "type": "GAME_STATE",
                            "state": json.loads(result.state.model_dump_json(by_alias=True))
                        })
                        # Check game over and save
                        if result.state.is_game_over:
                             game_controller.save_game_result(room_id, db)
                    else:
                        print(f"WS: Move failed: {result.error}")
                        await websocket.send_json({"type": "ERROR", "message": result.error})

    except WebSocketDisconnect:
        print(f"WS: User {user.username} disconnected from room {room_id}")
        connection_manager.disconnect(websocket, room_id)
        
        # Handle disconnect logic (clear slot, auto-resign)
        session, game, cleaned_up = game_controller.handle_player_disconnect(room_id, user.id)
        
        if session: # Only broadcast if session still exists (room not empty)
            await connection_manager.broadcast(room_id, {
                "type": "ROOM_UPDATE",
                "session": json.loads(session.model_dump_json())
            })
        
        if game and game.is_game_over:
             await connection_manager.broadcast(room_id, {
                "type": "GAME_STATE",
                "state": json.loads(game.get_state().model_dump_json(by_alias=True))
             })
             game_controller.save_game_result(room_id, db)

        if cleaned_up:
            print(f"WS: Room {room_id} cleanup triggered. Updating DB...")
            # Create a new transaction scope if needed, or use existing db
            try:
                match = db.query(Match).filter(Match.id == int(room_id)).first()
                if match:
                    print(f"WS: Room {room_id} found in DB. Current status: {match.status}. Setting to ABANDONED.")
                    match.status = MatchStatus.ABANDONED
                    db.add(match) # Ensure it's in session
                    db.commit()
                    print(f"WS: Room {room_id} status updated to ABANDONED.")
                else:
                    print(f"WS: Room {room_id} not found in DB during cleanup.")
            except Exception as e:
                print(f"WS: DB Error during cleanup: {e}")
                db.rollback()

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

from fastapi.responses import FileResponse # Added import

# ...

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

@app.get("/api/users/me", response_model=UserResponse) # Use UserResponse
async def read_users_me(current_user: DBUser = Depends(get_current_active_user)):
    return current_user # Return DB object directly


from board_battle_project.backend.models import MatchStatus # Import MatchStatus

# ... (Existing imports and code)

# --- Room Management Routes ---

@app.get("/api/rooms", response_model=MatchListResponse)
async def get_rooms(db: Session = Depends(get_db)):
    matches = db.query(Match).filter(Match.status == MatchStatus.WAITING).order_by(Match.start_time.desc()).all()
    
    room_list = []
    for match in matches:
        player_black_name = "Unknown"
        if match.player_black_id:
            user = db.query(DBUser).filter(DBUser.id == match.player_black_id).first()
            if user: player_black_name = user.username
            
        room_list.append(MatchInfo(
            id=match.id,
            gameType=match.game_type,
            playerBlackName=player_black_name,
            playerWhiteName="Waiting...",
            result=None,
            startTime=match.start_time.isoformat() if match.start_time else "",
            endTime=None,
            movesJson=[]
        ))
    return MatchListResponse(matches=room_list)

@app.post("/api/rooms/create", response_model=MatchInfo)
async def create_room(config: GameConfig, current_user: DBUser = Depends(get_current_active_user), db: Session = Depends(get_db)):
    # Create a match record in WAITING state
    # Store config in meta for later retrieval
    meta_data = {
        "config": config.model_dump(by_alias=True),
        "black_player_name": current_user.username
    }
    
    new_match = Match(
        player_black_id=current_user.id,
        player_white_id=None, # Waiting for opponent
        game_type=config.game_type.value,
        status=MatchStatus.WAITING,
        moves_json={"meta": meta_data, "history": []}, 
    )
    db.add(new_match)
    db.commit()
    db.refresh(new_match)
    
    return MatchInfo(
        id=new_match.id,
        gameType=new_match.game_type,
        playerBlackName=current_user.username,
        playerWhiteName="Waiting...",
        result=None,
        startTime=new_match.start_time.isoformat() if new_match.start_time else "",
        endTime=None,
        movesJson=new_match.moves_json
    )

@app.post("/api/rooms/{match_id}/join", response_model=MatchInfo)
async def join_room(match_id: int, current_user: DBUser = Depends(get_current_active_user), db: Session = Depends(get_db)):
    match = db.query(Match).filter(Match.id == match_id, Match.status == MatchStatus.WAITING).first()
    if not match:
        raise HTTPException(status_code=404, detail="Room not found or already full.")
    
    if match.player_black_id == current_user.id:
        raise HTTPException(status_code=400, detail="You cannot join your own room.")

    # Update match to have a white player, but KEEP status as WAITING until both ready
    match.player_white_id = current_user.id
    # match.status = MatchStatus.PLAYING # Don't start yet
    
    # Update white player name in meta if possible
    if isinstance(match.moves_json, dict) and "meta" in match.moves_json:
        new_json = dict(match.moves_json)
        new_json["meta"]["white_player_name"] = current_user.username
        match.moves_json = new_json

    db.commit()
    db.refresh(match)
    
    # Do NOT Initialize Game in Memory here. Wait for WS Ready.

    # Get player names
    player_black = db.query(DBUser).filter(DBUser.id == match.player_black_id).first()
    player_black_name = player_black.username if player_black else "Unknown"
    
    return MatchInfo(
        id=match.id,
        gameType=match.game_type,
        playerBlackName=player_black_name,
        playerWhiteName=current_user.username,
        result=None,
        startTime=match.start_time.isoformat() if match.start_time else "",
        endTime=None,
        movesJson=match.moves_json or {}
    )

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

@app.delete("/api/replays/{match_id}")
async def delete_replay(match_id: int, current_user: DBUser = Depends(get_current_active_user), db: Session = Depends(get_db)):
    match = db.query(Match).filter(Match.id == match_id).first()
    if not match:
        raise HTTPException(status_code=404, detail="Replay not found.")
    
    if not (match.player_black_id == current_user.id or match.player_white_id == current_user.id):
        raise HTTPException(status_code=403, detail="Not authorized to delete this replay.")
    
    db.delete(match)
    db.commit()
    return {"message": "Replay deleted successfully"}

from board_battle_project.backend.models import SaveGameRequest

@app.post("/api/replays/save", response_model=MatchInfo)
async def save_replay(request: SaveGameRequest, current_user: DBUser = Depends(get_current_active_user), db: Session = Depends(get_db)):
    # Determine result
    result_str = None
    if request.state.is_game_over:
        if request.state.winner == Player.BLACK:
            result_str = "BLACK_WON"
        elif request.state.winner == Player.WHITE:
            result_str = "WHITE_WON"
        else:
            result_str = "DRAW"
            
    # Prepare moves_json
    moves_history = []
    for board_grid in request.state.history:
        # Pydantic model to dict
        if hasattr(board_grid, 'model_dump'):
            moves_history.append(board_grid.model_dump(by_alias=True))
        else:
            moves_history.append(board_grid) # already dict?

    moves_data = {
        "meta": {
            "config": request.config.model_dump(by_alias=True),
            **request.meta
        },
        "history": moves_history
    }

    new_match = Match(
        player_black_id=current_user.id, # Associate with saver
        player_white_id=None, # Practice save usually
        game_type=request.config.game_type.value,
        status=MatchStatus.SAVED,
        result=result_str,
        moves_json=moves_data
    )
    db.add(new_match)
    db.commit()
    db.refresh(new_match)
    
    return MatchInfo(
        id=new_match.id,
        gameType=new_match.game_type,
        playerBlackName=current_user.username,
        playerWhiteName="Practice/AI",
        result=result_str,
        startTime=new_match.start_time.isoformat() if new_match.start_time else "",
        endTime=None,
        movesJson=moves_data
    )

# SPA Serving Logic
# 1. Mount assets directly
if os.path.exists("frontend_dist/assets"):
    app.mount("/assets", StaticFiles(directory="frontend_dist/assets"), name="assets")

# 2. Catch-all route for React Router
@app.get("/{full_path:path}")
async def serve_spa(full_path: str):
    # Allow API/WS to pass through (though FastAPI should match specific routes first, 
    # this is a safety net if this catch-all is placed too early, but here it is at end)
    if full_path.startswith("api") or full_path.startswith("ws"):
        raise HTTPException(status_code=404, detail="Not Found")
    
    # Serve index.html for any other path (e.g. /login, /game/123)
    index_file = "frontend_dist/index.html"
    if os.path.exists(index_file):
        return FileResponse(index_file)
    return {"message": "Frontend not built or not found"}

