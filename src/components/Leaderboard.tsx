import { useEffect, useState } from 'react';
import { Trophy, Clock, User, Skull } from 'lucide-react';
import { listenLeaderboard, LeaderboardEntry } from '../lib/leaderboard';

export default function Leaderboard() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = listenLeaderboard((leaderboardEntries) => {
      setEntries(leaderboardEntries);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="bg-slate-800 p-6 rounded-lg">
        <p className="text-slate-400">Loading leaderboard...</p>
      </div>
    );
  }

  return (
    <div className="bg-slate-800 p-6 rounded-lg">
      <div className="flex items-center gap-3 mb-6">
        <Trophy className="w-6 h-6 text-yellow-400" />
        <h2 className="text-2xl font-bold">Top 20 Leaderboard</h2>
      </div>

      {entries.length === 0 ? (
        <p className="text-slate-400">No runs yet. Be the first!</p>
      ) : (
        <div className="space-y-2">
          {entries.map((entry, index) => (
            <div
              key={entry.id}
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
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <User className="w-4 h-4 text-slate-400" />
                    <span className="font-semibold">
                      {entry.playerName || 'Anonymous'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-400 flex-wrap">
                    <Clock className="w-3 h-3" />
                    <span>
                      {Math.floor(entry.durationMs / 1000)}s
                    </span>
                    <span className="mx-2">•</span>
                    <span className="capitalize">{entry.ending.replace(/_/g, ' ')}</span>
                    {entry.deathCount !== undefined && entry.deathCount > 0 && (
                      <>
                        <span className="mx-2">•</span>
                        <div className="flex items-center gap-1 text-red-400">
                          <Skull className="w-3 h-3" />
                          <span>{entry.deathCount} death{entry.deathCount !== 1 ? 's' : ''}</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-blue-400">
                  {entry.score.toLocaleString()}
                </div>
                <div className="text-xs text-slate-500">score</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
