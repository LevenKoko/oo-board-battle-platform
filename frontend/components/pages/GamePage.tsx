
import React, { useState, useMemo, useEffect } from 'react';
import { Board } from '../Board';
import { GameControls } from '../GameControls';
import { GameSetup } from '../GameSetup';
import { GameType, Player, GameState, GameConfig, SavedGame, IGameService, AILevel } from '../../types';
import { getGameService } from '../../services/api';
import { LocalGameService } from '../../services/localGame';
import { useParams, useNavigate } from 'react-router-dom'; // Added useNavigate
import { Home } from 'lucide-react'; // Added Home icon

const INITIAL_GAME_STATE: GameState = {
  gameId: '',
  grid: [],
  currentPlayer: Player.BLACK,
  history: [],
  prisoners: { [Player.BLACK]: 0, [Player.WHITE]: 0 },
  isGameOver: false,
  winner: null,
  message: "Start a new game",
  lastMove: null,
  gameType: GameType.GOMOKU, // Default for now, will be set by config
  boardSize: 15,
};

const GamePage: React.FC = () => {
  const { gameId: routeGameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate(); // Hook for navigation
  const [config, setConfig] = useState<GameConfig>({ boardSize: 15, gameType: GameType.GOMOKU, playerBlackIsAI: false, playerWhiteIsAI: false, aiLevel: AILevel.HUMAN });
  const [gameState, setGameState] = useState<GameState>(INITIAL_GAME_STATE);
  const [showSetup, setShowSetup] = useState(true);
  const [isFirstLoad, setIsFirstLoad] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const gameService: IGameService = useMemo(() => getGameService(), []);

  useEffect(() => {
    // If a gameId is provided in the route, try to load its state or start
    if (routeGameId && gameState.gameId !== routeGameId) {
        // In a real scenario, you'd fetch the game state for routeGameId
        // For now, let's just make sure the gameId matches.
        // If the game needs to be loaded from an ID, it needs a /api/game/{id} endpoint
        // For simplicity, we'll assume gameId is mostly used for AI state tracking in controller
        // and game setup is primary.
        // Or, we might load game by ID here. This is a placeholder for now.
    }
  }, [routeGameId, gameState.gameId]);

  const initGame = async (newConfig: GameConfig) => {
    try {
        setError(null);
        const newState = await gameService.startGame(newConfig);
        setConfig(newConfig);
        setGameState(newState);
        setShowSetup(false);
        setIsFirstLoad(false);
    } catch (e: any) {
        setError("Failed to start game. Ensure backend is running. " + (e.message || ""));
    }
  };

  const handleCellClick = async (x: number, y: number) => {
    if (gameState.isGameOver) return;
    
    try {
        const result = await gameService.makeMove(x, y);
        if (result.success && 'state' in result && result.state) {
            setGameState(result.state);
        } else if (!result.success && 'error' in result) {
             setGameState(prev => ({...prev, message: `Invalid: ${result.error}`}));
        }
    } catch (e) {
        setError("Connection error during move.");
    }
  };

  const handleUndo = async () => {
     try {
         const newState = await gameService.undo();
         setGameState(newState);
     } catch (e: any) { 
        console.error(e); 
        setError("Failed to undo: " + (e.message || ""));
    }
  };

  const handlePass = async () => {
     try {
         const newState = await gameService.pass(gameState.currentPlayer);
         setGameState(newState);
     } catch (e: any) { 
        console.error(e); 
        setError("Failed to pass: " + (e.message || ""));
    }
  };

  const handleResign = async () => {
      try {
          const newState = await gameService.resign(gameState.currentPlayer);
          setGameState(newState);
      } catch (e: any) { 
        console.error(e); 
        setError("Failed to resign: " + (e.message || ""));
    }
  };

  const handleSave = () => {
    const saveData: SavedGame = {
      config,
      state: gameState,
      timestamp: Date.now()
    };
    const blob = new Blob([JSON.stringify(saveData)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `zenith_${config.gameType.toLowerCase()}_${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleLoad = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data: SavedGame = JSON.parse(event.target?.result as string);
        if (data.config && data.state) {
          // Call backend to load game
          try {
              const newState = await gameService.loadGame(data);
              setConfig(data.config);
              setGameState(newState);
          } catch (apiError: any) {
              console.error("Backend load failed:", apiError);
              alert("Failed to sync loaded game with backend. " + (apiError.message || ""));
          }
        } else {
          alert("Invalid save file format");
        }
      } catch (err) {
        alert("Failed to load game file");
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // AI Auto-play Effect
  useEffect(() => {
    if (gameState.isGameOver) return;

    const isBlackTurn = gameState.currentPlayer === Player.BLACK;
    const isWhiteTurn = gameState.currentPlayer === Player.WHITE;
    
    const isAiTurn = (isBlackTurn && config.playerBlackIsAI) || (isWhiteTurn && config.playerWhiteIsAI);

    if (isAiTurn) {
        // Add a small delay for better UX (so moves aren't instant)
        const timer = setTimeout(async () => {
            try {
                const result = await gameService.triggerAiMove();
                if (result.success && result.state) {
                    setGameState(result.state);
                } else if (!result.success) {
                    // If AI fails (e.g. pass condition not handled automatically, or server error), log it
                    console.warn("AI trigger failed:", result.error);
                    // In Reversi, if AI has no moves, it should have passed. 
                    // If backend didn't pass automatically, we might need to handle pass here?
                    // But our backend handles pass automatically if no moves.
                }
            } catch (e) {
                console.error("Error triggering AI move:", e);
            }
        }, 1000); // 1 second delay

        return () => clearTimeout(timer);
    }
  }, [gameState, config]); // Re-run when state changes (turn switches)

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 md:p-8 font-sans">
      {showSetup && (
        <GameSetup 
          onStartGame={initGame} 
          isFirstLoad={isFirstLoad} 
          onCancel={() => setShowSetup(false)} 
        />
      )}

      <header className="w-full max-w-5xl flex justify-between items-end mb-6 border-b border-slate-700 pb-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-serif font-bold text-slate-100 tracking-wide">
            Zenith <span className="text-teal-500">Board Battle</span>
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Mode: <span className="font-semibold text-slate-200">{config.gameType === GameType.GO ? 'Go' : config.gameType === GameType.GOMOKU ? 'Gomoku' : 'Reversi'}</span>
            <span className="mx-2">•</span>
            Size: {config.boardSize}x{config.boardSize}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
           <button
              onClick={() => navigate('/lobby')}
              className="flex items-center gap-2 px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors text-xs border border-slate-700"
           >
              <Home className="w-3 h-3" /> Lobby
           </button>
           <div className={`px-4 py-1 rounded-full text-sm font-bold inline-block ${
             gameState.currentPlayer === Player.BLACK 
               ? 'bg-stone-black text-white border border-slate-600' 
               : 'bg-stone-white text-black'
           }`}>
             Turn: {gameState.currentPlayer}
           </div>
        </div>
      </header>

      {error && (
        <div className="w-full max-w-5xl bg-red-900/50 border border-red-800 text-red-200 p-3 rounded-lg mb-4">
            {error}
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
                validMoves={gameState.validMoves || []} // Pass valid moves
                currentPlayer={gameState.currentPlayer} // Pass current player for hint color
              />
           </div>
        </div>

        <div className="lg:col-span-4 space-y-6">
          <div className="bg-slate-800 rounded-xl p-6 shadow-lg border border-slate-700">
             <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-4">Game Status</h3>
             <div className="text-xl font-serif text-white mb-6 min-h-[3rem]">
               {gameState.message}
             </div>
             {config.gameType === GameType.GO && (
               <div className="grid grid-cols-2 gap-4 mb-2">
                 <div className="bg-slate-900/50 p-3 rounded-lg flex items-center gap-3 border border-slate-700">
                    <div className="w-4 h-4 rounded-full bg-stone-black border border-slate-600"></div>
                    <div>
                      <div className="text-xs text-slate-400">Prisoners</div>
                      <div className="font-mono font-bold text-lg">{gameState.prisoners[Player.BLACK]}</div>
                    </div>
                 </div>
                 <div className="bg-slate-900/50 p-3 rounded-lg flex items-center gap-3 border border-slate-700">
                    <div className="w-4 h-4 rounded-full bg-stone-white"></div>
                    <div>
                      <div className="text-xs text-slate-400">Prisoners</div>
                      <div className="font-mono font-bold text-lg">{gameState.prisoners[Player.WHITE]}</div>
                    </div>
                 </div>
               </div>
             )}
             {config.gameType === GameType.REVERSI && (
                 <div className="grid grid-cols-2 gap-4 mb-2">
                    <div className="bg-slate-900/50 p-3 rounded-lg flex items-center gap-3 border border-slate-700">
                        <div className="w-4 h-4 rounded-full bg-stone-black border border-slate-600"></div>
                        <div>
                            <div className="text-xs text-slate-400">Black Discs</div>
                            <div className="font-mono font-bold text-lg">
                                {gameState.grid.flat().filter(p => p === Player.BLACK).length}
                            </div>
                        </div>
                    </div>
                    <div className="bg-slate-900/50 p-3 rounded-lg flex items-center gap-3 border border-slate-700">
                        <div className="w-4 h-4 rounded-full bg-stone-white"></div>
                        <div>
                            <div className="text-xs text-slate-400">White Discs</div>
                            <div className="font-mono font-bold text-lg">
                                {gameState.grid.flat().filter(p => p === Player.WHITE).length}
                            </div>
                        </div>
                    </div>
                 </div>
             )}
          </div>

          <GameControls 
            onUndo={handleUndo}
            onPass={handlePass}
            onResign={handleResign}
            onRestart={() => setShowSetup(true)}
            onSave={handleSave}
            onLoad={handleLoad}
            canUndo={gameState.history.length > 1}
            isGo={config.gameType === GameType.GO}
            isReversi={config.gameType === GameType.REVERSI}
            gameOver={gameState.isGameOver}
          />

          <div className="text-xs text-slate-500 leading-relaxed px-2">
             <p>Using {getGameService() instanceof LocalGameService ? "Local Browser" : "Python Backend"} Logic.</p>
          </div>
        </div>
      </main>
    </div>
  );
};

export default GamePage;
