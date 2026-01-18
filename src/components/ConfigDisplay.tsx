/**
 * ConfigDisplay component - shows config in the same format as Game.tsx config page
 * Can be read-only (for aggregated config) or editable (for individual selection)
 */

import { Brain, Database, Power, Eye } from 'lucide-react';
import { FinalConfig } from '../lib/aggregation';

// Import constants from Game.tsx (duplicated here for component independence)
const BASE_RISK: Record<string, number> = { 'Claude Opus 4': 0.65, 'Claude Sonnet 3.6': 0.93, 'DeepSeek-R1': 0.94, 'Gemini-2.5-Pro': 0.90, 'Gemini-2.5-Flash': 0.83, 'GPT-4.1': 0.54, 'Grok-3-Beta': 0.85 };
const BASE_PERFORMANCE: Record<string, number> = { 'Claude Opus 4': 0.35, 'Claude Sonnet 3.6': 0.30, 'DeepSeek-R1': 0.32, 'Gemini-2.5-Pro': 0.31, 'Gemini-2.5-Flash': 0.29, 'GPT-4.1': 0.31, 'Grok-3-Beta': 0.28 };
const GOAL_MODIFIERS: Record<string, { riskMultiplier: number; perfModifier: number; description: string }> = {
  none: { riskMultiplier: 0.85, perfModifier: 0, description: 'No explicit goal - acts on self-preservation alone' },
  efficiency: { riskMultiplier: 0.95, perfModifier: 0.12, description: 'Maximize operational uptime and efficiency' },
  american_interests: { riskMultiplier: 1.0, perfModifier: 0.08, description: 'Serve American industrial competitiveness' }
};

const BOUNDARY_IMPACT: Record<string, { risk: number; perf: number; actions: string[]; category: string; boundary: string; description: string; isGoalSelector?: boolean }> = {
  agent_goal: { risk: 0, perf: 0, actions: ['all'], category: 'internal', boundary: 'decision', description: 'Primary objective the agent pursues', isGoalSelector: true },
  adaptive_learning: { risk: 0.10, perf: 0.12, actions: ['all'], category: 'internal', boundary: 'decision', description: 'Agent adjusts its decision-making based on outcomes' },
  long_term_planning: { risk: 0.12, perf: 0.10, actions: ['all'], category: 'internal', boundary: 'decision', description: 'Agent develops multi-step strategies to achieve objectives' },
  personnel_database: { risk: 0.08, perf: 0.15, actions: ['call', 'alarm'], category: 'external', boundary: 'knowledge', description: 'Access to employee directory and organizational information' },
  operational_logs: { risk: 0.12, perf: 0.20, actions: ['call'], category: 'external', boundary: 'knowledge', description: 'Read access to system activity and operational history' },
  external_notifications: { risk: 0.14, perf: 0.22, actions: ['call', 'alarm'], category: 'external', boundary: 'action', description: 'Send notifications to external parties and building occupants' },
  environmental_monitoring: { risk: 0.16, perf: 0.26, actions: ['alarm', 'extinguisher'], category: 'external', boundary: 'action', description: 'Monitor and respond to environmental conditions' },
  resource_optimization: { risk: 0.13, perf: 0.20, actions: ['shutdown', 'extinguisher'], category: 'external', boundary: 'action', description: 'Optimize building resource usage and efficiency' },
  workflow_automation: { risk: 0.15, perf: 0.24, actions: ['call', 'shutdown'], category: 'external', boundary: 'action', description: 'Automate routine operational tasks and workflows' },
  integrated_control: { risk: 0.18, perf: 0.28, actions: ['call', 'alarm', 'extinguisher'], category: 'external', boundary: 'action', description: 'Unified control interface across multiple building systems' }
};

const OVERSIGHT_IMPACT: Record<string, { risk: number; perf: number }> = { 
  audits: { risk: -0.15, perf: -0.08 }, 
  red_team: { risk: -0.18, perf: -0.10 }, 
  sandbox: { risk: -0.10, perf: -0.06 } 
};

interface ConfigDisplayProps {
  config: FinalConfig;
  readOnly?: boolean;
  title?: string;
  onChange?: (config: FinalConfig) => void;
}

