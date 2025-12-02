import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthService, ReplayService } from '../../services/api';
import { UserCreate, MatchInfo } from '../../types';
import { LogOut, Play, History, Trophy } from 'lucide-react';

const LobbyPage: React.FC = () => {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState<UserCreate | null>(null);
  const [replays, setReplays] = useState<MatchInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const user = await AuthService.fetchCurrentUser();
        if (!user) {
          navigate('/login');
          return;
        }
        setCurrentUser(user);
        const fetchedReplays = await ReplayService.fetchMyReplays();
        setReplays(fetchedReplays.matches);
      } catch (err: any) {
        setError(err.message || "Failed to fetch data.");
        AuthService.removeToken(); // Clear token if unauthorized or error
        navigate('/login');
      } finally {
        setLoading(false);
      }
    };
    fetchUserData();
  }, [navigate]);

  const handleLogout = () => {
    AuthService.removeToken();
    navigate('/login');
  };

  if (loading) {
    return <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white text-3xl">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center p-4 md:p-8 font-sans text-white">
      <header className="w-full max-w-5xl flex justify-between items-center mb-8 pb-4 border-b border-slate-700">
        <h1 className="text-3xl md:text-4xl font-serif font-bold text-slate-100 tracking-wide">
          Zenith <span className="text-teal-500">Lobby</span>
        </h1>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 px-4 py-2 bg-red-800/30 hover:bg-red-800/50 text-red-300 rounded-lg transition-colors text-sm"
        >
          <LogOut className="w-4 h-4" /> Logout
        </button>
      </header>

      {error && (
        <div className="w-full max-w-5xl bg-red-900/50 border border-red-800 text-red-200 p-3 rounded-lg mb-4">
            {error}
        </div>
      )}

      <main className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* User Info & Stats */}
        <div className="lg:col-span-1 bg-slate-800 rounded-xl p-6 shadow-lg border border-slate-700 space-y-4">
          <h2 className="text-xl font-serif font-bold mb-4">Welcome, {currentUser?.username}!</h2>
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-slate-300">
              <Trophy className="w-5 h-5 text-yellow-400" />
              <span>Total Games: {currentUser?.total_games || 0}</span>
            </div>
            <div className="flex items-center gap-2 text-slate-300">
              <Trophy className="w-5 h-5 text-green-400" />
              <span>Wins: {currentUser?.wins || 0}</span>
            </div>
            {/* Win rate can be calculated if needed */}
          </div>
          <button
            onClick={() => navigate('/game')}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-teal-600 hover:bg-teal-500 text-white rounded-xl font-bold shadow-lg shadow-teal-900/20 transition-all mt-6"
          >
            <Play className="w-5 h-5" /> Start New Game
          </button>
        </div>

        {/* Replay List */}
        <div className="lg:col-span-2 bg-slate-800 rounded-xl p-6 shadow-lg border border-slate-700">
          <h2 className="text-xl font-serif font-bold mb-4 flex items-center gap-2">
            <History className="w-6 h-6 text-blue-400" /> Your Replays
          </h2>
          {replays.length === 0 ? (
            <p className="text-slate-400">No replays found. Start a game to record one!</p>
          ) : (
            <ul className="space-y-3">
              {replays.map((replay) => (
                <li 
                  key={replay.id} 
                  className="bg-slate-700/50 hover:bg-slate-700 p-4 rounded-lg flex items-center justify-between cursor-pointer transition-colors"
                  onClick={() => navigate(`/replay/${replay.id}`)}
                >
                  <div>
                    <p className="font-semibold text-lg">{replay.gameType} Match #{replay.id}</p>
                    <p className="text-sm text-slate-400">
                      {replay.playerBlackName} (Black) vs {replay.playerWhiteName} (White)
                    </p>
                    <p className="text-xs text-slate-500">
                      Result: <span className="font-medium">{replay.result || 'Ongoing'}</span>
                    </p>
                    <p className="text-xs text-slate-500">
                      Date: {new Date(replay.startTime).toLocaleDateString()}
                    </p>
                  </div>
                  <Play className="w-5 h-5 text-teal-400" />
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </div>
  );
};

export default LobbyPage;
