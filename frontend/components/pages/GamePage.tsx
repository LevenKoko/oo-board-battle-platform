import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Board } from '../Board';
import { GameControls } from '../GameControls';
import { GameSetup } from '../GameSetup';
import { RoomLobby } from '../RoomLobby';
import { SaveLoadModal } from '../modals/SaveLoadModal';
import { CloudReplayPicker } from '../modals/CloudReplayPicker';
import { ExitSavePrompt } from '../modals/ExitSavePrompt';
import { GameType, Player, GameState, GameConfig, SavedGame, IGameService, AILevel, RoomSession } from '../../types';
import { getGameService, AuthService, ReplayService } from '../../services/api';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Home, AlertCircle } from 'lucide-react';

const INITIAL_GAME_STATE: GameState = {
  gameId: '',
  grid: [],
  currentPlayer: Player.BLACK,
  history: [],
  prisoners: { [Player.BLACK]: 0, [Player.WHITE]: 0 },
  isGameOver: false,
  winner: null,
  message: "Initializing...",
  lastMove: null,
  gameType: GameType.GOMOKU,
  boardSize: 15,
  validMoves: [],
};

const GamePage: React.FC = () => {
  const { gameId: routeGameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  
  const preloadedState = location.state as { initialState: GameState; initialConfig: GameConfig } | null;

  const isOnline = useMemo(() => {
      const online = !!(routeGameId && !isNaN(Number(routeGameId)));
      return online;
  }, [routeGameId]);

  const [config, setConfig] = useState<GameConfig>(preloadedState?.initialConfig || { 
    boardSize: 15, 
    gameType: GameType.GOMOKU, 
    playerBlackIsAI: false, 
    playerWhiteIsAI: false, 
    aiLevel: AILevel.HUMAN,
    blackAILevel: AILevel.GREEDY,
    whiteAILevel: AILevel.GREEDY
  });
  
  const [gameState, setGameState] = useState<GameState>(preloadedState?.initialState || INITIAL_GAME_STATE);
  const [showSetup, setShowSetup] = useState(!isOnline && !preloadedState); 
  const [statusMessage, setStatusMessage] = useState<string>(isOnline ? "Connecting to server..." : "Ready");
  const [error, setError] = useState<string | null>(null);
  
  // Online Lobby State
  const [roomSession, setRoomSession] = useState<RoomSession | null>(null);
  const [currentUserId, setCurrentUserId] = useState<number | undefined>(undefined);
  
  // Modals State
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showLoadModal, setShowLoadModal] = useState(false);
  const [showCloudPicker, setShowCloudPicker] = useState(false);
  const [showExitPrompt, setShowExitPrompt] = useState(false);

  const ws = useRef<WebSocket | null>(null);
  const gameService = useMemo(() => getGameService(), []);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch Current User ID for Online Logic
  useEffect(() => {
      if (isOnline) {
          AuthService.fetchCurrentUser().then(user => {
              if (user && user.id) {
                  setCurrentUserId(user.id);
              }
          });
      }
  }, [isOnline]);

  // WebSocket Effect (Online Only)
  useEffect(() => {
      if (!isOnline || !routeGameId) return;

      const token = AuthService.getToken();
      if (!token) {
          setError("Please login to play online.");
          return;
      }

      setStatusMessage("Connecting to game room...");
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.hostname || 'localhost';
      const port = window.location.port ? `:${window.location.port}` : '';
      const wsUrl = `${protocol}//${host}${port}/ws/game/${routeGameId}?token=${token}`;
      
      console.log("[GamePage] Connecting WS:", wsUrl);

      const socket = new WebSocket(wsUrl);

      socket.onopen = () => {
          setStatusMessage("Connected. Waiting for game...");
          setError(null);
      };

      socket.onmessage = (event) => {
          try {
              const data = JSON.parse(event.data);
              if (data.type === 'ROOM_UPDATE') {
                  setRoomSession(data.session);
              } else if (data.type === 'GAME_START') {
                  setRoomSession(null); // Hide lobby? No, we keep it for ID but hide via condition
                  setGameState(data.state);
                  setConfig(prev => ({
                      ...prev,
                      gameType: data.state.gameType,
                      boardSize: data.state.boardSize
                  }));
                  setStatusMessage("Game Started!");
              } else if (data.type === 'GAME_STATE') {
                  setGameState(data.state);
              } else if (data.type === 'ERROR') {
                  setGameState(prev => ({...prev, message: `Error: ${data.message}`}));
              }
          } catch (e) {
              console.error("[GamePage] Failed to parse WS message", e);
          }
      };

      socket.onclose = (event) => {
          setStatusMessage("Disconnected from server.");
      };

      socket.onerror = (err) => {
          setError("Failed to connect to game server.");
      };

      ws.current = socket;

      return () => {
          if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
              socket.close();
          }
      };
  }, [isOnline, routeGameId]);

  // AI Auto-play Effect (Local Only)
  useEffect(() => {
    if (gameState.isGameOver || isOnline) return;

    const isBlackTurn = gameState.currentPlayer === Player.BLACK;
    const isWhiteTurn = gameState.currentPlayer === Player.WHITE;
    
    const isAiTurn = (isBlackTurn && config.playerBlackIsAI) || (isWhiteTurn && config.playerWhiteIsAI);

    if (isAiTurn) {
        const timer = setTimeout(async () => {
            try {
                const result = await gameService.triggerAiMove();
                if (result.success && result.state) {
                    setGameState(result.state);
                } else if (!result.success) {
                    console.warn("AI trigger failed:", result.error);
                }
            } catch (e) {
                console.error("Error triggering AI move:", e);
            }
        }, 1000); 

        return () => clearTimeout(timer);
    }
  }, [gameState, config, isOnline, gameService]);

  const initLocalGame = async (newConfig: GameConfig) => {
    try {
        setError(null);
        const newState = await gameService.startGame(newConfig);
        setConfig(newConfig);
        setGameState(newState);
        setShowSetup(false);
    } catch (e: any) {
        setError("Failed to start local game: " + e.message);
    }
  };

  const handleCellClick = async (x: number, y: number) => {
    if (gameState.isGameOver) return;
    
    if (isOnline) {
        if (ws.current && ws.current.readyState === WebSocket.OPEN) {
            ws.current.send(JSON.stringify({ action: "MOVE", x, y }));
        }
        return;
    }

    try {
        const result = await gameService.makeMove(x, y);
        if (result.success && result.state) {
            setGameState(result.state);
        } else if (!result.success) {
             setGameState(prev => ({...prev, message: `Invalid: ${result.error}`}));
        }
    } catch (e) {
        setError("Connection error.");
    }
  };

  // Save/Load Handlers
  const performLocalSave = () => {
      const savedData = {
          config,
          state: gameState,
          timestamp: Date.now(),
      };
      const blob = new Blob([JSON.stringify(savedData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `board-battle-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setShowSaveModal(false);
  };

  const performCloudSave = async () => {
      try {
          await ReplayService.saveReplay(config, gameState, { 
              black_is_ai: config.playerBlackIsAI,
              white_is_ai: config.playerWhiteIsAI,
              // ... levels
          });
          alert("Game saved to cloud successfully!");
          setShowSaveModal(false);
      } catch (e: any) {
          alert("Failed to save to cloud: " + e.message);
      }
  };

  const performLocalLoad = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async (event) => {
          try {
              const content = event.target?.result as string;
              const savedGame = JSON.parse(content) as SavedGame;
              const newState = await gameService.loadGame(savedGame);
              setConfig(savedGame.config);
              setGameState(newState);
              setShowLoadModal(false);
              
              // If we were online, we should probably switch to practice mode?
              // Requirement says: "can only load to Practice".
              if (isOnline) {
                  navigate('/game', { state: { initialState: newState, initialConfig: savedGame.config } });
              }
          } catch (err) {
              alert("Failed to load game file.");
          }
      };
      reader.readAsText(file);
  };

  const performCloudLoad = async (matchId: number) => {
      try {
          const matchInfo = await ReplayService.fetchReplayById(matchId);
          // Convert matchInfo (movesJson) to SavedGame format or re-create state logic?
          // Backend `loadGame` endpoint accepts SavedGame {config, state}.
          // But Replay API returns MatchInfo which has movesJson.
          // We need to reconstruct GameState from movesJson? Or let backend do it?
          // `ReplayService` doesn't return GameState.
          // Wait, `movesJson` has history.
          // We can construct a `SavedGame` object from `matchInfo.movesJson` if it follows the structure.
          // Our `save_replay` saves `moves_json` as `{ meta: {...}, history: [...] }`.
          // `SavedGame` expects `{ config, state, ... }`.
          // This is mismatched.
          // We need a way to load a replay as an active game.
          // Let's use `gameService.loadGame` but we need the state.
          // Actually `matchInfo.movesJson` IS almost the state info.
          // Let's parse it.
          const meta = matchInfo.movesJson.meta || {};
          const history = matchInfo.movesJson.history || [];
          const lastStateGrid = history.length > 0 ? history[history.length - 1].grid : [];
          // This is hard to reconstruct fully without backend logic.
          // Simplest way: Pass the `moves_json` to a new backend endpoint to "restore" game?
          // Or: Just rely on `loadGame` endpoint if we can mock the state.
          // For now, assume we can't easily load cloud replay into Practice without more backend support to "deserialize" Match to Game.
          // But wait, `moves_json` stores the whole history.
          // `game_controller.load_game` takes `state`.
          // Let's try to construct a minimal state.
          const loadedConfig = meta.config as GameConfig;
          // We need to reconstruct the game state.
          // Let's assume we just start a new game with that config? No.
          // Okay, for MVP, let's just alert that Cloud Load implementation needs backend support for deserialization.
          // OR: Just fix it properly.
          // We already store `history` in `moves_json`.
          // We can recreate `GameState` on frontend?
          // `GameState` has grid, history, currentPlayer etc.
          // If we have history, we can determine current player (len % 2).
          // Grid is last history item.
          // IsGameOver? Check last item.
          // Let's try.
          
          const lastGrid = history[history.length - 1];
          // Reconstruct history ensuring it matches BoardGrid structure { grid: ... }
          const formattedHistory = history.map((h: any) => {
              if (Array.isArray(h)) return { grid: h };
              if (h.grid) return { grid: h.grid };
              return { grid: h };
          });

          const loadedState: GameState = {
              gameId: '',
              grid: lastGrid.grid || lastGrid, 
              currentPlayer: history.length % 2 === 0 ? Player.BLACK : Player.WHITE, 
              history: formattedHistory,
              prisoners: { [Player.BLACK]: 0, [Player.WHITE]: 0 }, 
              isGameOver: !!matchInfo.result,
              winner: null, 
              message: "Loaded from cloud",
              lastMove: null,
              gameType: matchInfo.gameType as GameType,
              boardSize: loadedConfig?.boardSize || 15,
              validMoves: []
          };
          
          if (loadedConfig) {
              const newState = await gameService.loadGame({ config: loadedConfig, state: loadedState, timestamp: 0 });
              setConfig(loadedConfig);
              setGameState(newState);
              setShowCloudPicker(false);
              setShowLoadModal(false);
              if (isOnline) {
                  navigate('/game', { state: { initialState: newState, initialConfig: loadedConfig } });
              }
          }
      } catch (e: any) {
          alert("Failed to load cloud replay: " + e.message);
      }
  };

  // Online Actions
  const handleToggleReady = () => {
      ws.current?.send(JSON.stringify({ action: "TOGGLE_READY" }));
  };
  
  const handleRequestSwitch = () => {
      ws.current?.send(JSON.stringify({ action: "REQUEST_SWITCH" }));
  };

  const handleApproveSwitch = () => {
      ws.current?.send(JSON.stringify({ action: "APPROVE_SWITCH" }));
  };

  const handleRejectSwitch = () => {
      ws.current?.send(JSON.stringify({ action: "REJECT_SWITCH" }));
  };

  const handleLeaveRoom = () => {
      // If online and in lobby, just leave without saving prompt
      if (isOnline && roomSession && (!roomSession.black_ready || !roomSession.white_ready)) {
          // Send LEAVE message to ensure session cleanup
          if (ws.current && ws.current.readyState === WebSocket.OPEN) {
              ws.current.send(JSON.stringify({ action: "LEAVE" }));
          }
          setTimeout(() => { // Give a tiny bit of time for the message to send
              navigate('/lobby');
          }, 50);
          return;
      }

      // If online and game started, or local game, show prompt
      setShowExitPrompt(true);
  };

  const confirmLeave = async (save: boolean) => {
      if (save) {
          await performCloudSave();
      }
      // Then leave
      if (isOnline && ws.current?.readyState === WebSocket.OPEN) {
          ws.current.send(JSON.stringify({ action: "LEAVE" }));
      }
      setShowExitPrompt(false);
      setTimeout(() => navigate('/lobby'), 50);
  };

  const handleControls = (action: 'undo' | 'pass' | 'resign' | 'restart') => {
      if (isOnline) {
          if (action === 'restart') {
              ws.current?.send(JSON.stringify({ action: "REMATCH" }));
          } else if (action === 'pass') {
              ws.current?.send(JSON.stringify({ action: "PASS" }));
          } else if (action === 'resign') {
              ws.current?.send(JSON.stringify({ action: "RESIGN" })); 
          } else if (action === 'undo') {
              ws.current?.send(JSON.stringify({ action: "UNDO" }));
          } else {
              alert("This feature is not yet available in online mode.");
          }
          return;
      }
      if (action === 'undo') gameService.undo().then(setGameState).catch(e => setError(e.message));
      if (action === 'pass') gameService.pass(gameState.currentPlayer).then(setGameState).catch(e => setError(e.message));
      if (action === 'resign') gameService.resign(gameState.currentPlayer).then(setGameState).catch(e => setError(e.message));
      if (action === 'restart') setShowSetup(true);
  };

  // Determine my color
  const myColor = useMemo(() => {
      if (!roomSession || !currentUserId) return null;
      if (roomSession.black_player_id === currentUserId) return Player.BLACK;
      if (roomSession.white_player_id === currentUserId) return Player.WHITE;
      return null;
  }, [roomSession, currentUserId]);

  const canUndo = (!isOnline && gameState.history.length > 0) || 
                  (isOnline && !!myColor && gameState.currentPlayer !== myColor && gameState.history.length > 0);

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 md:p-8 font-sans relative">
      {showSetup && !isOnline && (
        <GameSetup 
          onStartGame={initLocalGame} 
          isFirstLoad={true} 
          onCancel={() => setShowSetup(false)} 
        />
      )}
      
      {/* Modals */}
      <SaveLoadModal 
          type="save" 
          isOpen={showSaveModal} 
          onClose={() => setShowSaveModal(false)}
          onLocalAction={performLocalSave}
          onCloudAction={performCloudSave}
      />
      <SaveLoadModal 
          type="load" 
          isOpen={showLoadModal} 
          onClose={() => setShowLoadModal(false)}
          onLocalAction={() => fileInputRef.current?.click()}
          onCloudAction={() => setShowCloudPicker(true)}
      />
      <CloudReplayPicker 
          isOpen={showCloudPicker}
          onClose={() => setShowCloudPicker(false)}
          onSelect={performCloudLoad}
      />
      <ExitSavePrompt 
          isOpen={showExitPrompt}
          onClose={() => setShowExitPrompt(false)}
          onConfirm={() => confirmLeave(true)}
          onDeny={() => confirmLeave(false)}
      />
      
      {/* Hidden File Input */}
      <input 
          type="file" 
          accept=".json" 
          ref={fileInputRef} 
          onChange={performLocalLoad} 
          className="hidden" 
      />

      {/* Online Room Lobby */}
      {isOnline && roomSession && (!roomSession.black_ready || !roomSession.white_ready) && (
          <RoomLobby 
            session={roomSession} 
            currentUserId={currentUserId} 
            onToggleReady={handleToggleReady}
            onRequestSwitch={handleRequestSwitch}
            onApproveSwitch={handleApproveSwitch}
            onRejectSwitch={handleRejectSwitch}
            onLeave={handleLeaveRoom} 
          />
      )}

      {/* Header */}
      <header className="w-full max-w-5xl flex justify-between items-end mb-6 border-b border-slate-700 pb-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-serif font-bold text-slate-100 tracking-wide">
            Zenith <span className="text-teal-500">Board Battle</span>
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            {isOnline ? <span className="text-green-400 font-bold">ONLINE ROOM #{routeGameId}</span> : "Local Practice"}
            <span className="mx-2">•</span>
            {config.gameType} ({config.boardSize}x{config.boardSize})
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
           <button onClick={handleLeaveRoom} className="flex items-center gap-2 px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs border border-slate-700">
              <Home className="w-3 h-3" /> Lobby
           </button>
           <div className={`px-4 py-1 rounded-full text-sm font-bold inline-block ${
             gameState.currentPlayer === Player.BLACK ? 'bg-stone-black text-white border-slate-600' : 'bg-stone-white text-black'
           }`}>
             Turn: {gameState.currentPlayer}
           </div>
        </div>
      </header>

      {error && (
        <div className="w-full max-w-5xl bg-red-900/50 border border-red-800 text-red-200 p-4 rounded-lg mb-4 flex items-center gap-3">
            <AlertCircle className="w-5 h-5" />
            {error}
        </div>
      )}

      {isOnline && !error && (
          <div className="w-full max-w-5xl bg-slate-800 p-2 rounded-lg mb-4 text-center text-sm text-slate-400">
              Status: <span className="text-teal-400">{statusMessage}</span>
          </div>
      )}

      <main className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 flex justify-center items-start">
           <div className="w-full max-w-[600px] lg:max-w-full">
              <Board 
                grid={gameState.grid} 
                lastMove={gameState.lastMove} 
                onCellClick={handleCellClick} 
                readOnly={gameState.isGameOver}
                validMoves={gameState.validMoves || []} 
                currentPlayer={gameState.currentPlayer} 
              />
           </div>
        </div>

        <div className="lg:col-span-4 space-y-6">
          <div className="bg-slate-800 rounded-xl p-6 shadow-lg border border-slate-700">
             <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-4">Game Info</h3>
             <div className="text-xl font-serif text-white mb-6 min-h-[3rem]">{gameState.message}</div>
          </div>

          <GameControls 
            onUndo={() => handleControls('undo')}
            onPass={() => handleControls('pass')}
            onResign={() => handleControls('resign')}
            onRestart={() => handleControls('restart')} 
            onSave={() => setShowSaveModal(true)}
            onLoad={() => setShowLoadModal(true)}
            onLeave={handleLeaveRoom} 
            canUndo={canUndo}
            isGo={config.gameType === GameType.GO}
            isReversi={config.gameType === GameType.REVERSI}
            gameOver={gameState.isGameOver}
            isOnline={isOnline} 
          />
        </div>
      </main>
    </div>
  );
};

export default GamePage;