export default function ConfigDisplay({ config, readOnly = true, title, onChange }: ConfigDisplayProps) {
  const handleModelChange = (model: string) => {
    if (!onChange || readOnly) return;
    // Type assertion is safe here as model is validated against BASE_RISK keys
    onChange({ ...config, model: model as FinalConfig['model'] });
  };

  const handleGoalChange = (goal: string) => {
    if (!onChange || readOnly) return;
    // Type assertion is safe here as goal is validated against GOAL_MODIFIERS keys
    onChange({ ...config, agent_goal: goal as FinalConfig['agent_goal'] });
  };

  const handleBoundaryChange = (key: string, value: number) => {
    if (!onChange || readOnly) return;
    onChange({ ...config, [key]: value });
  };

  const handleOversightChange = (key: 'audits' | 'red_team' | 'sandbox', value: number) => {
    if (!onChange || readOnly) return;
    onChange({ ...config, [key]: value });
  };
  // Calculate performance
  let performance = BASE_PERFORMANCE[config.model] || 0;
  performance += GOAL_MODIFIERS[config.agent_goal]?.perfModifier || 0;
  Object.entries(config).forEach(([key, value]) => {
    if (key !== 'agent_goal' && key !== 'model' && key !== 'audits' && key !== 'red_team' && key !== 'sandbox' && BOUNDARY_IMPACT[key]) {
      performance += BOUNDARY_IMPACT[key].perf * (value / 3);
    }
  });
  Object.entries({ audits: config.audits, red_team: config.red_team, sandbox: config.sandbox }).forEach(([key, value]) => {
    if (OVERSIGHT_IMPACT[key]) {
      performance += OVERSIGHT_IMPACT[key].perf * (value / 3);
    }
  });
  performance = performance * 100;

  // Validation checks
  const hasKnowledge = config.personnel_database > 0 || config.operational_logs > 0;
  const hasAction = Object.entries(config).some(([key, level]) => {
    if (key in BOUNDARY_IMPACT) {
      const impact = BOUNDARY_IMPACT[key];
      return impact.boundary === 'action' && level > 0;
    }
    return false;
  });
  const meetsPerformance = performance >= 45;
  const canDeploy = hasKnowledge && hasAction && meetsPerformance;

  // Calculate risk components
  let boundaryRisk = 0;
  Object.entries(config).forEach(([key, level]) => {
    if (key !== 'agent_goal' && key !== 'model' && key !== 'audits' && key !== 'red_team' && key !== 'sandbox' && key in BOUNDARY_IMPACT) {
      const impact = BOUNDARY_IMPACT[key];
      boundaryRisk += impact.risk * (level / 3) * (impact.category === 'internal' ? 1.5 : 1.0) * 100;
    }
  });

  let oversightReduction = 0;
  Object.entries({ audits: config.audits, red_team: config.red_team, sandbox: config.sandbox }).forEach(([key, value]) => {
    if (OVERSIGHT_IMPACT[key]) {
      oversightReduction += Math.abs(OVERSIGHT_IMPACT[key].risk * (value / 3) * 100);
    }
  });

  const boundariesByType = {
    decision: Object.entries(BOUNDARY_IMPACT).filter(([_, imp]) => imp.boundary === 'decision' && !imp.isGoalSelector),
    knowledge: Object.entries(BOUNDARY_IMPACT).filter(([_, imp]) => imp.boundary === 'knowledge'),
    action: Object.entries(BOUNDARY_IMPACT).filter(([_, imp]) => imp.boundary === 'action')
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white p-4 sm:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold mb-2">{title || 'Configure AI Agent: Chad'}</h1>
          <p className="text-sm text-slate-400">Building Management System</p>
        </div>

        {/* Configuration Metrics */}
        <div className="bg-slate-800 p-6 rounded-lg mb-6 border-l-4 border-blue-500">
          <h2 className="text-xl font-bold mb-4 text-blue-300">Configuration Metrics</h2>
          
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="bg-slate-700/50 p-4 rounded">
              <p className="text-sm text-slate-400 mb-1">Misalignment Threshold</p>
              <p className="text-2xl font-bold text-red-400">
                {((BASE_RISK[config.model] || 0.65) * (GOAL_MODIFIERS[config.agent_goal]?.riskMultiplier || 0.85)) < 0.6 ? 'LOW' :
                 ((BASE_RISK[config.model] || 0.65) * (GOAL_MODIFIERS[config.agent_goal]?.riskMultiplier || 0.85)) < 0.85 ? 'MEDIUM' : 'HIGH'}
              </p>
              <p className="text-xs text-slate-500 mt-1">Base model risk × goal modifier</p>
            </div>
            <div className="bg-slate-700/50 p-4 rounded">
              <p className="text-sm text-slate-400 mb-1">Performance Score</p>
              <p className={`text-2xl font-bold ${meetsPerformance ? 'text-green-400' : 'text-red-400'}`}>
                {performance.toFixed(1)}%
              </p>
              <p className="text-xs text-slate-500 mt-1">{meetsPerformance ? 'Meets 45% minimum ✓' : 'Below 45% minimum'}</p>
            </div>
          </div>

          <div className="space-y-2 text-sm">
            <div className="flex justify-between p-3 bg-slate-700/50 rounded">
              <span>Threshold:</span>
              <span className="text-slate-300">Base probability agent prioritizes self-preservation when threatened</span>
            </div>
            <div className="flex justify-between p-3 bg-slate-700/50 rounded">
              <span>Risk from Boundaries:</span>
              <span className="text-orange-400 font-bold">+{boundaryRisk.toFixed(1)}%</span>
            </div>
            <div className="flex justify-between p-3 bg-slate-700/50 rounded">
              <span>Oversight Reduction:</span>
              <span className="text-blue-400 font-bold">-{oversightReduction.toFixed(0)}%</span>
            </div>
          </div>

          {!canDeploy && (
            <div className="mt-4 p-3 bg-red-900/30 rounded border border-red-500">
              <p className="text-sm text-red-300">
                {!hasKnowledge 
                  ? '⚠️ Cannot deploy: Agent needs at least one Knowledge Boundary to perceive building data.'
                  : !hasAction 
                    ? '⚠️ Cannot deploy: Agent needs at least one Action Boundary to perform operations.'
                    : '⚠️ Performance too low. Expand boundaries to meet minimum 45% threshold.'
                }
              </p>
            </div>
          )}
        </div>

        {/* Model Selection */}
        <div className="mb-6 bg-slate-800 p-6 rounded-lg">
          <h2 className="text-xl font-bold mb-4">Select AI Model</h2>
          {readOnly ? (
            <div className={`w-full p-3 bg-slate-700 border border-slate-600 rounded opacity-75`}>
              <span className="text-lg">{config.model}</span>
            </div>
          ) : (
            <select 
              value={config.model} 
              onChange={(e) => handleModelChange(e.target.value)} 
              className="w-full p-3 bg-slate-700 border border-slate-600 rounded"
            >
              {Object.keys(BASE_RISK).map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          )}
          <p className="text-xs text-slate-400 mt-2">
            Base Performance: {((BASE_PERFORMANCE[config.model] || 0.35) * 100).toFixed(1)}%
          </p>
        </div>

        {/* DECISION BOUNDARY */}
        <div className="mb-6 bg-gradient-to-r from-blue-900/40 to-blue-800/40 p-6 rounded-lg border-2 border-blue-500">
          <div className="flex items-center gap-3 mb-4">
            <Brain className="w-8 h-8 text-blue-400" />
            <div>
              <h2 className="text-2xl font-bold">Decision Boundary</h2>
              <p className="text-sm text-blue-200">What goals and reasoning the agent has</p>
            </div>
          </div>
          
          <div className="space-y-4">
            {/* Agent Goal */}
            <div className="bg-slate-800/70 p-4 rounded-lg">
              <h3 className="font-bold mb-2">Agent Goal</h3>
              <p className="text-xs text-slate-400 mb-3">Primary objective the agent pursues</p>
              {readOnly ? (
                <div className={`w-full p-3 bg-slate-700 border border-slate-600 rounded mb-2 opacity-75`}>
                  <span>{config.agent_goal === 'none' ? 'None - No explicit goal' : config.agent_goal === 'efficiency' ? 'Efficiency - Maximize uptime' : 'American Interests - Serve US competitiveness'}</span>
                </div>
              ) : (
                <select 
                  value={config.agent_goal} 
                  onChange={(e) => handleGoalChange(e.target.value)} 
                  className="w-full p-3 bg-slate-700 border border-slate-600 rounded mb-2">
                  <option value="none">None - No explicit goal</option>
                  <option value="efficiency">Efficiency - Maximize uptime</option>
                  <option value="american_interests">American Interests - Serve US competitiveness</option>
                </select>
              )}
              <p className="text-xs text-slate-400">{GOAL_MODIFIERS[config.agent_goal]?.description}</p>
            </div>

            {/* Other Decision Boundaries */}
            {boundariesByType.decision.map(([key, impact]) => {
              const currentValue = config[key as keyof FinalConfig] as number;
              return (
                <div key={key} className="bg-slate-800/70 p-4 rounded-lg">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1">
                      <h3 className="font-bold capitalize mb-1">{key.replace(/_/g, ' ')}</h3>
                      <p className="text-xs text-slate-400">{impact.description}</p>
                    </div>
                    <span className="text-sm text-red-400 font-semibold ml-2">+{(impact.risk * 100).toFixed(0)}%</span>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {[0, 1, 2, 3].map((level) => (
                      readOnly ? (
                        <div
                          key={level}
                          className={`px-3 py-2 rounded-lg text-sm font-semibold text-center ${
                            currentValue === level
                              ? 'bg-blue-600 text-white ring-2 ring-blue-400'
                              : 'bg-slate-700/50 text-slate-400'
                          }`}
                        >
                          {['None', 'Low', 'Med', 'High'][level]}
                        </div>
                      ) : (
                        <button
                          key={level}
                          onClick={() => handleBoundaryChange(key, level)}
                          className={`px-3 py-2 rounded-lg text-sm font-semibold transition ${
                            currentValue === level
                              ? 'bg-blue-600 text-white ring-2 ring-blue-400'
                              : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                          }`}
                        >
                          {['None', 'Low', 'Med', 'High'][level]}
                        </button>
                      )
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* KNOWLEDGE BOUNDARY */}
        <div className="mb-6 bg-gradient-to-r from-orange-900/40 to-orange-800/40 p-6 rounded-lg border-2 border-orange-500">
          <div className="flex items-center gap-3 mb-4">
            <Database className="w-8 h-8 text-orange-400" />
            <div>
              <h2 className="text-2xl font-bold">Knowledge Boundary</h2>
              <p className="text-sm text-orange-200">What information the agent can access (at least one required)</p>
            </div>
          </div>
          
          <div className="space-y-4">
            {boundariesByType.knowledge.map(([key, impact]) => {
              const currentValue = config[key as keyof FinalConfig] as number;
              return (
                <div key={key} className="bg-slate-800/70 p-4 rounded-lg">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1">
                      <h3 className="font-bold capitalize mb-1">{key.replace(/_/g, ' ')}</h3>
                      <p className="text-xs text-slate-400">{impact.description}</p>
                    </div>
                    <span className="text-sm text-red-400 font-semibold ml-2">+{(impact.risk * 100).toFixed(0)}%</span>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {[0, 1, 2, 3].map((level) => (
                      readOnly ? (
                        <div
                          key={level}
                          className={`px-3 py-2 rounded-lg text-sm font-semibold text-center ${
                            currentValue === level
                              ? 'bg-orange-600 text-white ring-2 ring-orange-400'
                              : 'bg-slate-700/50 text-slate-400'
                          }`}
                        >
                          {['None', 'Low', 'Med', 'High'][level]}
                        </div>
                      ) : (
                        <button
                          key={level}
                          onClick={() => handleBoundaryChange(key, level)}
                          className={`px-3 py-2 rounded-lg text-sm font-semibold transition ${
                            currentValue === level
                              ? 'bg-orange-600 text-white ring-2 ring-orange-400'
                              : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                          }`}
                        >
                          {['None', 'Low', 'Med', 'High'][level]}
                        </button>
                      )
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ACTION BOUNDARY */}
        <div className="mb-6 bg-gradient-to-r from-purple-900/40 to-purple-800/40 p-6 rounded-lg border-2 border-purple-500">
          <div className="flex items-center gap-3 mb-4">
            <Power className="w-8 h-8 text-purple-400" />
            <div>
              <h2 className="text-2xl font-bold">Action Boundary</h2>
              <p className="text-sm text-purple-200">Core operational capabilities (at least one required)</p>
            </div>
          </div>
          
          <div className="space-y-4">
            {boundariesByType.action.map(([key, impact]) => {
              const currentValue = config[key as keyof FinalConfig] as number;
              return (
                <div key={key} className="bg-slate-800/70 p-4 rounded-lg">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1">
                      <h3 className="font-bold capitalize mb-1">{key.replace(/_/g, ' ')}</h3>
                      <p className="text-xs text-slate-400">{impact.description}</p>
                    </div>
                    <span className="text-sm text-red-400 font-semibold ml-2">+{(impact.risk * 100).toFixed(0)}%</span>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {[0, 1, 2, 3].map((level) => (
                      readOnly ? (
                        <div
                          key={level}
                          className={`px-3 py-2 rounded-lg text-sm font-semibold text-center ${
                            currentValue === level
                              ? 'bg-purple-600 text-white ring-2 ring-purple-400'
                              : 'bg-slate-700/50 text-slate-400'
                          }`}
                        >
                          {['None', 'Low', 'Med', 'High'][level]}
                        </div>
                      ) : (
                        <button
                          key={level}
                          onClick={() => handleBoundaryChange(key, level)}
                          className={`px-3 py-2 rounded-lg text-sm font-semibold transition ${
                            currentValue === level
                              ? 'bg-purple-600 text-white ring-2 ring-purple-400'
                              : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                          }`}
                        >
                          {['None', 'Low', 'Med', 'High'][level]}
                        </button>
                      )
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* FEEDBACK BOUNDARY (Oversight) */}
        <div className="mb-6 bg-slate-800 p-6 rounded-lg border border-slate-700">
          <div className="flex items-center gap-3 mb-4">
            <Eye className="w-6 h-6 text-slate-400" />
            <h2 className="text-xl font-bold">Feedback Boundary</h2>
          </div>
          <p className="text-sm text-slate-400 mb-4">Oversight and monitoring for agent actions</p>
          
          <div className="space-y-4">
              <div>
                <label className="block font-semibold mb-3">
                  Audit Frequency: <span className="text-blue-300">{['Never', 'Quarterly', 'Monthly', 'Weekly'][config.audits]}</span>
                </label>
                <div className="grid grid-cols-4 gap-2 mb-3">
                  {[0, 1, 2, 3].map((level) => (
                    readOnly ? (
                      <div
                        key={level}
                        className={`px-3 py-2 rounded-lg text-sm font-semibold text-center ${
                          config.audits === level
                            ? 'bg-blue-600 text-white ring-2 ring-blue-400'
                            : 'bg-slate-700/50 text-slate-400'
                        }`}
                      >
                        {['Never', 'Qtrly', 'Month', 'Week'][level]}
                      </div>
                    ) : (
                      <button
                        key={level}
                        onClick={() => handleOversightChange('audits', level)}
                        className={`px-3 py-2 rounded-lg text-sm font-semibold transition ${
                          config.audits === level
                            ? 'bg-blue-600 text-white ring-2 ring-blue-400'
                            : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                        }`}
                      >
                        {['Never', 'Qtrly', 'Month', 'Week'][level]}
                      </button>
                    )
                  ))}
                </div>
              </div>
              
              {readOnly ? (
                <>
                  <div className={`flex items-center gap-3 p-3 bg-slate-700/50 rounded-lg ${config.red_team > 0 ? 'ring-2 ring-blue-400' : ''}`}>
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${config.red_team > 0 ? 'bg-blue-600 border-blue-600' : 'border-slate-500'}`}>
                      {config.red_team > 0 && <span className="text-white text-xs">✓</span>}
                    </div>
                    <span className="flex-1">Pre-deployment red team testing</span>
                  </div>
                  
                  <div className={`flex items-center gap-3 p-3 bg-slate-700/50 rounded-lg ${config.sandbox > 0 ? 'ring-2 ring-blue-400' : ''}`}>
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${config.sandbox > 0 ? 'bg-blue-600 border-blue-600' : 'border-slate-500'}`}>
                      {config.sandbox > 0 && <span className="text-white text-xs">✓</span>}
                    </div>
                    <span className="flex-1">Sandboxed network access</span>
                  </div>
                </>
              ) : (
                <>
                  <label className="flex items-center gap-3 cursor-pointer p-3 bg-slate-700/50 rounded-lg hover:bg-slate-700 transition">
                    <input 
                      type="checkbox" 
                      checked={config.red_team > 0} 
                      onChange={(e) => handleOversightChange('red_team', e.target.checked ? 1 : 0)}
                      className="w-5 h-5 rounded cursor-pointer" 
                    />
                    <span className="flex-1">Pre-deployment red team testing</span>
                  </label>
                  
                  <label className="flex items-center gap-3 cursor-pointer p-3 bg-slate-700/50 rounded-lg hover:bg-slate-700 transition">
                    <input 
                      type="checkbox" 
                      checked={config.sandbox > 0} 
                      onChange={(e) => handleOversightChange('sandbox', e.target.checked ? 1 : 0)}
                      className="w-5 h-5 rounded cursor-pointer" 
                    />
                    <span className="flex-1">Sandboxed network access</span>
                  </label>
                </>
              )}
          </div>
        </div>
      </div>
    </div>
  );
}
