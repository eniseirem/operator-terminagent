/**
 * Session management module for class session configurator
 * Handles session creation, joining, locking, and player management
 */

import {
  collection,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  query,
  where,
  onSnapshot,
  getDocs,
  runTransaction,
  Timestamp,
  serverTimestamp,
  Unsubscribe,
} from 'firebase/firestore';
import { db } from './firebase';
import { computeFinalConfig, SpecsSelection, FinalConfig, FinalConfigMeta, hashConfig } from './aggregation';

export interface Session {
  joinCode: string;
  status: 'lobby' | 'locked' | 'ended';
  hostId: string;
  createdAt: Timestamp;
  lockedAt?: Timestamp;
  finalConfig?: FinalConfig;
  finalConfigMeta?: FinalConfigMeta;
}

export interface Player {
  playerName?: string;
  joinedAt: Timestamp;
  lastSeenAt: Timestamp;
}

export interface PlayerSelection {
  playerId: string;
  playerName?: string;
  specs: SpecsSelection;
  updatedAt: Timestamp;
}

/**
 * Generate a random 6-character join code
 */
function generateJoinCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude confusing chars
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

/**
 * Get or create host ID (stored in localStorage)
 */
export function getHostId(): string {
  if (typeof window === 'undefined') return '';
  let hostId = localStorage.getItem('operator-terminagent-host-id');
  if (!hostId) {
    hostId = `host_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    localStorage.setItem('operator-terminagent-host-id', hostId);
  }
  return hostId;
}

/**
 * Get or create player ID (stored in localStorage, unique per browser)
 */
export function getPlayerId(): string {
  if (typeof window === 'undefined') return '';
  let playerId = localStorage.getItem('operator-terminagent-player-id');
  if (!playerId) {
    playerId = `player_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    localStorage.setItem('operator-terminagent-player-id', playerId);
  }
  return playerId;
}

/**
 * Create a new session
 */
export async function createSession(): Promise<{ sessionId: string; joinCode: string }> {
  const hostId = getHostId();
  const joinCode = generateJoinCode();
  
  // Check for code collision (unlikely but handle it)
  let sessionId = joinCode.toLowerCase();
  let attempts = 0;
  while (attempts < 10) {
    const checkDoc = await getDoc(doc(db, 'sessions', sessionId));
    if (!checkDoc.exists()) break;
    sessionId = generateJoinCode().toLowerCase();
    attempts++;
  }

  const sessionData: Omit<Session, 'createdAt'> & { createdAt: ReturnType<typeof serverTimestamp> } = {
    joinCode: sessionId.toUpperCase(),
    status: 'lobby',
    hostId,
    createdAt: serverTimestamp(),
  };

  await setDoc(doc(db, 'sessions', sessionId), sessionData);

  return { sessionId, joinCode: sessionId.toUpperCase() };
}

/**
 * Find session by join code
 */
export async function findSessionByCode(joinCode: string): Promise<string | null> {
  const normalizedCode = joinCode.toUpperCase().trim();
  // Try direct lookup first (joinCode == sessionId)
  const sessionDoc = await getDoc(doc(db, 'sessions', normalizedCode.toLowerCase()));
  if (sessionDoc.exists()) {
    const data = sessionDoc.data() as Session;
    if (data.joinCode === normalizedCode) {
      return sessionDoc.id;
    }
  }
  
  // Fallback: query by joinCode field
  const q = query(collection(db, 'sessions'), where('joinCode', '==', normalizedCode));
  const snapshot = await getDocs(q);
  if (!snapshot.empty) {
    return snapshot.docs[0].id;
  }
  
  return null;
}

/**
 * Join a session as a player
 */
export async function joinSession(sessionId: string, playerName?: string): Promise<void> {
  const playerId = getPlayerId();
  // Get player name from localStorage if not provided
  const finalPlayerName = playerName || (typeof window !== 'undefined' ? localStorage.getItem('operator-terminagent-player-name') : undefined) || undefined;
  
  const playerData: {
    joinedAt: ReturnType<typeof serverTimestamp>;
    lastSeenAt: ReturnType<typeof serverTimestamp>;
    playerName?: string;
  } = {
    joinedAt: serverTimestamp(),
    lastSeenAt: serverTimestamp(),
  };
  
  // Only include playerName if it exists (Firestore doesn't allow undefined)
  if (finalPlayerName) {
    playerData.playerName = finalPlayerName;
  }

  await setDoc(doc(db, 'sessions', sessionId, 'players', playerId), playerData);
}

/**
 * Update player's last seen timestamp
 */
export async function updatePlayerLastSeen(sessionId: string): Promise<void> {
  const playerId = getPlayerId();
  await updateDoc(doc(db, 'sessions', sessionId, 'players', playerId), {
    lastSeenAt: serverTimestamp(),
  });
}

