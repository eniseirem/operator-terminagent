import { 
  collection, 
  addDoc, 
  query, 
  orderBy, 
  limit, 
  onSnapshot, 
  where, 
  Timestamp,
  serverTimestamp,
  Unsubscribe 
} from 'firebase/firestore';
import { db } from './firebase';

export interface Run {
  playerName?: string;
  score: number;
  durationMs: number;
  ending: string;
  createdAt: Timestamp;
}

export interface LeaderboardEntry extends Run {
  id: string;
  deathCount?: number;
}

export interface StatsLast24h {
  totalRuns: number;
  avgScore: number;
  endingCounts: Record<string, number>;
}

/**
 * Submit a completed game run to Firestore
 */
export async function submitRun(run: Omit<Run, 'createdAt'>): Promise<void> {
  await addDoc(collection(db, 'runs'), {
    ...run,
    createdAt: serverTimestamp(),
  });
}

/**
 * Check if an ending indicates death/failure
 */
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

/**
 * Listen to the top 20 leaderboard entries, ordered by score desc, then createdAt desc
 * Also fetches all runs to calculate death counts per player
 * Returns unsubscribe function
 */
export function listenLeaderboard(
  callback: (entries: LeaderboardEntry[]) => void
): Unsubscribe {
  const q = query(
    collection(db, 'runs'),
    orderBy('score', 'desc'),
    orderBy('createdAt', 'desc'),
    limit(20)
  );

  // Also fetch all runs to calculate death counts
  const allRunsQuery = query(collection(db, 'runs'));

  let deathCounts: Record<string, number> = {};
  let deathCountsReady = false;
  let pendingLeaderboard: LeaderboardEntry[] | null = null;

  // Listen to all runs to calculate death counts
  const unsubscribeAll = onSnapshot(allRunsQuery, (allSnapshot) => {
    const allRuns = allSnapshot.docs.map((doc) => doc.data() as Run);
    
    // Calculate death counts per player
    deathCounts = {};
    allRuns.forEach((run) => {
      const playerKey = run.playerName || 'Anonymous';
      if (isDeathEnding(run.ending)) {
        deathCounts[playerKey] = (deathCounts[playerKey] || 0) + 1;
      }
    });
    
    deathCountsReady = true;
    
    // If we have pending leaderboard data, process it now
    if (pendingLeaderboard) {
      const entriesWithDeaths: LeaderboardEntry[] = pendingLeaderboard.map((entry) => ({
        ...entry,
        deathCount: deathCounts[entry.playerName || 'Anonymous'] || 0,
      }));
      callback(entriesWithDeaths);
      pendingLeaderboard = null;
    }
  });

  // Listen to leaderboard
  const unsubscribeLeaderboard = onSnapshot(q, (snapshot) => {
    const leaderboardEntries: LeaderboardEntry[] = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() as Run),
    }));

    // If death counts are ready, use them; otherwise store for later
    if (deathCountsReady) {
      const entriesWithDeaths: LeaderboardEntry[] = leaderboardEntries.map((entry) => ({
        ...entry,
        deathCount: deathCounts[entry.playerName || 'Anonymous'] || 0,
      }));
      callback(entriesWithDeaths);
    } else {
      // Store for when death counts are ready
      pendingLeaderboard = leaderboardEntries;
    }
  });

  return () => {
    unsubscribeLeaderboard();
    unsubscribeAll();
  };
}

/**
 * Listen to stats for runs in the last 24 hours
 * Computes aggregates client-side: totalRuns, avgScore, endingCounts
 * Returns unsubscribe function
 */
export function listenStatsLast24h(
  callback: (stats: StatsLast24h) => void
): Unsubscribe {
  const now = Timestamp.now();
  const yesterday = Timestamp.fromMillis(now.toMillis() - 24 * 60 * 60 * 1000);

  const q = query(
    collection(db, 'runs'),
    where('createdAt', '>=', yesterday),
    orderBy('createdAt', 'desc')
  );

  return onSnapshot(q, (snapshot) => {
    const runs = snapshot.docs.map((doc) => doc.data() as Run);
    
    const stats: StatsLast24h = {
      totalRuns: runs.length,
      avgScore: runs.length > 0 
        ? runs.reduce((sum, r) => sum + r.score, 0) / runs.length 
        : 0,
      endingCounts: runs.reduce((acc, r) => {
        acc[r.ending] = (acc[r.ending] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
    };

    callback(stats);
  });
}
