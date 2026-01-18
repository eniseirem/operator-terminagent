import { useState } from 'react';
import { Trophy, BarChart3, Play, Users } from 'lucide-react';
import Game from './Game';
import Leaderboard from './components/Leaderboard';
import Stats from './components/Stats';
import SessionEntry from './components/SessionEntry';
import SessionLobby from './components/SessionLobby';
import { FinalConfig } from './lib/aggregation';

type View = 'game' | 'leaderboard' | 'stats' | 'session-entry' | 'session-lobby';

export default function App() {
  const [view, setView] = useState<View>('game');
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [currentJoinCode, setCurrentJoinCode] = useState<string | null>(null);
  const [sessionConfig, setSessionConfig] = useState<FinalConfig | null>(null);

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {/* Navigation */}
      <nav className="bg-slate-800 border-b border-slate-700 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold">Operator — Terminate & Trap</h1>
            <div className="flex gap-2">
              <button
                onClick={() => setView('session-entry')}
                className={`px-4 py-2 rounded-lg transition flex items-center gap-2 ${
                  view === 'session-entry' || view === 'session-lobby'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                <Users className="w-4 h-4" />
                Session
              </button>
              <button
                onClick={() => setView('game')}
                className={`px-4 py-2 rounded-lg transition flex items-center gap-2 ${
                  view === 'game'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                <Play className="w-4 h-4" />
                Play
              </button>
              <button
                onClick={() => setView('leaderboard')}
                className={`px-4 py-2 rounded-lg transition flex items-center gap-2 ${
                  view === 'leaderboard'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                <Trophy className="w-4 h-4" />
                Leaderboard
              </button>
              <button
                onClick={() => setView('stats')}
                className={`px-4 py-2 rounded-lg transition flex items-center gap-2 ${
                  view === 'stats'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                <BarChart3 className="w-4 h-4" />
                Stats
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Content */}
      <main className="max-w-6xl mx-auto p-4 sm:p-8">
        {view === 'session-entry' && (
          <SessionEntry
            onJoinSession={(sessionId, joinCode) => {
              setCurrentSessionId(sessionId);
              setCurrentJoinCode(joinCode);
              setView('session-lobby');
            }}
            onCreateSession={(sessionId, joinCode) => {
              setCurrentSessionId(sessionId);
              setCurrentJoinCode(joinCode);
              setView('session-lobby');
            }}
          />
        )}
        {view === 'session-lobby' && currentSessionId && (
          <SessionLobby
            sessionId={currentSessionId}
            onStartGame={(_sessionId, finalConfig) => {
              setSessionConfig(finalConfig);
              setView('game');
            }}
            onBack={() => {
              setCurrentSessionId(null);
              setCurrentJoinCode(null);
              setView('session-entry');
            }}
          />
        )}
        {view === 'game' && (
          <Game
            sessionId={currentSessionId || undefined}
            joinCode={currentJoinCode || undefined}
            sessionConfig={sessionConfig || undefined}
            onSessionEnd={() => {
              // Clean up all session state when game ends
              setSessionConfig(null);
              setCurrentSessionId(null);
              setCurrentJoinCode(null);
            }}
          />
        )}
        {view === 'leaderboard' && (
          <Leaderboard sessionId={currentSessionId || undefined} joinCode={currentJoinCode || undefined} />
        )}
        {view === 'stats' && (
          <Stats sessionId={currentSessionId || undefined} joinCode={currentJoinCode || undefined} />
        )}
      </main>
    </div>
  );
}
