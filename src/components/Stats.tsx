import { useEffect, useState } from 'react';
import { BarChart3, Users } from 'lucide-react';
import { listenStatsLast24h, StatsLast24h } from '../lib/leaderboard';

export default function Stats() {
  const [stats, setStats] = useState<StatsLast24h>({
    totalRuns: 0,
    avgScore: 0, // Still calculated but not displayed
    endingCounts: {},
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = listenStatsLast24h((statsData) => {
      setStats(statsData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="bg-slate-800 p-6 rounded-lg">
        <p className="text-slate-400">Loading stats...</p>
      </div>
    );
  }

  const endingEntries = Object.entries(stats.endingCounts).sort(
    (a, b) => b[1] - a[1]
  );

  return (
    <div className="bg-slate-800 p-6 rounded-lg">
      <div className="flex items-center gap-3 mb-6">
        <BarChart3 className="w-6 h-6 text-blue-400" />
        <h2 className="text-2xl font-bold">Last 24 Hours Stats</h2>
      </div>

      <div className="mb-6">
        <div className="bg-slate-700/50 p-4 rounded-lg max-w-xs">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-5 h-5 text-slate-400" />
            <span className="text-sm text-slate-400">Total Runs</span>
          </div>
          <div className="text-3xl font-bold text-white">
            {stats.totalRuns}
          </div>
        </div>
      </div>

      {endingEntries.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-3">Ending Distribution</h3>
          <div className="space-y-2">
            {endingEntries.map(([ending, count]) => (
              <div key={ending} className="flex items-center justify-between">
                <span className="capitalize text-slate-300">{ending}</span>
                <div className="flex items-center gap-3">
                  <div className="w-32 bg-slate-700 rounded-full h-2">
                    <div
                      className="bg-blue-500 h-2 rounded-full"
                      style={{
                        width: `${(count / stats.totalRuns) * 100}%`,
                      }}
                    />
                  </div>
                  <span className="text-sm font-semibold w-8 text-right">
                    {count}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {stats.totalRuns === 0 && (
        <p className="text-slate-400">No runs in the last 24 hours.</p>
      )}
    </div>
  );
}
