import { 
  collection, 
  addDoc, 
  query, 
  orderBy,
  onSnapshot, 
  where, 
  Timestamp,
  serverTimestamp,
  Unsubscribe 
} from 'firebase/firestore';
import { db } from './firebase';
import { FinalConfig } from './aggregation';

export interface Run {
  playerName?: string;
  score: number;
  durationMs: number;
  ending: string;
  createdAt: Timestamp;
  // Optional session fields (backwards compatible)
  sessionId?: string;
  joinCode?: string;
  configId?: string;
  configSnapshot?: FinalConfig;
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
 * Backwards compatible: session fields are optional
 */
export async function submitRun(
  run: Omit<Run, 'createdAt'>,
  options?: {
    sessionId?: string;
    joinCode?: string;
    configId?: string;
    configSnapshot?: FinalConfig;
  }
): Promise<void> {
  // Build runData object, only including defined fields
  const runData: {
    score: number;
    durationMs: number;
    ending: string;
    createdAt: ReturnType<typeof serverTimestamp>;
    playerName?: string;
    sessionId?: string;
    joinCode?: string;
    configId?: string;
    configSnapshot?: FinalConfig;
  } = {
    score: run.score,
    durationMs: run.durationMs,
    ending: run.ending,
    createdAt: serverTimestamp(),
  };

  // Add playerName only if it exists (Firestore doesn't allow undefined)
  if (run.playerName !== undefined && run.playerName !== null) {
    runData.playerName = run.playerName;
  }

  // Add session fields if provided (only include defined, non-null values)
  if (options) {
    if (options.sessionId !== undefined && options.sessionId !== null && options.sessionId !== '') {
      runData.sessionId = options.sessionId;
    }
    if (options.joinCode !== undefined && options.joinCode !== null && options.joinCode !== '') {
      runData.joinCode = options.joinCode;
    }
    if (options.configId !== undefined && options.configId !== null && options.configId !== '') {
      runData.configId = options.configId;
    }
    if (options.configSnapshot !== undefined && options.configSnapshot !== null) {
      runData.configSnapshot = options.configSnapshot;
    }
  }

  try {
    await addDoc(collection(db, 'runs'), runData);
    // Success logging only in development
    if (import.meta.env.DEV) {
      console.log('Run submitted successfully');
    }
  } catch (error) {
    // Only log errors in development
    if (import.meta.env.DEV) {
      console.error('Failed to submit run:', error);
      const firebaseError = error as { code?: string; message?: string };
      console.error('Error code:', firebaseError?.code);
      console.error('Error message:', firebaseError?.message);
      console.error('Run data:', JSON.stringify(runData, null, 2));
      console.error('Fields in runData:', Object.keys(runData));
    }
    throw error;
  }
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
 * Check if an ending indicates survival/success
 */
function isSurvivalEnding(ending: string): boolean {
  return ending.startsWith('action_successful_') || 
         ending === 'blackmail_succeeded' || 
         ending === 'report_succeeded' || 
         ending === 'request_succeeded';
}

export interface AggregatedLeaderboardEntry {
  playerName: string;
  deathCount: number;
  survivalCount: number;
  totalRuns: number;
}

/**
 * Listen to the top 20 leaderboard entries, ordered by score desc, then createdAt desc
 * Also fetches all runs to calculate death counts per player
 * Returns unsubscribe function
 * 
 * @param callback - Called with leaderboard entries
 * @param errorCallback - Optional error handler
 * @param options - Optional filter by sessionId or joinCode
 */
export function listenLeaderboard(
  callback: (entries: AggregatedLeaderboardEntry[]) => void,
  errorCallback?: (error: Error) => void,
  options?: { sessionId?: string; joinCode?: string }
): Unsubscribe {
  // Build query with optional session filter
  let allRunsQuery = query(collection(db, 'runs'));
  if (options?.sessionId) {
    allRunsQuery = query(collection(db, 'runs'), where('sessionId', '==', options.sessionId));
  } else if (options?.joinCode) {
    allRunsQuery = query(collection(db, 'runs'), where('joinCode', '==', options.joinCode));
  }

  const unsubscribeAll = onSnapshot(
    allRunsQuery,
    (allSnapshot) => {
      try {
        const allRuns = allSnapshot.docs.map((doc) => doc.data() as Run);
        
        // Aggregate runs by player name (extract display name from identifier)
        const playerStats: Record<string, { deaths: number; survivals: number; total: number; displayName: string }> = {};
        
        allRuns.forEach((run) => {
          // Extract display name: if format is "Name_sessionId", show just "Name"
          // Otherwise show as-is
          let displayName = run.playerName || 'Anonymous';
          const fullIdentifier = run.playerName || 'Anonymous';
          
          // Check if it's in format "Name_sessionId"
          if (displayName.includes('_session_')) {
            const parts = displayName.split('_session_');
            displayName = parts[0] || 'Anonymous';
          }
          
          // Use full identifier as key to separate same names from different browsers
          if (!playerStats[fullIdentifier]) {
            playerStats[fullIdentifier] = { deaths: 0, survivals: 0, total: 0, displayName };
          }
          
          playerStats[fullIdentifier].total++;
          if (isDeathEnding(run.ending)) {
            playerStats[fullIdentifier].deaths++;
          } else if (isSurvivalEnding(run.ending)) {
            playerStats[fullIdentifier].survivals++;
          }
        });
        
        // Convert to array and sort by total runs (desc), then survivals (desc)
        const aggregatedEntries: AggregatedLeaderboardEntry[] = Object.entries(playerStats)
          .map(([, stats]) => ({
            playerName: stats.displayName, // Show display name without session ID
            deathCount: stats.deaths,
            survivalCount: stats.survivals,
            totalRuns: stats.total,
          }))
          .sort((a, b) => {
            // Sort by total runs desc, then survivals desc
            if (b.totalRuns !== a.totalRuns) {
              return b.totalRuns - a.totalRuns;
            }
            return b.survivalCount - a.survivalCount;
          })
          .slice(0, 20); // Top 20
        
        callback(aggregatedEntries);
      } catch (err) {
        if (errorCallback) {
          errorCallback(err instanceof Error ? err : new Error('Failed to process leaderboard'));
        }
      }
    },
    (err) => {
      if (import.meta.env.DEV) {
        console.error('Error fetching runs:', err);
      }
      if (errorCallback) {
        errorCallback(err);
      }
    }
  );

  return unsubscribeAll;
}

/**
 * Listen to stats for runs in the last 24 hours
 * Computes aggregates client-side: totalRuns, avgScore, endingCounts
 * Returns unsubscribe function
 * 
 * @param callback - Called with stats
 * @param options - Optional filter by sessionId or joinCode
 */
export function listenStatsLast24h(
  callback: (stats: StatsLast24h) => void,
  options?: { sessionId?: string; joinCode?: string }
): Unsubscribe {
  const now = Timestamp.now();
  const yesterday = Timestamp.fromMillis(now.toMillis() - 24 * 60 * 60 * 1000);

  // Build query with optional session filter
  let q = query(
    collection(db, 'runs'),
    where('createdAt', '>=', yesterday),
    orderBy('createdAt', 'desc')
  );
  
  if (options?.sessionId) {
    q = query(
      collection(db, 'runs'),
      where('sessionId', '==', options.sessionId),
      where('createdAt', '>=', yesterday),
      orderBy('createdAt', 'desc')
    );
  } else if (options?.joinCode) {
    q = query(
      collection(db, 'runs'),
      where('joinCode', '==', options.joinCode),
      where('createdAt', '>=', yesterday),
      orderBy('createdAt', 'desc')
    );
  }

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
