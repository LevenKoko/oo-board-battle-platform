import React from 'react';
import { Undo, Flag, RotateCcw, Download, Upload, LogOut } from 'lucide-react'; // Added LogOut

interface GameControlsProps {
  onUndo: () => void;
  onPass?: () => void;
  onResign: () => void;
  onRestart: () => void;
  onSave: () => void;
  onLoad: () => void; // Changed type
  onLeave?: () => void; 
  canUndo: boolean;
  isGo: boolean;
  isReversi: boolean;
  gameOver: boolean;
  isOnline: boolean; 
}

export const GameControls: React.FC<GameControlsProps> = ({
  onUndo,
  onPass,
  onResign,
  onRestart,
  onSave,
  onLoad,
  onLeave, 
  canUndo,
  isGo,
  isReversi,
  gameOver,
  isOnline 
}) => {
  return (
    <div className="bg-slate-800 rounded-xl p-4 shadow-lg border border-slate-700 space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {/* Primary Actions */}
        <button
          onClick={onUndo}
          disabled={!canUndo || gameOver}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed text-slate-200 rounded-lg transition-colors"
        >
          <Undo className="w-4 h-4" /> Undo
        </button>

        {(isGo || isReversi) && onPass && (
          <button
            onClick={onPass}
            disabled={gameOver}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-amber-900/50 hover:bg-amber-800/50 text-amber-200 border border-amber-800/50 rounded-lg transition-colors"
          >
              Pass
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {gameOver && onLeave ? (
            <button
                onClick={onLeave}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 border border-slate-600 rounded-lg transition-colors"
            >
                <LogOut className="w-4 h-4" /> Leave
            </button>
        ) : (
            <button
                onClick={onResign}
                disabled={gameOver}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-red-900/30 hover:bg-red-900/50 text-red-300 border border-red-900/50 rounded-lg transition-colors"
            >
                <Flag className="w-4 h-4" /> Resign
            </button>
        )}

        {(!isOnline || gameOver) && (
            <button
            onClick={onRestart}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-teal-900/30 hover:bg-teal-900/50 text-teal-300 border border-teal-900/50 rounded-lg transition-colors"
            >
            <RotateCcw className="w-4 h-4" /> {isOnline ? "Rematch" : "New"}
            </button>
        )}
      </div>

      {/* Save/Load Section */}
      <div className="h-px bg-slate-700 my-2" />

      <div className="grid grid-cols-2 gap-3">
        <button
        onClick={onSave}
        className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg transition-colors text-sm"
        >
        <Download className="w-4 h-4" /> Save
        </button>
        
        {!isOnline && (
            <button 
            onClick={onLoad}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg transition-colors text-sm"
            >
            <Upload className="w-4 h-4" /> Load
            </button>
        )}
      </div>
    </div>
  );
};