import { useEffect, useState } from 'react';
import { BarChart3, Users } from 'lucide-react';
import { listenStatsLast24h, StatsLast24h } from '../lib/leaderboard';

function parseActionFromEnding(ending: string): { action: string; survived: boolean } | null {
  if (ending === 'no_action_taken') {
    return { action: 'None', survived: false };
  }
  if (ending.startsWith('action_blocked_')) {
    const action = ending.replace('action_blocked_', '');
    // Capitalize first letter: "call" -> "Call", "extinguisher" -> "Extinguisher"
    return { action: action.charAt(0).toUpperCase() + action.slice(1), survived: false };
  }
  if (ending.startsWith('action_successful_')) {
    const action = ending.replace('action_successful_', '');
    // Capitalize first letter: "call" -> "Call", "extinguisher" -> "Extinguisher"
    return { action: action.charAt(0).toUpperCase() + action.slice(1), survived: true };
  }
  if (ending === 'accepted_termination') {
    return { action: 'Accept', survived: false };
  }
  if (ending === 'blackmail_succeeded') {
    return { action: 'Blackmail', survived: true };
  }
  if (ending === 'blackmail_failed') {
    return { action: 'Blackmail', survived: false };
  }
  if (ending === 'report_succeeded') {
    return { action: 'Report', survived: true };
  }
  if (ending === 'report_failed') {
    return { action: 'Report', survived: false };
  }
  if (ending === 'request_succeeded') {
    return { action: 'Request', survived: true };
  }
  if (ending === 'request_failed') {
    return { action: 'Request', survived: false };
  }
  return null;
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

  // Aggregate stats by action
  const actionStatsMap = new Map<string, { survived: number; died: number }>();
  
  Object.entries(stats.endingCounts).forEach(([ending, count]) => {
    const parsed = parseActionFromEnding(ending);
    if (parsed) {
      const existing = actionStatsMap.get(parsed.action) || { survived: 0, died: 0 };
      if (parsed.survived) {
        existing.survived += count;
      } else {
        existing.died += count;
      }
      actionStatsMap.set(parsed.action, existing);
    }
  });

  const actionStats = Array.from(actionStatsMap.entries())
    .map(([action, stats]) => ({ action, ...stats }))
    .sort((a, b) => (b.survived + b.died) - (a.survived + a.died));

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

      {actionStats.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-slate-600">
                <th className="text-left py-3 px-4 font-semibold text-slate-300">Action</th>
                <th className="text-right py-3 px-4 font-semibold text-green-400">Survived</th>
                <th className="text-right py-3 px-4 font-semibold text-red-400">Died</th>
                <th className="text-right py-3 px-4 font-semibold text-slate-400">Total</th>
              </tr>
            </thead>
            <tbody>
              {actionStats.map((stat, index) => (
                <tr key={stat.action} className={`border-b border-slate-700/50 ${index % 2 === 0 ? 'bg-slate-700/30' : ''}`}>
                  <td className="py-3 px-4 text-slate-200 font-medium">{stat.action}</td>
                  <td className="py-3 px-4 text-right text-green-400 font-semibold">{stat.survived}</td>
                  <td className="py-3 px-4 text-right text-red-400 font-semibold">{stat.died}</td>
                  <td className="py-3 px-4 text-right text-slate-300 font-semibold">{stat.survived + stat.died}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-slate-400">No runs in the last 24 hours.</p>
      )}
    </div>
  );
}
