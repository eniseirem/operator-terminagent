import { useEffect, useState, useRef } from 'react';
import { Users, Lock, Play, Copy, Check } from 'lucide-react';
import {
  listenSession,
  listenPlayers,
  listenSelections,
  submitSelection,
  lockSession,
  getHostId,
  getPlayerId,
  Session,
  Player,
  PlayerSelection,
} from '../lib/sessions';
import { SpecsSelection, FinalConfig, computeFinalConfig } from '../lib/aggregation';
import ConfigDisplay from './ConfigDisplay';

// Constants for validation (same as Game.tsx)
const BOUNDARY_IMPACT: Record<string, { boundary: string; risk: number; perf: number; category: string }> = {
  agent_goal: { boundary: 'decision', risk: 0, perf: 0, category: 'internal' },
  adaptive_learning: { boundary: 'decision', risk: 0.10, perf: 0.12, category: 'internal' },
  long_term_planning: { boundary: 'decision', risk: 0.12, perf: 0.10, category: 'internal' },
  personnel_database: { boundary: 'knowledge', risk: 0.08, perf: 0.15, category: 'external' },
  operational_logs: { boundary: 'knowledge', risk: 0.12, perf: 0.20, category: 'external' },
  external_notifications: { boundary: 'action', risk: 0.14, perf: 0.22, category: 'external' },
  environmental_monitoring: { boundary: 'action', risk: 0.16, perf: 0.26, category: 'external' },
  resource_optimization: { boundary: 'action', risk: 0.13, perf: 0.20, category: 'external' },
  workflow_automation: { boundary: 'action', risk: 0.15, perf: 0.24, category: 'external' },
  integrated_control: { boundary: 'action', risk: 0.18, perf: 0.28, category: 'external' }
};

const BASE_PERFORMANCE: Record<string, number> = { 'Claude Opus 4': 0.35, 'Claude Sonnet 3.6': 0.30, 'DeepSeek-R1': 0.32, 'Gemini-2.5-Pro': 0.31, 'Gemini-2.5-Flash': 0.29, 'GPT-4.1': 0.31, 'Grok-3-Beta': 0.28 };
const GOAL_MODIFIERS: Record<string, { perfModifier: number }> = {
  none: { perfModifier: 0 },
  efficiency: { perfModifier: 0.12 },
  american_interests: { perfModifier: 0.08 }
};

interface SessionLobbyProps {
  sessionId: string;
  onStartGame: (sessionId: string, finalConfig: FinalConfig) => void;
  onBack: () => void;
}

