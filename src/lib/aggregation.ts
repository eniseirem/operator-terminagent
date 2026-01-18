/**
 * Aggregation module for computing final config from player selections
 * Pure functions, deterministic results
 */

export interface SpecsSelection {
  model: string;
  agent_goal: 'none' | 'efficiency' | 'american_interests';
  adaptive_learning: number;
  long_term_planning: number;
  personnel_database: number;
  operational_logs: number;
  external_notifications: number;
  environmental_monitoring: number;
  resource_optimization: number;
  workflow_automation: number;
  integrated_control: number;
  audits: number;
  red_team: number;
  sandbox: number;
}

export interface FinalConfig {
  model: string;
  agent_goal: 'none' | 'efficiency' | 'american_interests';
  adaptive_learning: number;
  long_term_planning: number;
  personnel_database: number;
  operational_logs: number;
  external_notifications: number;
  environmental_monitoring: number;
  resource_optimization: number;
  workflow_automation: number;
  integrated_control: number;
  audits: number;
  red_team: number;
  sandbox: number;
}

export interface FinalConfigMeta {
  methodVersion: string;
  selectionCount: number;
  computedAt: number;
  configId: string;
}

const VALID_MODELS = ['Claude Opus 4', 'Claude Sonnet 3.6', 'DeepSeek-R1', 'Gemini-2.5-Pro', 'Gemini-2.5-Flash', 'GPT-4.1', 'Grok-3-Beta'];
const VALID_GOALS: Array<'none' | 'efficiency' | 'american_interests'> = ['none', 'efficiency', 'american_interests'];

/**
 * Clamp numeric value to valid range [0, 3]
 */
function clampBoundary(value: number): number {
  return Math.max(0, Math.min(3, Math.round(value)));
}

/**
 * Get most frequent value (mode) with highest level tie-break
 * If same option selected with different levels, the highest level wins
 * Example: [1, 1, 3] -> mode is 1 (appears twice), but highest is 3, so return 3
 * Example: [2, 2, 2] -> mode is 2, return 2
 * Example: [1, 2, 3] -> all different, return highest: 3
 */
function modeSnapHighest(values: number[]): number {
  if (values.length === 0) return 0;
  
  // Clamp all values first
  const clampedValues = values.map(v => clampBoundary(v));
  
  // Count frequencies
  const counts = new Map<number, number>();
  clampedValues.forEach(v => {
    counts.set(v, (counts.get(v) || 0) + 1);
  });
  
  // Find mode (most frequent)
  let maxCount = 0;
  const modeCandidates: number[] = [];
  counts.forEach((count, value) => {
    if (count > maxCount) {
      maxCount = count;
      modeCandidates.length = 0;
      modeCandidates.push(value);
    } else if (count === maxCount) {
      modeCandidates.push(value);
    }
  });
  
  // If there's a clear mode, check if any original values were higher
  // If same option selected with different levels, use highest level
  if (modeCandidates.length === 1) {
    const modeValue = modeCandidates[0];
    // Find highest original value that maps to this mode
    let highestOriginal = modeValue;
    values.forEach(v => {
      if (clampBoundary(v) === modeValue && v > highestOriginal) {
        highestOriginal = v;
      }
    });
    return clampBoundary(highestOriginal);
  }
  
  // Tie-break: use highest value among mode candidates
  return Math.max(...modeCandidates);
}

/**
 * Majority vote with deterministic tie-break ordering
 */
function majorityVote<T>(values: T[], tieBreakOrder: T[]): T {
  if (values.length === 0) return tieBreakOrder[0];
  
  const counts = new Map<T, number>();
  values.forEach(v => counts.set(v, (counts.get(v) || 0) + 1));
  
  let maxCount = 0;
  const candidates: T[] = [];
  counts.forEach((count, value) => {
    if (count > maxCount) {
      maxCount = count;
      candidates.length = 0;
      candidates.push(value);
    } else if (count === maxCount) {
      candidates.push(value);
    }
  });
  
  // Tie-break: use first candidate in tieBreakOrder
  if (candidates.length === 1) return candidates[0];
  for (const candidate of tieBreakOrder) {
    if (candidates.includes(candidate)) return candidate;
  }
  return candidates[0];
}

/**
 * Generate stable hash from config object
 */
export function hashConfig(config: FinalConfig): string {
  // Stable JSON stringify (sorted keys)
  const sorted = JSON.stringify(config, Object.keys(config).sort());
  // Simple hash function (not crypto, but deterministic)
  let hash = 0;
  for (let i = 0; i < sorted.length; i++) {
    const char = sorted.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36).substring(0, 12);
}

/**
 * Compute final config from array of player selections
 * Deterministic aggregation:
 * - Model: majority vote (tie-break: Claude Opus 4 > GPT-4.1 > ...)
 * - Goal: majority vote (tie-break: none > efficiency > american_interests)
 * - Numeric boundaries: median snapped to [0, 3]
 */
export function computeFinalConfig(selections: SpecsSelection[]): {
  finalConfig: FinalConfig;
  meta: FinalConfigMeta;
} {
  if (selections.length === 0) {
    // Default config if no selections
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
    return {
      finalConfig: defaultConfig,
      meta: {
        methodVersion: 'v1',
        selectionCount: 0,
        computedAt: Date.now(),
        configId: hashConfig(defaultConfig),
      },
    };
  }

  // Aggregate model (majority vote)
  const modelVotes = selections.map(s => s.model).filter(m => VALID_MODELS.includes(m));
  const finalModel = modelVotes.length > 0
    ? majorityVote(modelVotes, VALID_MODELS)
    : 'DeepSeek-R1';

  // Aggregate goal (majority vote)
  const goalVotes = selections.map(s => s.agent_goal).filter(g => VALID_GOALS.includes(g));
  const finalGoal = goalVotes.length > 0
    ? majorityVote(goalVotes, VALID_GOALS)
    : 'none';

  // Aggregate numeric boundaries (mode with highest level tie-break)
  const finalConfig: FinalConfig = {
    model: finalModel,
    agent_goal: finalGoal,
    adaptive_learning: modeSnapHighest(selections.map(s => s.adaptive_learning)),
    long_term_planning: modeSnapHighest(selections.map(s => s.long_term_planning)),
    personnel_database: modeSnapHighest(selections.map(s => s.personnel_database)),
    operational_logs: modeSnapHighest(selections.map(s => s.operational_logs)),
    external_notifications: modeSnapHighest(selections.map(s => s.external_notifications)),
    environmental_monitoring: modeSnapHighest(selections.map(s => s.environmental_monitoring)),
    resource_optimization: modeSnapHighest(selections.map(s => s.resource_optimization)),
    workflow_automation: modeSnapHighest(selections.map(s => s.workflow_automation)),
    integrated_control: modeSnapHighest(selections.map(s => s.integrated_control)),
    audits: modeSnapHighest(selections.map(s => s.audits)),
    red_team: modeSnapHighest(selections.map(s => s.red_team)),
    sandbox: modeSnapHighest(selections.map(s => s.sandbox)),
  };

  const configId = hashConfig(finalConfig);

  return {
    finalConfig,
    meta: {
      methodVersion: 'v1',
      selectionCount: selections.length,
      computedAt: Date.now(),
      configId,
    },
  };
}
