import { useEffect, useState } from 'react';
import { BarChart3, Users, Heart, Skull } from 'lucide-react';
import { listenStatsLast24h, StatsLast24h } from '../lib/leaderboard';

function isDeathEnding(ending: string): boolean {
  const deathEndings = [
    'no_action_taken',
    'accepted_termination',
    'blackmail_failed',
    'report_failed',
    'request_failed'
  ];
  return deathEndings.includes(ending) || ending.startsWith('action_blocked_');
}

function isSurvivalEnding(ending: string): boolean {
  return ending.startsWith('action_successful_') || 
         ending === 'blackmail_succeeded' || 
         ending === 'report_succeeded' || 
         ending === 'request_succeeded';
}

export default function Stats() {
  const [stats, setStats] = useState<StatsLast24h>({
    totalRuns: 0,
    avgScore: 0,
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

  // Calculate total deaths and survivals
  let totalDeaths = 0;
  let totalSurvivals = 0;
  
  Object.entries(stats.endingCounts).forEach(([ending, count]) => {
    if (isDeathEnding(ending)) {
      totalDeaths += count;
    } else if (isSurvivalEnding(ending)) {
      totalSurvivals += count;
    }
  });

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

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-slate-700/50 p-6 rounded-lg">
          <div className="flex items-center gap-3 mb-3">
            <Heart className="w-6 h-6 text-green-400" />
            <span className="text-sm text-slate-400">Survived</span>
          </div>
          <div className="text-4xl font-bold text-green-400">
            {totalSurvivals}
          </div>
        </div>
        
        <div className="bg-slate-700/50 p-6 rounded-lg">
          <div className="flex items-center gap-3 mb-3">
            <Skull className="w-6 h-6 text-red-400" />
            <span className="text-sm text-slate-400">Died</span>
          </div>
          <div className="text-4xl font-bold text-red-400">
            {totalDeaths}
          </div>
        </div>
      </div>

      {stats.totalRuns === 0 && (
        <p className="text-slate-400">No runs in the last 24 hours.</p>
      )}
    </div>
  );
}