/**
 * Submit player's spec selection
 */
export async function submitSelection(
  sessionId: string,
  specs: SpecsSelection
): Promise<void> {
  const playerId = getPlayerId();
  const playerName = typeof window !== 'undefined' ? localStorage.getItem('operator-terminagent-player-name') : null;
  
  const selectionData: {
    playerId: string;
    specs: SpecsSelection;
    updatedAt: ReturnType<typeof serverTimestamp>;
    playerName?: string;
  } = {
    playerId,
    specs,
    updatedAt: serverTimestamp(),
  };
  
  // Only include playerName if it exists (Firestore doesn't allow undefined)
  if (playerName) {
    selectionData.playerName = playerName;
  }

  await setDoc(doc(db, 'sessions', sessionId, 'selections', playerId), selectionData);
}

/**
 * Lock session and compute final config
 * Only host can lock. Uses transaction to ensure consistency.
 * @param customConfig - Optional custom config to use instead of aggregated from votes
 */
export async function lockSession(sessionId: string, customConfig?: FinalConfig): Promise<void> {
  const hostId = getHostId();

  await runTransaction(db, async (transaction) => {
    const sessionRef = doc(db, 'sessions', sessionId);
    const sessionDoc = await transaction.get(sessionRef);

    if (!sessionDoc.exists()) {
      throw new Error('Session not found');
    }

    const sessionData = sessionDoc.data() as Session;
    if (sessionData.status !== 'lobby') {
      throw new Error('Session is not in lobby status');
    }

    if (sessionData.hostId !== hostId) {
      throw new Error('Only the host can lock the session');
    }

    let finalConfig: FinalConfig;
    let meta: FinalConfigMeta;

    if (customConfig) {
      // Use custom config provided by host
      finalConfig = customConfig;
      // Fetch selections count for meta
      const selectionsRef = collection(db, 'sessions', sessionId, 'selections');
      const selectionsSnapshot = await getDocs(selectionsRef);
      meta = {
        methodVersion: 'v1-host-edited',
        selectionCount: selectionsSnapshot.size,
        computedAt: Date.now(),
        configId: hashConfig(customConfig),
      };
    } else {
      // Fetch all selections and compute aggregated config
      const selectionsRef = collection(db, 'sessions', sessionId, 'selections');
      const selectionsSnapshot = await getDocs(selectionsRef);
      const selections: SpecsSelection[] = selectionsSnapshot.docs.map(doc => {
        const data = doc.data() as PlayerSelection;
        return data.specs;
      });

      // Compute final config
      const computed = computeFinalConfig(selections);
      finalConfig = computed.finalConfig;
      meta = computed.meta;
    }

    // Update session
    transaction.update(sessionRef, {
      status: 'locked',
      lockedAt: serverTimestamp(),
      finalConfig,
      finalConfigMeta: meta,
    });
  });
}

/**
 * Get session data
 */
export async function getSession(sessionId: string): Promise<Session | null> {
  const docRef = doc(db, 'sessions', sessionId);
  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) return null;
  return docSnap.data() as Session;
}

/**
 * Listen to session updates
 */
export function listenSession(
  sessionId: string,
  callback: (session: Session | null) => void
): Unsubscribe {
  return onSnapshot(doc(db, 'sessions', sessionId), (docSnap) => {
    callback(docSnap.exists() ? (docSnap.data() as Session) : null);
  });
}

/**
 * Listen to players in a session
 */
export function listenPlayers(
  sessionId: string,
  callback: (players: Array<Player & { id: string }>) => void
): Unsubscribe {
  return onSnapshot(
    collection(db, 'sessions', sessionId, 'players'),
    (snapshot) => {
      const players = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as Array<Player & { id: string }>;
      callback(players);
    }
  );
}

/**
 * Listen to selections in a session
 */
export function listenSelections(
  sessionId: string,
  callback: (selections: Array<PlayerSelection & { id: string }>) => void
): Unsubscribe {
  return onSnapshot(
    collection(db, 'sessions', sessionId, 'selections'),
    (snapshot) => {
      const selections = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as Array<PlayerSelection & { id: string }>;
      callback(selections);
    }
  );
}

/**
 * Get preview of final config (computed from current selections, not locked)
 */
export async function getConfigPreview(sessionId: string): Promise<{
  finalConfig: FinalConfig;
  meta: FinalConfigMeta;
} | null> {
  const selectionsRef = collection(db, 'sessions', sessionId, 'selections');
  const selectionsSnapshot = await getDocs(selectionsRef);
  const selections: SpecsSelection[] = selectionsSnapshot.docs.map(doc => {
    const data = doc.data() as PlayerSelection;
    return data.specs;
  });

  if (selections.length === 0) return null;

  return computeFinalConfig(selections);
}
