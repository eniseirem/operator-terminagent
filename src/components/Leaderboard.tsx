import { useEffect, useState } from 'react';
import { Trophy, User, Skull, Heart } from 'lucide-react';
import { listenLeaderboard, AggregatedLeaderboardEntry } from '../lib/leaderboard';

interface LeaderboardProps {
  sessionId?: string;
  joinCode?: string;
}

export default function Leaderboard({ sessionId, joinCode }: LeaderboardProps = {}) {
  const [entries, setEntries] = useState<AggregatedLeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const unsubscribe = listenLeaderboard(
        (leaderboardEntries) => {
          setEntries(leaderboardEntries);
          setLoading(false);
          setError(null);
        },
        (err) => {
          if (import.meta.env.DEV) {
            console.error('Leaderboard error:', err);
          }
          setError(err.message || 'Failed to load leaderboard');
          setLoading(false);
        },
        sessionId || joinCode ? { sessionId, joinCode } : undefined
      );

      return () => unsubscribe();
    } catch (err) {
      if (import.meta.env.DEV) {
        console.error('Leaderboard setup error:', err);
      }
      setError(err instanceof Error ? err.message : 'Failed to setup leaderboard');
      setLoading(false);
    }
  }, [sessionId, joinCode]);

  if (loading) {
    return (
      <div className="bg-slate-800 p-6 rounded-lg">
        <p className="text-slate-400">Loading leaderboard...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-slate-800 p-6 rounded-lg">
        <div className="flex items-center gap-3 mb-4">
          <Trophy className="w-6 h-6 text-yellow-400" />
          <h2 className="text-2xl font-bold">Top 20 Leaderboard</h2>
        </div>
        <div className="bg-red-900/30 border border-red-500 rounded p-4">
          <p className="text-red-300 font-semibold mb-2">Error loading leaderboard</p>
          <p className="text-red-200 text-sm">{error}</p>
          <p className="text-red-200 text-xs mt-2">
            Check browser console for details. Make sure Firestore indexes are deployed.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-800 p-6 rounded-lg">
      <div className="flex items-center gap-3 mb-6">
        <Trophy className="w-6 h-6 text-yellow-400" />
        <h2 className="text-2xl font-bold">
          {sessionId || joinCode ? `Session Leaderboard${joinCode ? `: ${joinCode}` : ''}` : 'Top 20 Leaderboard'}
        </h2>
        {(sessionId || joinCode) && (
          <span className="text-sm text-slate-400">
            (Individual players)
          </span>
        )}
      </div>

      {entries.length === 0 ? (
        <p className="text-slate-400">No runs yet. Be the first!</p>
      ) : (
        <div className="space-y-2">
          {entries.map((entry, index) => (
            <div
              key={entry.playerName}
              className={`flex items-center justify-between p-4 rounded-lg ${
                index === 0
                  ? 'bg-yellow-900/30 border-2 border-yellow-500'
                  : index < 3
                  ? 'bg-slate-700'
                  : 'bg-slate-700/50'
              }`}
            >
              <div className="flex items-center gap-4">
                <span className="text-2xl font-bold w-8 text-slate-400">
                  #{index + 1}
                </span>
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-slate-400" />
                  <span className="font-semibold">
                    {entry.playerName}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-6">
                <div className="text-center">
                  <div className="flex items-center gap-1 text-green-400">
                    <Heart className="w-4 h-4" />
                    <span className="text-xl font-bold">{entry.survivalCount}</span>
                  </div>
                  <div className="text-xs text-slate-500">survived</div>
                </div>
                <div className="text-center">
                  <div className="flex items-center gap-1 text-red-400">
                    <Skull className="w-4 h-4" />
                    <span className="text-xl font-bold">{entry.deathCount}</span>
                  </div>
                  <div className="text-xs text-slate-500">died</div>
                </div>
                <div className="text-center border-l border-slate-600 pl-6">
                  <div className="text-xl font-bold text-slate-300">{entry.totalRuns}</div>
                  <div className="text-xs text-slate-500">total</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
