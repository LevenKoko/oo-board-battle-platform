import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import GamePage from './components/pages/GamePage';
import LoginPage from './components/pages/LoginPage';
import LobbyPage from './components/pages/LobbyPage';
import ReplayPage from './components/pages/ReplayPage';
import { AuthService } from './services/api'; // Import AuthService

// ProtectedRoute component to guard routes
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  if (!AuthService.isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
};

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<LoginPage />} />
        {/* Protected routes */}
        <Route path="/lobby" element={<ProtectedRoute><LobbyPage /></ProtectedRoute>} />
        <Route path="/game" element={<ProtectedRoute><GamePage /></ProtectedRoute>} />
        <Route path="/game/:gameId" element={<ProtectedRoute><GamePage /></ProtectedRoute>} />
        <Route path="/replay/:replayId" element={<ProtectedRoute><ReplayPage /></ProtectedRoute>} />
        <Route path="*" element={
          <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white text-3xl">
            404 - Page Not Found
          </div>
        } />
      </Routes>
    </BrowserRouter>
  );
};

export default App;