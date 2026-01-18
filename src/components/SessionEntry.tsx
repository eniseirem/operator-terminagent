import { useState } from 'react';
import { Plus, ArrowRight } from 'lucide-react';
import { createSession, findSessionByCode, joinSession } from '../lib/sessions';

interface SessionEntryProps {
  onJoinSession: (sessionId: string, joinCode: string) => void;
  onCreateSession: (sessionId: string, joinCode: string) => void;
}

export default function SessionEntry({ onJoinSession, onCreateSession }: SessionEntryProps) {
  const [joinCode, setJoinCode] = useState('');
  const [playerName, setPlayerName] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('operator-terminagent-player-name') || '';
    }
    return '';
  });
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState('');

  const handleCreate = async () => {
    setCreating(true);
    setError('');
    try {
      // Save player name
      if (playerName.trim() && typeof window !== 'undefined') {
        localStorage.setItem('operator-terminagent-player-name', playerName.trim());
      }
      const { sessionId, joinCode: code } = await createSession();
      await joinSession(sessionId, playerName.trim() || undefined);
      onCreateSession(sessionId, code);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create session');
    } finally {
      setCreating(false);
    }
  };

  const handleJoin = async () => {
    const code = joinCode.trim().toUpperCase();
    if (!code || code.length < 4) {
      setError('Please enter a valid join code');
      return;
    }

    setJoining(true);
    setError('');
    try {
      // Save player name
      if (playerName.trim() && typeof window !== 'undefined') {
        localStorage.setItem('operator-terminagent-player-name', playerName.trim());
      }
      const sessionId = await findSessionByCode(code);
      if (!sessionId) {
        setError('Session not found. Please check the join code.');
        return;
      }
      await joinSession(sessionId, playerName.trim() || undefined);
      // Pass both sessionId and joinCode
      onJoinSession(sessionId, code);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join session');
    } finally {
      setJoining(false);
    }
  };

  return (
    <div className="bg-slate-800 p-8 rounded-lg max-w-md mx-auto space-y-6">
      <div className="text-center">
        <h2 className="text-3xl font-bold mb-2">Session Configurator</h2>
        <p className="text-slate-400">Create or join a class session to vote on game specs</p>
      </div>

      {error && (
        <div className="bg-red-900/50 border border-red-700 text-red-200 p-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Player Name Input */}
      <div className="space-y-2">
        <label className="block text-sm font-medium">Your Name (optional)</label>
        <input
          type="text"
          value={playerName}
          onChange={(e) => setPlayerName(e.target.value)}
          placeholder="Enter your name"
          maxLength={50}
          className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Create Session */}
      <div className="space-y-4">
        <h3 className="font-semibold text-lg">Create Session</h3>
        <button
          onClick={handleCreate}
          disabled={creating}
          className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 disabled:cursor-not-allowed rounded-lg font-semibold"
        >
          <Plus className="w-5 h-5" />
          {creating ? 'Creating...' : 'Create New Session'}
        </button>
      </div>

      <div className="border-t border-slate-700 pt-6">
        <div className="text-center text-slate-400 mb-4">OR</div>
      </div>

      {/* Join Session */}
      <div className="space-y-4">
        <h3 className="font-semibold text-lg">Join Session</h3>
        <div className="flex gap-2">
          <input
            type="text"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            placeholder="Enter join code"
            maxLength={8}
            className="flex-1 px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            onKeyPress={(e) => e.key === 'Enter' && handleJoin()}
          />
          <button
            onClick={handleJoin}
            disabled={joining || !joinCode.trim()}
            className="flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-slate-600 disabled:cursor-not-allowed rounded-lg font-semibold"
          >
            <ArrowRight className="w-5 h-5" />
            {joining ? 'Joining...' : 'Join'}
          </button>
        </div>
      </div>

      <div className="text-xs text-slate-500 text-center pt-4 border-t border-slate-700">
        Sessions allow multiple players to vote on game configuration specs.
        The host locks the config, then all players play with the same settings.
      </div>
    </div>
  );
}
