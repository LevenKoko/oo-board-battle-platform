import React, { useState, useEffect } from 'react';
import { GameType, GameConfig, AILevel, Player } from '../types';
import { MIN_BOARD_SIZE, MAX_BOARD_SIZE, DEFAULT_BOARD_SIZE, GAME_DESCRIPTIONS } from '../constants';
import { Settings, Play } from 'lucide-react';

interface GameSetupProps {
  onStartGame: (config: GameConfig) => void;
  isFirstLoad: boolean;
  onCancel: () => void;
}

export const GameSetup: React.FC<GameSetupProps> = ({ onStartGame, isFirstLoad, onCancel, mode = 'practice' }) => {
  const [boardSize, setBoardSize] = useState(DEFAULT_BOARD_SIZE);
  const [gameType, setGameType] = useState<GameType>(GameType.GOMOKU);
  const [playerBlackIsAI, setPlayerBlackIsAI] = useState(false);
  const [playerWhiteIsAI, setPlayerWhiteIsAI] = useState(false);
  const [blackAiLevel, setBlackAiLevel] = useState<AILevel>(AILevel.GREEDY);
  const [whiteAiLevel, setWhiteAiLevel] = useState<AILevel>(AILevel.GREEDY);

  // Enforce 8x8 for Reversi
  useEffect(() => {
    if (gameType === GameType.REVERSI) {
      setBoardSize(8);
    } else {
      setBoardSize(DEFAULT_BOARD_SIZE); // Reset to default for other games
    }
  }, [gameType]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalBoardSize = gameType === GameType.REVERSI ? 8 : boardSize;

    onStartGame({ 
      boardSize: finalBoardSize, 
      gameType,
      playerBlackIsAI,
      playerWhiteIsAI,
      aiLevel: AILevel.HUMAN, // Legacy/Fallback
      blackAILevel: playerBlackIsAI ? blackAiLevel : undefined,
      whiteAILevel: playerWhiteIsAI ? whiteAiLevel : undefined,
    });
  };

  const showAiOptions = mode === 'practice' && (gameType === GameType.GOMOKU || gameType === GameType.REVERSI);

  const AiLevelSelector = ({ label, value, onChange }: { label: string, value: AILevel, onChange: (l: AILevel) => void }) => (
      <div className="flex flex-col gap-2">
          <label className="text-xs text-slate-400 font-bold uppercase">{label}</label>
          <div className="flex gap-2">
            {[AILevel.GREEDY, AILevel.MINIMAX, ...(gameType === GameType.REVERSI || gameType === GameType.GOMOKU ? [AILevel.MCTS] : [])].map((level) => (
                <button
                    key={level}
                    type="button"
                    onClick={() => onChange(level)}
                    className={`px-3 py-2 rounded-lg text-xs border transition-all ${
                        value === level
                        ? 'bg-teal-500 text-white border-teal-500'
                        : 'bg-slate-700 text-slate-300 border-slate-600 hover:border-slate-500'
                    }`}
                >
                    {level === AILevel.GREEDY ? 'Easy' : level === AILevel.MINIMAX ? 'Medium' : 'Hard'}
                </button>
            ))}
          </div>
      </div>
  );

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="bg-slate-900 p-6 border-b border-slate-700 flex items-center gap-3">
          <Settings className="w-6 h-6 text-teal-400" />
          <h2 className="text-xl font-serif font-bold text-white">New Game Setup</h2>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Game Type Selection */}
          <div className="space-y-3">
            <label className="block text-sm font-medium text-slate-400">Game Type</label>
            <div className="grid grid-cols-3 gap-4"> 
              <button
                type="button"
                onClick={() => setGameType(GameType.GO)}
                className={`p-4 rounded-xl border-2 flex flex-col items-center transition-all ${
                  gameType === GameType.GO
                    ? 'border-teal-500 bg-teal-500/10 text-white'
                    : 'border-slate-600 bg-slate-800 text-slate-400 hover:border-slate-500'
                }`}
              >
                <span className="text-lg font-bold">Go</span>
                <span className="text-xs mt-1 opacity-70">Weiqi</span>
              </button>
              <button
                type="button"
                onClick={() => setGameType(GameType.GOMOKU)}
                className={`p-4 rounded-xl border-2 flex flex-col items-center transition-all ${
                  gameType === GameType.GOMOKU
                    ? 'border-teal-500 bg-teal-500/10 text-white'
                    : 'border-slate-600 bg-slate-800 text-slate-400 hover:border-slate-500'
                }`}
              >
                <span className="text-lg font-bold">Gomoku</span>
                <span className="text-xs mt-1 opacity-70">5-in-row</span>
              </button>
              <button
                type="button"
                onClick={() => setGameType(GameType.REVERSI)}
                className={`p-4 rounded-xl border-2 flex flex-col items-center transition-all ${
                  gameType === GameType.REVERSI
                    ? 'border-teal-500 bg-teal-500/10 text-white'
                    : 'border-slate-600 bg-slate-800 text-slate-400 hover:border-slate-500'
                }`}
              >
                <span className="text-lg font-bold">Reversi</span>
                <span className="text-xs mt-1 opacity-70">Othello</span>
              </button>
            </div>
          </div>

          {/* Board Size Slider */}
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <label className="font-medium text-slate-400">Board Size</label>
              <span className="text-teal-400 font-mono font-bold">{boardSize} x {boardSize}</span>
            </div>
            <input
              type="range"
              min={MIN_BOARD_SIZE}
              max={MAX_BOARD_SIZE}
              value={boardSize}
              onChange={(e) => setBoardSize(Number(e.target.value))}
              className={`w-full h-2 rounded-lg appearance-none cursor-pointer accent-teal-500 ${
                gameType === GameType.REVERSI ? 'opacity-50 pointer-events-none' : ''
              }`}
              disabled={gameType === GameType.REVERSI}
            />
          </div>

          {showAiOptions && (
            <div className="space-y-4 bg-slate-700/30 p-4 rounded-xl border border-slate-700">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="playerBlackIsAI"
                      checked={playerBlackIsAI}
                      onChange={(e) => setPlayerBlackIsAI(e.target.checked)}
                      className="form-checkbox h-4 w-4 text-teal-600 rounded border-gray-300 focus:ring-teal-500"
                    />
                    <label htmlFor="playerBlackIsAI" className="ml-2 text-sm font-bold text-slate-200">Black (AI)</label>
                </div>
                {playerBlackIsAI && (
                    <AiLevelSelector label="" value={blackAiLevel} onChange={setBlackAiLevel} />
                )}
              </div>

              <div className="h-px bg-slate-700" />

              <div className="flex items-center justify-between">
                <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="playerWhiteIsAI"
                      checked={playerWhiteIsAI}
                      onChange={(e) => setPlayerWhiteIsAI(e.target.checked)}
                      className="form-checkbox h-4 w-4 text-teal-600 rounded border-gray-300 focus:ring-teal-500"
                    />
                    <label htmlFor="playerWhiteIsAI" className="ml-2 text-sm font-bold text-slate-200">White (AI)</label>
                </div>
                {playerWhiteIsAI && (
                    <AiLevelSelector label="" value={whiteAiLevel} onChange={setWhiteAiLevel} />
                )}
              </div>
            </div>
          )}

          <div className="pt-2 flex gap-3">
            {!isFirstLoad && (
                <button type="button" onClick={onCancel} className="flex-1 px-4 py-3 rounded-xl font-semibold text-slate-300 hover:bg-slate-700 transition-colors">
                Cancel
                </button>
            )}
            <button type="submit" className="flex-1 bg-teal-600 hover:bg-teal-500 text-white px-4 py-3 rounded-xl font-bold shadow-lg shadow-teal-900/20 transition-all flex items-center justify-center gap-2">
              <Play className="w-4 h-4" />
              Start Game
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};