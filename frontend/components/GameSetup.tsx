import React, { useState } from 'react';
import { GameType, GameConfig } from '../types';
import { MIN_BOARD_SIZE, MAX_BOARD_SIZE, DEFAULT_BOARD_SIZE, GAME_DESCRIPTIONS } from '../constants';
import { Settings, Play } from 'lucide-react';

interface GameSetupProps {
  onStartGame: (config: GameConfig) => void;
  isFirstLoad: boolean;
  onCancel: () => void;
}

export const GameSetup: React.FC<GameSetupProps> = ({ onStartGame, isFirstLoad, onCancel }) => {
  const [boardSize, setBoardSize] = useState(DEFAULT_BOARD_SIZE);
  const [gameType, setGameType] = useState<GameType>(GameType.GO);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onStartGame({ boardSize, gameType });
  };

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
            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setGameType(GameType.GO)}
                className={`p-4 rounded-xl border-2 flex flex-col items-center transition-all ${
                  gameType === GameType.GO
                    ? 'border-teal-500 bg-teal-500/10 text-white'
                    : 'border-slate-600 bg-slate-800 text-slate-400 hover:border-slate-500'
                }`}
              >
                <span className="text-lg font-bold">Go (Weiqi)</span>
                <span className="text-xs mt-1 opacity-70">Territory & Capture</span>
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
                <span className="text-xs mt-1 opacity-70">Five-in-a-row</span>
              </button>
            </div>
            <p className="text-xs text-slate-400 bg-slate-900/50 p-3 rounded-lg border border-slate-700">
              {GAME_DESCRIPTIONS[gameType]}
            </p>
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
              className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-teal-500"
            />
            <div className="flex justify-between text-xs text-slate-500 font-mono">
              <span>{MIN_BOARD_SIZE}x{MIN_BOARD_SIZE}</span>
              <span>{MAX_BOARD_SIZE}x{MAX_BOARD_SIZE}</span>
            </div>
          </div>

          <div className="pt-2 flex gap-3">
            {!isFirstLoad && (
                <button
                type="button"
                onClick={onCancel}
                className="flex-1 px-4 py-3 rounded-xl font-semibold text-slate-300 hover:bg-slate-700 transition-colors"
                >
                Cancel
                </button>
            )}
            <button
              type="submit"
              className="flex-1 bg-teal-600 hover:bg-teal-500 text-white px-4 py-3 rounded-xl font-bold shadow-lg shadow-teal-900/20 transition-all flex items-center justify-center gap-2"
            >
              <Play className="w-4 h-4" />
              Start Game
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};