import React from 'react';
import { RoomSession } from '../types';
import { User, Check, X, RefreshCcw, ThumbsUp, ThumbsDown, LogOut } from 'lucide-react'; // Added LogOut

interface RoomLobbyProps {
  session: RoomSession;
  currentUserId?: number;
  onToggleReady: () => void;
  onRequestSwitch: () => void;
  onApproveSwitch: () => void;
  onRejectSwitch: () => void;
  onLeave: () => void; // Added onLeave
}

export const RoomLobby: React.FC<RoomLobbyProps> = ({ 
    session, 
    currentUserId, 
    onToggleReady, 
    onRequestSwitch,
    onApproveSwitch,
    onRejectSwitch,
    onLeave // Destructure
}) => {
  const isBlack = session.black_player_id === currentUserId;
  const isWhite = session.white_player_id === currentUserId;
  const isObserver = !isBlack && !isWhite;

  // Switch Request Logic
  const hasSwapRequest = !!session.swap_request_from;
  const isMyRequest = session.swap_request_from === currentUserId;
  const isTargetOfRequest = hasSwapRequest && !isMyRequest && (isBlack || isWhite);

  const PlayerSlot = ({ color, playerId, isReady }: { color: string, playerId: number | null, isReady: boolean }) => (
    <div className={`flex flex-col items-center p-6 rounded-xl border-2 transition-all ${
        playerId === currentUserId ? 'border-teal-500 bg-teal-900/20' : 'border-slate-600 bg-slate-800'
    }`}>
        <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-3 ${
            color === 'Black' ? 'bg-black text-white border border-slate-600' : 'bg-white text-black'
        }`}>
            <User className="w-6 h-6" />
        </div>
        <span className="font-bold text-lg text-white mb-1">{color}</span>
        <span className="text-sm text-slate-400 mb-4">
            {playerId ? `Player ID: ${playerId}` : "Waiting..."}
        </span>
        <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold ${
            isReady ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'
        }`}>
            {isReady ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
            {isReady ? "READY" : "NOT READY"}
        </div>
    </div>
  );

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/95 backdrop-blur-sm">
        <div className="bg-slate-800 p-8 rounded-2xl shadow-2xl border border-slate-700 w-full max-w-2xl text-center relative">
            {/* Close/Leave Button */}
            <button 
                onClick={onLeave}
                className="absolute top-4 right-4 p-2 text-slate-400 hover:text-red-400 hover:bg-slate-700/50 rounded-full transition-colors"
                title="Leave Room"
            >
                <LogOut className="w-6 h-6" />
            </button>

            <h2 className="text-3xl font-serif font-bold text-white mb-8">Game Lobby</h2>
            
            <div className="grid grid-cols-2 gap-8 mb-8">
                <PlayerSlot color="Black" playerId={session.black_player_id} isReady={session.black_ready} />
                <PlayerSlot color="White" playerId={session.white_player_id} isReady={session.white_ready} />
            </div>

            {/* Action Area */}
            <div className="flex flex-col items-center gap-4">
                
                {/* Main Actions */}
                {!isObserver && !hasSwapRequest && (
                    <div className="flex gap-4">
                        <button 
                            onClick={onToggleReady}
                            className={`px-8 py-3 rounded-xl font-bold text-white shadow-lg transition-all ${
                                (isBlack && session.black_ready) || (isWhite && session.white_ready)
                                ? 'bg-red-600 hover:bg-red-500'
                                : 'bg-green-600 hover:bg-green-500'
                            }`}
                        >
                            {(isBlack && session.black_ready) || (isWhite && session.white_ready) ? "Cancel Ready" : "Ready!"}
                        </button>
                        <button 
                            onClick={onRequestSwitch}
                            className="px-6 py-3 rounded-xl font-bold text-slate-300 bg-slate-700 hover:bg-slate-600 shadow-lg transition-all flex items-center gap-2"
                        >
                            <RefreshCcw className="w-4 h-4" /> Request Swap
                        </button>
                    </div>
                )}

                {/* Swap Request UI */}
                {hasSwapRequest && (
                    <div className="bg-slate-700/50 p-4 rounded-xl border border-slate-600 w-full animate-pulse-slow">
                        {isMyRequest ? (
                            <div className="flex items-center justify-center gap-3 text-yellow-400">
                                <RefreshCcw className="w-5 h-5 animate-spin" />
                                <span className="font-bold">Waiting for opponent to accept swap...</span>
                            </div>
                        ) : isTargetOfRequest ? (
                            <div className="flex flex-col items-center gap-3">
                                <span className="text-white font-bold">Opponent requests to swap sides!</span>
                                <div className="flex gap-3">
                                    <button 
                                        onClick={onApproveSwitch}
                                        className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg flex items-center gap-2 font-bold"
                                    >
                                        <ThumbsUp className="w-4 h-4" /> Accept
                                    </button>
                                    <button 
                                        onClick={onRejectSwitch}
                                        className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg flex items-center gap-2 font-bold"
                                    >
                                        <ThumbsDown className="w-4 h-4" /> Reject
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <span className="text-slate-400">Swap request in progress...</span>
                        )}
                    </div>
                )}

                {isObserver && (
                    <p className="text-slate-400 mt-4">You are observing this room.</p>
                )}
            </div>
        </div>
    </div>
  );
};