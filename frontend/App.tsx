
import React, { useState, useMemo } from 'react';
import { Board } from './components/Board';
import { GameControls } from './components/GameControls';
import { GameSetup } from './components/GameSetup';
import { GameType, Player, GameState, GameConfig, SavedGame, IGameService } from './types';
import { getGameService } from './services/api';
import { LocalGameService } from './services/localGame';

const INITIAL_GAME_STATE: GameState = {
  grid: [],
  currentPlayer: Player.BLACK,
  history: [],
  prisoners: { [Player.BLACK]: 0, [Player.WHITE]: 0 },
  isGameOver: false,
  winner: null,
  message: "Start a new game",
  lastMove: null,
};

const App: React.FC = () => {
  const [config, setConfig] = useState<GameConfig>({ boardSize: 15, gameType: GameType.GO });
  const [gameState, setGameState] = useState<GameState>(INITIAL_GAME_STATE);
  const [showSetup, setShowSetup] = useState(true);
  const [isFirstLoad, setIsFirstLoad] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Instantiate service. In a real app this might be in a Context.
  const gameService: IGameService = useMemo(() => getGameService(), []);

  const initGame = async (newConfig: GameConfig) => {
    try {
        setError(null);
        const newState = await gameService.startGame(newConfig);
        setConfig(newConfig);
        setGameState(newState);
        setShowSetup(false);
        setIsFirstLoad(false);
    } catch (e) {
        setError("Failed to start game. Ensure backend is running.");
    }
  };

  const handleCellClick = async (x: number, y: number) => {
    if (gameState.isGameOver) return;
    
    try {
        const result = await gameService.makeMove(x, y);
        if (result.success && 'state' in result) {
            setGameState(result.state);
        } else if (!result.success && 'error' in result) {
             setGameState(prev => ({...prev, message: `Invalid: ${result.error}`}));
        }
    } catch (e) {
        setError("Connection error");
    }
  };

  const handleUndo = async () => {
     try {
         const newState = await gameService.undo();
         setGameState(newState);
     } catch (e) { console.error(e); }
  };

  const handlePass = async () => {
     try {
         const newState = await gameService.pass(gameState.currentPlayer);
         setGameState(newState);
     } catch (e) { console.error(e); }
  };

  const handleResign = async () => {
      try {
          const newState = await gameService.resign(gameState.currentPlayer);
          setGameState(newState);
      } catch (e) { console.error(e); }
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
          } catch (apiError) {
              console.error("Backend load failed:", apiError);
              alert("Failed to sync loaded game with backend.");
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
            Mode: <span className="font-semibold text-slate-200">{config.gameType === GameType.GO ? 'Go' : 'Gomoku'}</span>
            <span className="mx-2">•</span>
            Size: {config.boardSize}x{config.boardSize}
          </p>
        </div>
        <div className="hidden md:block text-right">
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

export default App;
