import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthService, ReplayService, RoomService, getGameService } from '../../services/api';
import { UserCreate, MatchInfo, GameConfig } from '../../types';
import { LogOut, Play, History, Trophy, Users, Plus, Trash2 } from 'lucide-react'; // Added Trash2
import { GameSetup } from '../GameSetup';

const LobbyPage: React.FC = () => {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState<UserCreate | null>(null);
  const [replays, setReplays] = useState<MatchInfo[]>([]);
  const [rooms, setRooms] = useState<MatchInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showSetup, setShowSetup] = useState(false);
  const [setupMode, setSetupMode] = useState<'online' | 'practice'>('practice');

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const user = await AuthService.fetchCurrentUser();
        if (!user) {
          navigate('/login');
          return;
        }
        setCurrentUser(user);
        
        const [fetchedReplays, fetchedRooms] = await Promise.all([
            ReplayService.fetchMyReplays(),
            RoomService.fetchRooms()
        ]);
        
        setReplays(fetchedReplays.matches);
        setRooms(fetchedRooms.matches);
      } catch (err: any) {
        setError(err.message || "Failed to fetch data.");
        AuthService.removeToken();
        navigate('/login');
      } finally {
        setLoading(false);
      }
    };

    // Initial fetch
    fetchUserData();

    // Set up interval for refreshing rooms
    const roomRefreshInterval = setInterval(async () => {
        try {
            const fetchedRooms = await RoomService.fetchRooms();
            setRooms(fetchedRooms.matches);
        } catch (err) {
            console.error("Failed to refresh rooms:", err);
        }
    }, 5000); // Refresh every 5 seconds

    // Cleanup interval on component unmount
    return () => clearInterval(roomRefreshInterval);
  }, [navigate]);

  const handleLogout = () => {
    AuthService.removeToken();
    navigate('/login');
  };

  const handleCreateRoom = async (config: GameConfig) => {
      try {
          const room = await RoomService.createRoom(config);
          navigate(`/game/${room.id}`);
      } catch (e: any) {
          setError("Failed to create room: " + e.message);
      }
  };

  const handlePracticeGame = async (config: GameConfig) => {
      try {
          const newState = await getGameService().startGame(config);
          navigate('/game', { state: { initialState: newState, initialConfig: config } });
      } catch (e: any) {
          setError("Failed to start practice game: " + e.message);
      }
  };

  const handleJoinRoom = async (roomId: number) => {
      try {
          const room = await RoomService.joinRoom(roomId);
          navigate(`/game/${room.id}`);
      } catch (e: any) {
          setError("Failed to join room: " + e.message);
      }
  };

  const handleDeleteReplay = async (e: React.MouseEvent, matchId: number) => {
      e.stopPropagation(); // Prevent navigation
      if (!window.confirm("Are you sure you want to delete this replay?")) return;
      
      try {
          await ReplayService.deleteReplay(matchId);
          // Refresh list locally
          setReplays(prev => prev.filter(r => r.id !== matchId));
      } catch (err: any) {
          setError("Failed to delete replay: " + e.message);
      }
  };

  if (loading) {
    return <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white text-3xl">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center p-4 md:p-8 font-sans text-white">
      {showSetup && (
        <GameSetup 
          onStartGame={setupMode === 'online' ? handleCreateRoom : handlePracticeGame}
          isFirstLoad={false} 
          onCancel={() => setShowSetup(false)} 
          mode={setupMode} // Pass the mode prop
        />
      )}

      <header className="w-full max-w-6xl flex justify-between items-center mb-8 pb-4 border-b border-slate-700">
        <h1 className="text-3xl md:text-4xl font-serif font-bold text-slate-100 tracking-wide">
          Zenith <span className="text-teal-500">Lobby</span>
        </h1>
        <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-slate-300 bg-slate-800 px-4 py-2 rounded-full">
                <span className="font-bold">{currentUser?.username}</span>
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            </div>
            <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2 bg-red-800/30 hover:bg-red-800/50 text-red-300 rounded-lg transition-colors text-sm"
            >
            <LogOut className="w-4 h-4" /> Logout
            </button>
        </div>
      </header>

      {error && (
        <div className="w-full max-w-6xl bg-red-900/50 border border-red-800 text-red-200 p-3 rounded-lg mb-4">
            {error}
        </div>
      )}

      <main className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Actions & Rooms (8 cols) */}
        <div className="lg:col-span-8 space-y-8">
            
            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-4">
                <button
                    onClick={() => { setSetupMode('online'); setShowSetup(true); }}
                    className="flex flex-col items-center justify-center gap-2 p-6 bg-gradient-to-br from-teal-600 to-teal-800 hover:from-teal-500 hover:to-teal-700 rounded-2xl shadow-lg transition-all border border-teal-500/30 group"
                >
                    <Users className="w-10 h-10 text-white group-hover:scale-110 transition-transform" />
                    <span className="text-xl font-bold">Create Online Room</span>
                    <span className="text-xs text-teal-200">Play against real people</span>
                </button>
                <button
                    onClick={() => { setSetupMode('practice'); setShowSetup(true); }}
                    className="flex flex-col items-center justify-center gap-2 p-6 bg-slate-800 hover:bg-slate-700 rounded-2xl shadow-lg transition-all border border-slate-700 group"
                >
                    <Play className="w-10 h-10 text-teal-400 group-hover:scale-110 transition-transform" />
                    <span className="text-xl font-bold">Practice / AI</span>
                    <span className="text-xs text-slate-400">Solo play or vs Computer</span>
                </button>
            </div>

            {/* Room List */}
            <div className="bg-slate-800 rounded-xl p-6 shadow-lg border border-slate-700 min-h-[400px]">
                <h2 className="text-xl font-serif font-bold mb-6 flex items-center gap-2 pb-4 border-b border-slate-700">
                    <Users className="w-6 h-6 text-teal-400" /> Live Rooms ({rooms.length})
                </h2>
                {rooms.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 text-slate-500">
                        <Users className="w-12 h-12 mb-2 opacity-20" />
                        <p>No open rooms available.</p>
                        <p className="text-sm">Create one to start playing!</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {rooms.map((room) => (
                            <div key={room.id} className="bg-slate-700/50 p-4 rounded-xl border border-slate-600 flex justify-between items-center hover:border-teal-500/50 transition-colors">
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="font-bold text-lg text-white">{room.gameType}</span>
                                        <span className="text-xs px-2 py-0.5 bg-slate-600 rounded-full text-slate-300">#{room.id}</span>
                                    </div>
                                    <p className="text-sm text-slate-400">Host: <span className="text-teal-400">{room.playerBlackName}</span></p>
                                    <p className="text-xs text-slate-500 mt-1">Created: {new Date(room.startTime).toLocaleTimeString()}</p>
                                </div>
                                <button
                                    onClick={() => handleJoinRoom(room.id)}
                                    className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white text-sm font-bold rounded-lg shadow-md transition-all"
                                >
                                    Join
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>

        {/* Right Column: Replays & Stats (4 cols) */}
        <div className="lg:col-span-4 space-y-8">
             {/* Stats */}
             <div className="bg-slate-800 rounded-xl p-6 shadow-lg border border-slate-700">
                <h2 className="text-lg font-serif font-bold mb-4 text-slate-200">My Stats</h2>
                <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-900/50 p-3 rounded-lg">
                        <div className="text-xs text-slate-400 mb-1">Games</div>
                        <div className="text-2xl font-mono font-bold text-white">{currentUser?.total_games || 0}</div>
                    </div>
                    <div className="bg-slate-900/50 p-3 rounded-lg">
                        <div className="text-xs text-slate-400 mb-1">Wins</div>
                        <div className="text-2xl font-mono font-bold text-teal-400">{currentUser?.wins || 0}</div>
                    </div>
                </div>
            </div>

            {/* Replays */}
            <div className="bg-slate-800 rounded-xl p-6 shadow-lg border border-slate-700 flex-1">
                <h2 className="text-lg font-serif font-bold mb-4 flex items-center gap-2 text-slate-200">
                    <History className="w-5 h-5 text-blue-400" /> Recent Replays
                </h2>
                <ul className="space-y-2 max-h-[500px] overflow-y-auto pr-2">
                {replays.map((replay) => (
                    <li 
                    key={replay.id} 
                    className="bg-slate-700/30 hover:bg-slate-700 p-3 rounded-lg cursor-pointer transition-colors border border-transparent hover:border-slate-600 group"
                    onClick={() => navigate(`/replay/${replay.id}`)}
                    >
                        <div className="flex justify-between items-start">
                            <span className="font-semibold text-sm text-slate-200">{replay.gameType}</span>
                            <div className="flex items-center gap-2">
                                <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${replay.result?.includes('WIN') ? 'bg-teal-900/50 text-teal-400' : 'bg-slate-600 text-slate-400'}`}>
                                    {replay.result || 'Live'}
                                </span>
                                <button 
                                    onClick={(e) => handleDeleteReplay(e, replay.id)}
                                    className="text-slate-500 hover:text-red-400 p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                                    title="Delete Replay"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                        <div className="text-xs text-slate-400 mt-1">
                            {replay.playerBlackName} vs {replay.playerWhiteName}
                        </div>
                    </li>
                ))}
                {replays.length === 0 && <p className="text-sm text-slate-500 italic">No replays yet.</p>}
                </ul>
            </div>
        </div>
      </main>
    </div>
  );
};

export default LobbyPage;