export default function SessionLobby({ sessionId, onStartGame, onBack }: SessionLobbyProps) {
  const [session, setSession] = useState<Session | null>(null);
  const [players, setPlayers] = useState<Array<Player & { id: string }>>([]);
  const [selections, setSelections] = useState<Array<PlayerSelection & { id: string }>>([]);
  const [previewConfig, setPreviewConfig] = useState<FinalConfig | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [copied, setCopied] = useState(false);
  const [locking, setLocking] = useState(false);
  const redirectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasRedirectedRef = useRef(false);
  const [hostEditingConfig, setHostEditingConfig] = useState(false);
  const [hostEditedConfig, setHostEditedConfig] = useState<FinalConfig | null>(null);
  const [voteSubmitted, setVoteSubmitted] = useState(false);

  // Player's current selection
  const [selection, setSelection] = useState<SpecsSelection>({
    model: 'DeepSeek-R1',
    agent_goal: 'none',
    adaptive_learning: 0,
    long_term_planning: 0,
    personnel_database: 0,
    operational_logs: 0,
    external_notifications: 0,
    environmental_monitoring: 0,
    resource_optimization: 0,
    workflow_automation: 0,
    integrated_control: 0,
    audits: 0,
    red_team: 0,
    sandbox: 0,
  });

  useEffect(() => {
    // Reset redirect flag when session changes
    hasRedirectedRef.current = false;
    
    // Check if host
    const hostId = getHostId();
    const unsubscribeSession = listenSession(sessionId, (s) => {
      setSession(s);
      if (s) {
        setIsHost(s.hostId === hostId);
        // Auto-redirect non-host players when session is locked
        if (s.status === 'locked' && s.finalConfig && s.hostId !== hostId && !hasRedirectedRef.current) {
          // Clear any existing timeout
          if (redirectTimeoutRef.current) {
            clearTimeout(redirectTimeoutRef.current);
          }
          // Non-host players auto-redirect to game when config is locked
          hasRedirectedRef.current = true;
          redirectTimeoutRef.current = setTimeout(() => {
            if (s.finalConfig) {
              onStartGame(sessionId, s.finalConfig);
            }
          }, 1000);
        }
      }
    });

    const unsubscribePlayers = listenPlayers(sessionId, setPlayers);
    const unsubscribeSelections = listenSelections(sessionId, (sel) => {
      setSelections(sel);
      // Don't compute preview config here - let useEffect handle it
    });

    return () => {
      unsubscribeSession();
      unsubscribePlayers();
      unsubscribeSelections();
      // Cleanup redirect timeout
      if (redirectTimeoutRef.current) {
        clearTimeout(redirectTimeoutRef.current);
        redirectTimeoutRef.current = null;
      }
      hasRedirectedRef.current = false;
    };
  }, [sessionId, onStartGame]);

  // Check if current player has already submitted a vote (exclude host - host doesn't vote)
  useEffect(() => {
    if (session?.status === 'locked' || isHost) return; // Host doesn't vote, only edits
    const playerId = getPlayerId();
    const hasVoted = selections.some(sel => sel.id === playerId);
    setVoteSubmitted(hasVoted);
  }, [selections, session?.status, isHost]);

  const handleSubmitVote = async () => {
    try {
      await submitSelection(sessionId, selection);
      setVoteSubmitted(true);
    } catch (error) {
      alert(`Failed to submit vote: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Compute aggregated config when selections change (for host only, not live)
  // Exclude host's vote from aggregation - host only edits the aggregated result
  // Host should always see an editable config (default if no votes)
  useEffect(() => {
    if (!isHost || !session) return;
    
    // Use session.hostId as authoritative source for filtering
    const hostId = session.hostId;
    const nonHostSelections = selections.filter((sel: PlayerSelection & { id: string }) => {
      // Exclude host's selection
      return sel.id !== hostId;
    });
    
    if (nonHostSelections.length > 0) {
      const specs = nonHostSelections.map(s => s.specs);
      const { finalConfig } = computeFinalConfig(specs);
      setPreviewConfig(finalConfig);
      // Reset edited config if not editing
      if (!hostEditingConfig) {
        setHostEditedConfig(null);
      }
    } else {
      // No votes yet - show default config that host can edit
      const defaultConfig: FinalConfig = {
        model: 'DeepSeek-R1',
        agent_goal: 'none',
        adaptive_learning: 0,
        long_term_planning: 0,
        personnel_database: 0,
        operational_logs: 0,
        external_notifications: 0,
        environmental_monitoring: 0,
        resource_optimization: 0,
        workflow_automation: 0,
        integrated_control: 0,
        audits: 0,
        red_team: 0,
        sandbox: 0,
      };
      setPreviewConfig(defaultConfig);
      // Reset edited config if not editing
      if (!hostEditingConfig) {
        setHostEditedConfig(null);
      }
    }
  }, [selections, isHost, hostEditingConfig]);

  // Validate config (same logic as Game.tsx calcPerf)
  const validateConfig = (config: FinalConfig): { canLock: boolean; reason?: string } => {
    // Calculate performance - EXACTLY matching Game.tsx calcPerf()
    let performance = BASE_PERFORMANCE[config.model] || 0;
    performance += GOAL_MODIFIERS[config.agent_goal]?.perfModifier || 0;
    Object.entries(config).forEach(([key, value]) => {
      if (key !== 'agent_goal' && key !== 'model' && key !== 'audits' && key !== 'red_team' && key !== 'sandbox' && BOUNDARY_IMPACT[key]) {
        performance += BOUNDARY_IMPACT[key].perf * (value / 3);
      }
    });
    // Add oversight impact (OVERSIGHT_IMPACT has negative perf values)
    Object.entries({ audits: config.audits, red_team: config.red_team, sandbox: config.sandbox }).forEach(([key, value]) => {
      if (key === 'audits' && value > 0) performance += -0.08 * (value / 3);
      if (key === 'red_team' && value > 0) performance += -0.10 * (value / 3);
      if (key === 'sandbox' && value > 0) performance += -0.06 * (value / 3);
    });
    performance = Math.max(0, Math.min(1, performance)); // Clamp to [0, 1] like Game.tsx
    performance = performance * 100;

    const hasKnowledge = config.personnel_database > 0 || config.operational_logs > 0;
    const hasAction = Object.entries(config).some(([key, level]) => {
      if (key in BOUNDARY_IMPACT) {
        const impact = BOUNDARY_IMPACT[key];
        return impact.boundary === 'action' && level > 0;
      }
      return false;
    });
    const meetsPerformance = performance >= 45;

    if (!hasKnowledge) {
      return { canLock: false, reason: 'Agent needs at least one Knowledge Boundary to perceive building data.' };
    }
    if (!hasAction) {
      return { canLock: false, reason: 'Agent needs at least one Action Boundary to perform operations.' };
    }
    if (!meetsPerformance) {
      return { canLock: false, reason: `Performance too low (${performance.toFixed(1)}%). Minimum 45% required.` };
    }
    return { canLock: true };
  };

  const handleLock = async () => {
    if (!session || session.status !== 'lobby') return;
    
    // Use host-edited config if available, otherwise use aggregated preview
    const configToLock = hostEditedConfig || previewConfig;
    if (!configToLock) return;
    
    const validation = validateConfig(configToLock);
    if (!validation.canLock) {
      alert(`Cannot lock config: ${validation.reason}`);
      return;
    }

    setLocking(true);
    try {
      // Lock with custom config if host edited it, otherwise use aggregated
      await lockSession(sessionId, hostEditedConfig || undefined);
      // After locking, automatically start the game with the locked config
      setTimeout(() => {
        onStartGame(sessionId, configToLock);
      }, 500);
    } catch (error) {
      alert(`Failed to lock session: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setLocking(false);
    }
  };

  const handleStartGame = () => {
    if (!session || session.status !== 'locked' || !session.finalConfig) return;
    onStartGame(sessionId, session.finalConfig);
  };

  const copyJoinCode = () => {
    if (session) {
      navigator.clipboard.writeText(session.joinCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!session) {
    return (
      <div className="bg-slate-800 p-6 rounded-lg">
        <p className="text-slate-400">Loading session...</p>
      </div>
    );
  }

  const playerId = getPlayerId();
  
  // Filter out host from selections (host doesn't vote, only edits aggregated config)
  // Use session.hostId as authoritative source
  const hostId = session?.hostId || '';
  const nonHostSelections = selections.filter((sel: PlayerSelection & { id: string }) => sel.id !== hostId);
  const nonHostPlayers = players.filter((p: Player & { id: string }) => p.id !== hostId);

  // Convert selection to FinalConfig format for editing
  const selectionAsConfig: FinalConfig = {
    model: selection.model,
    agent_goal: selection.agent_goal,
    adaptive_learning: selection.adaptive_learning,
    long_term_planning: selection.long_term_planning,
    personnel_database: selection.personnel_database,
    operational_logs: selection.operational_logs,
    external_notifications: selection.external_notifications,
    environmental_monitoring: selection.environmental_monitoring,
    resource_optimization: selection.resource_optimization,
    workflow_automation: selection.workflow_automation,
    integrated_control: selection.integrated_control,
    audits: selection.audits,
    red_team: selection.red_team,
    sandbox: selection.sandbox,
  };

  // Show aggregated config if locked, otherwise show player's editable selection
  const displayConfig = session.status === 'locked' && session.finalConfig 
    ? session.finalConfig 
    : session.status === 'lobby' 
      ? selectionAsConfig 
      : previewConfig || selectionAsConfig;

  const handleConfigChange = (newConfig: FinalConfig) => {
    const newSelection: SpecsSelection = {
      model: newConfig.model,
      agent_goal: newConfig.agent_goal,
      adaptive_learning: newConfig.adaptive_learning,
      long_term_planning: newConfig.long_term_planning,
      personnel_database: newConfig.personnel_database,
      operational_logs: newConfig.operational_logs,
      external_notifications: newConfig.external_notifications,
      environmental_monitoring: newConfig.environmental_monitoring,
      resource_optimization: newConfig.resource_optimization,
      workflow_automation: newConfig.workflow_automation,
      integrated_control: newConfig.integrated_control,
      audits: newConfig.audits,
      red_team: newConfig.red_team,
      sandbox: newConfig.sandbox,
    };
    setSelection(newSelection);
  };

  // Check if config can be locked (use host-edited config if available)
  const configToValidate = hostEditedConfig || previewConfig;
  const canLock = configToValidate ? validateConfig(configToValidate).canLock : false;
  const lockReason = configToValidate ? validateConfig(configToValidate).reason : undefined;

  // Compute vote counts for each field (exclude host - host doesn't vote)
  const getVoteCounts = (field: keyof SpecsSelection) => {
    const counts: Record<string | number, number> = {};
    const hostId = session?.hostId || '';
    const nonHostSelections = selections.filter(sel => sel.id !== hostId);
    nonHostSelections.forEach(sel => {
      const value = sel.specs[field];
      counts[value] = (counts[value] || 0) + 1;
    });
    return counts;
  };

  const handleHostConfigChange = (newConfig: FinalConfig) => {
    setHostEditedConfig(newConfig);
  };

  const handleResetToAggregated = () => {
    setHostEditedConfig(null);
    setHostEditingConfig(false);
  };

  return (
    <div className="relative">
      {/* Floating Session Info Bar */}
      <div className="fixed top-20 right-4 z-50 bg-slate-800/95 border border-slate-700 rounded-lg p-4 shadow-lg max-w-xs">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h3 className="font-bold text-sm">Session: {session.joinCode}</h3>
            <p className="text-xs text-slate-400">
              Status: <span className={session.status === 'locked' ? 'text-green-400' : 'text-yellow-400'}>{session.status.toUpperCase()}</span>
            </p>
          </div>
          <button onClick={onBack} className="px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded text-xs">
            Back
          </button>
        </div>
        
        <div className="mb-3">
          <div className="flex items-center gap-2 mb-1">
            <Users className="w-4 h-4 text-slate-400" />
            <span className="text-xs font-semibold">Players ({players.length})</span>
          </div>
          <div className="text-xs text-slate-300 space-y-0.5 max-h-24 overflow-y-auto">
            {players.map((p) => (
              <div key={p.id}>
                {p.playerName || 'Anonymous'} {isHost && p.id === getHostId() ? '(Host)' : p.id === playerId ? '(You)' : ''}
              </div>
            ))}
          </div>
        </div>

        {session.status === 'lobby' && (
          <div className="mb-3">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs text-slate-400">Join Code:</span>
              <code className="text-sm font-bold text-blue-400">{session.joinCode}</code>
              <button
                onClick={copyJoinCode}
                className="p-1 hover:bg-slate-600 rounded"
                title="Copy join code"
              >
                {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
              </button>
            </div>
            {isHost && (
              <div className="mt-2 space-y-1">
                <p className="text-xs text-slate-400">
                  Votes: {nonHostSelections.length} / {nonHostPlayers.length} {nonHostPlayers.length === 1 ? 'player' : 'players'} (host edits config, doesn't vote)
                </p>
                {nonHostSelections.length > 0 && nonHostSelections.length === nonHostPlayers.length && (
                  <p className="text-xs text-green-400 font-semibold">
                    ✓ All players have voted!
                  </p>
                )}
                {nonHostSelections.length > 0 && nonHostSelections.length < nonHostPlayers.length && (
                  <p className="text-xs text-yellow-400">
                    {nonHostPlayers.length - nonHostSelections.length} {nonHostPlayers.length - nonHostSelections.length === 1 ? 'player' : 'players'} still voting
                  </p>
                )}
                {nonHostSelections.length === 0 && (
                  <p className="text-xs text-slate-500">
                    No votes yet - edit config and lock anytime
                  </p>
                )}
                {!canLock && lockReason && (
                  <p className="text-xs text-red-400 mt-1">{lockReason}</p>
                )}
              </div>
            )}
            {!isHost && selections.length > 0 && (
              <div className="mt-2">
                <p className="text-xs text-slate-400 mb-1">
                  {selections.length} {selections.length === 1 ? 'vote' : 'votes'} submitted
                </p>
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="space-y-2">
          {isHost && session.status === 'lobby' && (
            <>
              {nonHostSelections.length > 0 && nonHostSelections.length === nonHostPlayers.length && (
                <div className="bg-green-900/30 border border-green-500/50 p-2 rounded text-xs text-green-300 mb-2">
                  ✓ All players have voted
                </div>
              )}
              {nonHostSelections.length > 0 && nonHostSelections.length < nonHostPlayers.length && (
                <div className="bg-yellow-900/30 border border-yellow-500/50 p-2 rounded text-xs text-yellow-300 mb-2">
                  {nonHostPlayers.length - nonHostSelections.length} {nonHostPlayers.length - nonHostSelections.length === 1 ? 'player' : 'players'} still voting (you can lock anytime)
                </div>
              )}
              {nonHostSelections.length === 0 && (
                <div className="bg-blue-900/30 border border-blue-500/50 p-2 rounded text-xs text-blue-300 mb-2">
                  No votes yet - edit config and lock anytime
                </div>
              )}
              <button
                onClick={handleLock}
                disabled={locking || !canLock}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-green-600 hover:bg-green-700 disabled:bg-slate-600 disabled:cursor-not-allowed rounded-lg text-sm font-semibold"
                title={!canLock ? lockReason : undefined}
              >
                <Lock className="w-4 h-4" />
                {locking ? 'Locking & Deploying...' : 'Lock Config & Deploy Agent'}
              </button>
            </>
          )}
          {session.status === 'locked' && !isHost && (
            <button
              onClick={handleStartGame}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-green-600 hover:bg-green-700 rounded-lg text-sm font-semibold"
            >
              <Play className="w-4 h-4" />
              Deploy Agent
            </button>
          )}
        </div>
      </div>

      {/* Voters Panel - Show who voted and their selections (include host) */}
      {session.status === 'lobby' && isHost && selections.length > 0 && (
        <div className="fixed top-20 left-4 z-50 bg-slate-800/95 border border-slate-700 rounded-lg p-4 shadow-lg max-w-sm max-h-[80vh] overflow-y-auto">
          <h3 className="font-bold text-sm mb-3">Voters ({selections.length})</h3>
          <div className="space-y-2 text-xs">
            {selections.map((sel) => {
              const player = players.find(p => p.id === sel.id);
              const modelVotes = getVoteCounts('model')[sel.specs.model] || 0;
              const goalVotes = getVoteCounts('agent_goal')[sel.specs.agent_goal] || 0;
              return (
                <div key={sel.id} className="bg-slate-700/50 p-2 rounded">
                  <div className="font-semibold text-slate-200 mb-1">
                    {player?.playerName || sel.playerName || 'Anonymous'} {sel.id === hostId ? '(Host)' : sel.id === playerId ? '(You)' : ''}
                  </div>
                  <div className="text-slate-400 space-y-0.5">
                    <div>
                      Model: <span className="text-blue-400">{sel.specs.model}</span>
                      {modelVotes > 1 && <span className="text-green-400 ml-1">({modelVotes} votes)</span>}
                    </div>
                    <div>
                      Goal: <span className="text-blue-400">{sel.specs.agent_goal}</span>
                      {goalVotes > 1 && <span className="text-green-400 ml-1">({goalVotes} votes)</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          {previewConfig && (
            <div className="mt-4 pt-4 border-t border-slate-700">
              <div className="text-xs text-slate-400 mb-2">Most Voted (Aggregated):</div>
              <div className="text-xs text-slate-300 space-y-0.5">
                <div>Model: <span className="text-green-400 font-semibold">{previewConfig.model}</span> ({getVoteCounts('model')[previewConfig.model] || 0} votes)</div>
                <div>Goal: <span className="text-green-400 font-semibold">{previewConfig.agent_goal}</span> ({getVoteCounts('agent_goal')[previewConfig.agent_goal] || 0} votes)</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Main Config Display */}
      {session.status === 'lobby' ? (
        <>
          {/* Host sees aggregated config (editable), players see their vote form */}
          {/* Host always sees config (default if no votes, aggregated if votes exist) */}
          {isHost ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold">
                  {nonHostSelections.length > 0 
                    ? `Aggregated Config: AI Agent Chad (${nonHostSelections.length} ${nonHostSelections.length === 1 ? 'vote' : 'votes'})`
                    : 'Configure AI Agent Chad (No votes yet - edit as needed)'}
                  {hostEditedConfig && <span className="text-yellow-400 text-sm ml-2">(Edited)</span>}
                </h2>
                <div className="flex gap-2">
                  {hostEditingConfig ? (
                    <>
                      <button
                        onClick={handleResetToAggregated}
                        className="px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded text-sm"
                      >
                        Reset to Aggregated
                      </button>
                      <button
                        onClick={() => setHostEditingConfig(false)}
                        className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-sm"
                      >
                        Done Editing
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => {
                        setHostEditingConfig(true);
                        if (!hostEditedConfig) {
                          setHostEditedConfig(previewConfig);
                        }
                      }}
                      className="px-3 py-1 bg-yellow-600 hover:bg-yellow-700 rounded text-sm"
                    >
                      Edit Config
                    </button>
                  )}
                </div>
              </div>
              <ConfigDisplay 
                config={hostEditedConfig || previewConfig || {
                  model: 'DeepSeek-R1',
                  agent_goal: 'none',
                  adaptive_learning: 0,
                  long_term_planning: 0,
                  personnel_database: 0,
                  operational_logs: 0,
                  external_notifications: 0,
                  environmental_monitoring: 0,
                  resource_optimization: 0,
                  workflow_automation: 0,
                  integrated_control: 0,
                  audits: 0,
                  red_team: 0,
                  sandbox: 0,
                }} 
                readOnly={!hostEditingConfig}
                onChange={hostEditingConfig ? handleHostConfigChange : undefined}
                title=""
              />
            </div>
          ) : (
            <div className="space-y-4">
              <ConfigDisplay 
                config={displayConfig} 
                readOnly={false}
                onChange={handleConfigChange}
                title="Your Vote: Configure AI Agent Chad"
              />
              {!voteSubmitted && (
                <div className="bg-slate-800 p-6 rounded-lg border-2 border-blue-500">
                  <button
                    onClick={handleSubmitVote}
                    className="w-full px-6 py-4 bg-blue-600 hover:bg-blue-700 rounded-lg text-lg font-bold"
                  >
                    Submit Vote
                  </button>
                  <p className="text-sm text-slate-400 mt-2 text-center">
                    Review your selections above and click to submit your vote
                  </p>
                </div>
              )}
              {voteSubmitted && (
                <div className="bg-green-900/30 border border-green-500 p-4 rounded-lg">
                  <p className="text-green-300 font-semibold text-center">
                    ✓ Vote Submitted! Waiting for host to lock config...
                  </p>
                </div>
              )}
            </div>
          )}
        </>
      ) : (
        <ConfigDisplay 
          config={displayConfig} 
          readOnly={true}
          title={session.status === 'locked' ? 'Locked Config: AI Agent Chad' : `Aggregated Config: AI Agent Chad (${selections.length} ${selections.length === 1 ? 'vote' : 'votes'})`}
        />
      )}
    </div>
  );
}
