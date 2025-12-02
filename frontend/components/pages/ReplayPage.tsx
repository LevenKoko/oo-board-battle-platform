import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ReplayService } from '../../services/api';
import { MatchInfo, GameState, Player, GameType, BoardGrid } from '../../types';
import { Board } from '../Board';
import { Play, Pause, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, FastForward, Rewind, Home } from 'lucide-react';

// Minimal GameState to initialize for replay playback
const INITIAL_REPLAY_GAME_STATE: GameState = {
    gameId: 'replay',
    grid: [],
    currentPlayer: Player.BLACK, // Will be updated by moves
    history: [],
    prisoners: { [Player.BLACK]: 0, [Player.WHITE]: 0 },
    isGameOver: false,
    winner: null,
    message: "Replay started.",
    lastMove: null,
    gameType: GameType.GOMOKU, // Placeholder, will be set by replay data
    boardSize: 15, // Placeholder, will be set by replay data
    validMoves: [],
};

const ReplayPage: React.FC = () => {
    const { replayId } = useParams<{ replayId: string }>();
    const navigate = useNavigate();
    const [matchInfo, setMatchInfo] = useState<MatchInfo | null>(null);
    const [currentMoveIndex, setCurrentMoveIndex] = useState(0);
    const [playbackGameState, setPlaybackGameState] = useState<GameState>(INITIAL_REPLAY_GAME_STATE);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [playbackSpeed, setPlaybackSpeed] = useState(1000); // ms per move
    const intervalRef = useRef<number | null>(null);

    useEffect(() => {
        const fetchReplay = async () => {
            if (!replayId) {
                setError("No replay ID provided.");
                setLoading(false);
                return;
            }
            try {
                const data = await ReplayService.fetchReplayById(Number(replayId));
                setMatchInfo(data);
                
                // Handle new movesJson structure (dict with history) vs old (array)
                let moves: any[] = [];
                if (Array.isArray(data.movesJson)) {
                    moves = data.movesJson;
                } else if (data.movesJson && Array.isArray(data.movesJson.history)) {
                    moves = data.movesJson.history;
                }

                // Initialize playback game state with first board state
                if (moves.length > 0) {
                    const initialBoardState = moves[0];
                    setPlaybackGameState({
                        ...INITIAL_REPLAY_GAME_STATE,
                        grid: initialBoardState.grid,
                        gameType: data.gameType,
                        boardSize: initialBoardState.grid.length,
                    });
                }
            } catch (err: any) {
                setError(err.message || "Failed to load replay.");
            } finally {
                setLoading(false);
            }
        };
        fetchReplay();
    }, [replayId]);

    // Update playback game state when currentMoveIndex changes
    useEffect(() => {
        if (!matchInfo || !matchInfo.movesJson) return;

        // Determine moves array
        let moves: any[] = [];
        if (Array.isArray(matchInfo.movesJson)) {
            moves = matchInfo.movesJson;
        } else if (matchInfo.movesJson && Array.isArray((matchInfo.movesJson as any).history)) {
            moves = (matchInfo.movesJson as any).history;
        }

        if (moves.length === 0) return;

        // Ensure index is within bounds
        const actualIndex = Math.min(Math.max(0, currentMoveIndex), moves.length - 1);
        const currentBoardState = moves[actualIndex];
        const prevBoardState = actualIndex > 0 ? moves[actualIndex - 1] : null;

        // Determine last move by comparing current and previous grid
        let lastMove = null;
        if (prevBoardState) {
            for (let y = 0; y < currentBoardState.grid.length; y++) {
                for (let x = 0; x < currentBoardState.grid.length; x++) {
                    if (currentBoardState.grid[y][x] !== prevBoardState.grid[y][x]) {
                        lastMove = { x, y };
                        break;
                    }
                }
                if (lastMove) break;
            }
        }
        
        // Determine current player for display purposes (just for hint color)
        // This is a simplification; in a full replay, we'd store player for each move
        let currentPlayer = Player.BLACK; 
        if (actualIndex % 2 !== 0 && matchInfo.gameType !== GameType.REVERSI) { // Simple turn alternation
            currentPlayer = Player.WHITE;
        } else if (actualIndex > 0 && matchInfo.gameType === GameType.REVERSI) {
            // For Reversi, current player alternates more complexly due to passes
            // We'll just assume black starts and alternates, and adjust if a full player history is needed
            currentPlayer = currentBoardState.currentPlayer || (actualIndex % 2 === 0 ? Player.BLACK : Player.WHITE);
        }

        setPlaybackGameState(prev => ({
            ...prev,
            grid: currentBoardState.grid,
            lastMove: lastMove,
            currentPlayer: currentPlayer, // This might not be perfectly accurate for complex games like Go/Reversi with passes
            message: `Move ${actualIndex + 1}/${moves.length}`,
            gameType: matchInfo.gameType,
            boardSize: currentBoardState.grid.length,
            isGameOver: actualIndex === moves.length - 1,
            // Replay doesn't need validMoves
            validMoves: [],
        }));
    }, [currentMoveIndex, matchInfo]);

    // Playback control useEffect
    useEffect(() => {
        // Determine moves array length for dependency
        let movesLength = 0;
        if (matchInfo && matchInfo.movesJson) {
             if (Array.isArray(matchInfo.movesJson)) movesLength = matchInfo.movesJson.length;
             else if (Array.isArray((matchInfo.movesJson as any).history)) movesLength = (matchInfo.movesJson as any).history.length;
        }

        if (isPlaying && matchInfo && currentMoveIndex < movesLength - 1) {
            intervalRef.current = window.setInterval(() => {
                setCurrentMoveIndex((prevIndex) => prevIndex + 1);
            }, playbackSpeed);
        } else {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
            setIsPlaying(false);
        }

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, [isPlaying, currentMoveIndex, matchInfo, playbackSpeed]);


    const handlePlayPause = () => {
        setIsPlaying(!isPlaying);
    };

    // Helper to get moves length
    const getMovesLength = () => {
        if (!matchInfo || !matchInfo.movesJson) return 0;
        if (Array.isArray(matchInfo.movesJson)) return matchInfo.movesJson.length;
        if (Array.isArray((matchInfo.movesJson as any).history)) return (matchInfo.movesJson as any).history.length;
        return 0;
    };
    const totalMoves = getMovesLength();

    const handleNextMove = () => {
        if (matchInfo && currentMoveIndex < totalMoves - 1) {
            setCurrentMoveIndex(prev => prev + 1);
        }
    };

    const handlePrevMove = () => {
        if (currentMoveIndex > 0) {
            setCurrentMoveIndex(prev => prev - 1);
        }
    };

    const handleFirstMove = () => {
        setCurrentMoveIndex(0);
    };

    const handleLastMove = () => {
        if (matchInfo) {
            setCurrentMoveIndex(totalMoves - 1);
        }
    };

    const handleSpeedChange = (speed: number) => {
        setPlaybackSpeed(speed);
        if (isPlaying) {
            setIsPlaying(false);
            setTimeout(() => setIsPlaying(true), 10); // Restart playback with new speed
        }
    };

    if (loading) {
        return <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white text-3xl">Loading replay...</div>;
    }

    if (error) {
        return <div className="min-h-screen bg-slate-900 flex items-center justify-center text-red-400 text-3xl">{error}</div>;
    }

    if (!matchInfo) {
        return <div className="min-h-screen bg-slate-900 flex items-center justify-center text-slate-400 text-3xl">Replay not found.</div>;
    }

    const isFirst = currentMoveIndex === 0;
    const isLast = currentMoveIndex === totalMoves - 1;

    return (
        <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 md:p-8 font-sans text-white">
            <header className="w-full max-w-5xl flex justify-between items-end mb-6 border-b border-slate-700 pb-4">
                <div>
                    <h1 className="text-3xl md:text-4xl font-serif font-bold text-slate-100 tracking-wide">
                        Replay <span className="text-teal-500">#{matchInfo.id}</span>
                    </h1>
                    <p className="text-slate-400 text-sm mt-1">
                        {matchInfo.gameType} Match: <span className="font-semibold text-slate-200">{matchInfo.playerBlackName}</span> vs <span className="font-semibold text-slate-200">{matchInfo.playerWhiteName}</span>
                    </p>
                    <p className="text-slate-400 text-xs">
                        Result: <span className="font-medium">{matchInfo.result || 'Ongoing'}</span> | Date: {matchInfo.startTime ? new Date(matchInfo.startTime).toLocaleDateString() : 'N/A'}
                    </p>
                </div>
                <button
                    onClick={() => navigate('/lobby')}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg transition-colors text-sm"
                >
                    <Home className="w-4 h-4" /> Back to Lobby
                </button>
            </header>

            <main className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-12 gap-8">
                <div className="lg:col-span-8 flex justify-center items-start">
                    <div className="w-full max-w-[600px] lg:max-w-full">
                        <Board
                            grid={playbackGameState.grid}
                            lastMove={playbackGameState.lastMove}
                            onCellClick={() => {}} // No interaction in replay
                            readOnly={true}
                            validMoves={playbackGameState.validMoves}
                            currentPlayer={playbackGameState.currentPlayer}
                        />
                    </div>
                </div>

                <div className="lg:col-span-4 space-y-6">
                    <div className="bg-slate-800 rounded-xl p-6 shadow-lg border border-slate-700">
                        <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-4">Playback Controls</h3>
                        <div className="flex items-center justify-center space-x-2 mb-4">
                            <button onClick={handleFirstMove} disabled={isFirst} className="p-2 rounded-lg hover:bg-slate-700 disabled:opacity-50"><ChevronsLeft className="w-6 h-6" /></button>
                            <button onClick={handlePrevMove} disabled={isFirst} className="p-2 rounded-lg hover:bg-slate-700 disabled:opacity-50"><ChevronLeft className="w-6 h-6" /></button>
                            <button onClick={handlePlayPause} className="p-2 rounded-full bg-teal-600 hover:bg-teal-500"><span className="sr-only">{isPlaying ? 'Pause' : 'Play'}</span>{isPlaying ? <Pause className="w-8 h-8" /> : <Play className="w-8 h-8" />}</button>
                            <button onClick={handleNextMove} disabled={isLast} className="p-2 rounded-lg hover:bg-slate-700 disabled:opacity-50"><ChevronRight className="w-6 h-6" /></button>
                            <button onClick={handleLastMove} disabled={isLast} className="p-2 rounded-lg hover:bg-slate-700 disabled:opacity-50"><ChevronsRight className="w-6 h-6" /></button>
                        </div>
                        <div className="text-center text-slate-300 font-mono text-xl mb-4">
                            {currentMoveIndex + 1} / {totalMoves}
                        </div>
                        <input
                            type="range"
                            min={0}
                            max={totalMoves > 0 ? totalMoves - 1 : 0}
                            value={currentMoveIndex}
                            onChange={(e) => setCurrentMoveIndex(Number(e.target.value))}
                            className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-teal-500"
                        />

                        <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider mt-6 mb-3">Speed</h3>
                        <div className="flex justify-around">
                            <button onClick={() => handleSpeedChange(2000)} className={`px-3 py-1 rounded-md text-sm ${playbackSpeed === 2000 ? 'bg-teal-600' : 'bg-slate-700 hover:bg-slate-600'}`}>0.5x</button>
                            <button onClick={() => handleSpeedChange(1000)} className={`px-3 py-1 rounded-md text-sm ${playbackSpeed === 1000 ? 'bg-teal-600' : 'bg-slate-700 hover:bg-slate-600'}`}>1x</button>
                            <button onClick={() => handleSpeedChange(500)} className={`px-3 py-1 rounded-md text-sm ${playbackSpeed === 500 ? 'bg-teal-600' : 'bg-slate-700 hover:bg-slate-600'}`}>2x</button>
                            <button onClick={() => handleSpeedChange(250)} className={`px-3 py-1 rounded-md text-sm ${playbackSpeed === 250 ? 'bg-teal-600' : 'bg-slate-700 hover:bg-slate-600'}`}>4x</button>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default ReplayPage;
