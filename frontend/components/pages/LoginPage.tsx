import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthService } from '../../services/api';
import { UserCreate } from '../../types';
import { User, Lock, LogIn, UserPlus } from 'lucide-react';

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState(''); // New state for confirm password
  const [isRegister, setIsRegister] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isRegister) {
        if (password !== confirmPassword) {
          setError('Passwords do not match.');
          return;
        }
        await AuthService.register({ username, password });
        alert('Registration successful! Please log in.');
        setIsRegister(false); // Switch to login after registration
        setConfirmPassword(''); // Clear confirm password field
      } else {
        await AuthService.login({ username, password });
        navigate('/lobby'); // Redirect to lobby on successful login
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 font-sans">
      <div className="bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="bg-slate-900 p-6 border-b border-slate-700 flex items-center gap-3">
          {isRegister ? <UserPlus className="w-6 h-6 text-teal-400" /> : <LogIn className="w-6 h-6 text-teal-400" />}
          <h2 className="text-xl font-serif font-bold text-white">{isRegister ? 'Register' : 'Login'}</h2>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="bg-red-900/50 border border-red-800 text-red-200 p-3 rounded-lg">
              {error}
            </div>
          )}

          {/* Username */}
          <div className="space-y-2">
            <label htmlFor="username" className="block text-sm font-medium text-slate-400">Username</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
              <input
                type="text"
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="w-full pl-10 pr-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
                placeholder="Enter your username"
                disabled={loading}
              />
            </div>
          </div>

          {/* Password */}
          <div className="space-y-2">
            <label htmlFor="password" className="block text-sm font-medium text-slate-400">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full pl-10 pr-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
                placeholder="Enter your password"
                disabled={loading}
              />
            </div>
          </div>
          
          {isRegister && (
            <div className="space-y-2">
              <label htmlFor="confirm-password" className="block text-sm font-medium text-slate-400">Confirm Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                <input
                  type="password"
                  id="confirm-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="w-full pl-10 pr-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
                  placeholder="Confirm your password"
                  disabled={loading}
                />
              </div>
            </div>
          )}

          <div className="pt-2">
            <button
              type="submit"
              className="w-full bg-teal-600 hover:bg-teal-500 text-white px-4 py-3 rounded-xl font-bold shadow-lg shadow-teal-900/20 transition-all flex items-center justify-center gap-2"
              disabled={loading}
            >
              {loading ? (
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : (
                <>
                  {isRegister ? <UserPlus className="w-5 h-5" /> : <LogIn className="w-5 h-5" />}
                  {isRegister ? 'Register' : 'Login'}
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => {
                setIsRegister(!isRegister);
                setError(null); // Clear errors when switching mode
                setPassword(''); // Clear passwords when switching mode
                setConfirmPassword('');
              }}
              className="w-full mt-4 text-slate-400 hover:text-teal-400 transition-colors text-sm"
              disabled={loading}
            >
              {isRegister ? 'Already have an account? Login' : "Don't have an account? Register"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;