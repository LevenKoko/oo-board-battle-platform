import React, { useMemo } from 'react';
import { Player, BoardGrid } from '../types';
import { getStarPoints } from '../constants';

interface BoardProps {
  grid: BoardGrid;
  lastMove: { x: number; y: number } | null;
  onCellClick: (x: number, y: number) => void;
  readOnly: boolean;
  validMoves: [number, number][]; // Updated type
  currentPlayer: Player; 
}

export const Board: React.FC<BoardProps> = ({ grid, lastMove, onCellClick, readOnly, validMoves, currentPlayer }) => {
  const size = grid.length;
  
  const starPoints = useMemo(() => getStarPoints(size), [size]);

  // Helper to check if a cell is a valid move
  const isValidMove = (x: number, y: number) => {
    // If no valid moves are provided (e.g. Gomoku/Go), assume all empty cells are valid for interaction
    // The backend will enforce rules anyway.
    if (!validMoves || validMoves.length === 0) return true;
    // Check if [x, y] exists in validMoves array
    return validMoves.some(move => move[0] === x && move[1] === y);
  };

  // Calculate dimensions for the grid lines to ensure they pass through cell centers
  const lineStart = (0.5 / size) * 100;
  const lineLength = ((size - 1) / size) * 100;

  return (
    <div className="relative select-none shadow-2xl rounded-sm overflow-hidden bg-[#dcb35c]">
      {/* Board Background & Texture */}
      <div className="absolute inset-0 pointer-events-none">
         {/* Wood Texture */}
        <div className="absolute inset-0 opacity-30 bg-[url('https://www.transparenttextures.com/patterns/wood-pattern.png')] mix-blend-multiply"></div>
        {/* Subtle vignette/gradient for realism */}
        <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-black/20"></div>
      </div>

      {/* Container with aspect ratio lock */}
      <div 
        className="grid relative"
        style={{ 
          gridTemplateColumns: `repeat(${size}, 1fr)`,
          width: '100%',
          aspectRatio: '1/1',
          padding: '4%', // Padding acts as the edge of the board (wood bezel)
        }}
      >
        {/* The Grid Lines Layer */}
        {/* We use padding match to position the line container exactly over the grid content area */}
        <div className="absolute inset-0 pointer-events-none p-[4%]">
           <div className="w-full h-full relative">
             {/* Horizontal Lines */}
             {Array.from({ length: size }).map((_, i) => (
                <div 
                  key={`h-${i}`} 
                  className="absolute bg-black/80"
                  style={{
                    top: `${((i + 0.5) / size) * 100}%`,
                    left: `${lineStart}%`,
                    width: `${lineLength}%`,
                    height: '1px',
                    transform: 'translateY(-50%)' // Perfect vertical centering
                  }}
                />
             ))}
             {/* Vertical Lines */}
             {Array.from({ length: size }).map((_, i) => (
                <div 
                  key={`v-${i}`} 
                  className="absolute bg-black/80"
                  style={{
                    left: `${((i + 0.5) / size) * 100}%`,
                    top: `${lineStart}%`,
                    height: `${lineLength}%`,
                    width: '1px',
                    transform: 'translateX(-50%)' // Perfect horizontal centering
                  }}
                />
             ))}
             
             {/* Star Points */}
             {starPoints.map((p, idx) => (
               <div
                 key={`star-${idx}`}
                 className="absolute bg-black rounded-full shadow-sm"
                 style={{
                   width: size > 13 ? '4px' : '3px',
                   height: size > 13 ? '4px' : '3px',
                   left: `${((p.x + 0.5) / size) * 100}%`,
                   top: `${((p.y + 0.5) / size) * 100}%`,
                   transform: 'translate(-50%, -50%)'
                 }}
               />
             ))}
           </div>
        </div>

        {/* The Interactive Cells & Stones Layer */}
        {grid.map((row, y) => (
          row.map((cell, x) => {
            const isLastMove = lastMove?.x === x && lastMove?.y === y;
            const isCurrentValidMove = !readOnly && !cell && isValidMove(x, y);
            
            return (
              <div
                key={`${x}-${y}`}
                onClick={() => isCurrentValidMove && onCellClick(x, y)}
                className={`
                  relative z-10 flex items-center justify-center
                  ${isCurrentValidMove ? 'cursor-pointer group' : ''}
                `}
              >
                {/* Valid Move Hint */}
                {isCurrentValidMove && (
                   <div className={`
                        w-[30%] h-[30%] rounded-full opacity-60 transition-all duration-200
                        ${currentPlayer === Player.BLACK ? 'bg-black' : 'bg-white'}
                        group-hover:scale-125
                   `}></div>
                )}

                {/* Hover ghost stone (semi-transparent indicator) - now only for invalid empty cells*/}
                {/* Replaced by Valid Move Hint */}
                {/*
                {!cell && !readOnly && !isCurrentValidMove && (
                   <div className="w-[40%] h-[40%] rounded-full bg-black/20 opacity-0 group-hover:opacity-100 transition-all duration-200 scale-75 group-hover:scale-100"></div>
                )}
                */}

                {/* Actual Stone */}
                {cell && (
                  <div
                    className={`
                      w-[94%] h-[94%] rounded-full shadow-md
                      ${cell === Player.BLACK 
                        ? 'bg-gradient-to-br from-stone-800 to-black ring-1 ring-black/50 shadow-stone-black' 
                        : 'bg-gradient-to-br from-white to-stone-200 ring-1 ring-black/10 shadow-stone-white'
                      }
                      transform transition-all duration-300 ease-out animate-in fade-in zoom-in
                    `}
                  >
                    {/* Stone Highlight (Reflection) */}
                    <div 
                      className={`absolute top-[12%] left-[12%] w-[25%] h-[25%] rounded-full bg-gradient-to-br from-white to-transparent
                      ${cell === Player.BLACK ? 'opacity-20' : 'opacity-80'} blur-[1px]`} 
                    />
                    
                    {/* Last Move Marker */}
                    {isLastMove && (
                      <div className={`
                        absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
                        w-[35%] h-[35%] rounded-full border-[3px]
                        ${cell === Player.BLACK ? 'border-white/70' : 'border-black/60'}
                      `} />
                    )}
                  </div>
                )}
              </div>
            );
          })
        ))}
      </div>
    </div>
  );
};