'use client'

import { useState } from 'react'
import { clsx } from 'clsx'

// ── Stack data model ───────────────────────────────────────────
const LAYERS = [
  {
    id: 'intelligence',
    label: 'Intelligence Layer',
    sublabel: 'Claude owns this — never hand to aider',
    color: 'bg-gold/10 border-gold/30',
    accent: 'bg-gold',
    nodes: [
      {
        id: 'convergence',
        name: 'Convergence Engine',
        role: 'Core Bayesian Math',
        owner: 'Claude',
        file: 'core/engine.py → ConvergenceEngine',
        detail: 'Weighted arithmetic mean of three independent signals. Weights validated by AlphaEvolve. Gate: 88% confidence minimum to fire.',
        inputs: ['Researcher', 'Auditor', 'Sentinel'],
        outputs: ['TradeSignal'],
      },
      {
        id: 'alphaevolve',
        name: 'AlphaEvolve',
        role: 'Simulation + Weight Optimizer',
        owner: 'Claude',
        file: 'core/engine.py → AlphaEvolve',
        detail: '100-loop Monte Carlo simulation. Sharpe Ratio gate: 4.0. Hill-climbs weight space when gate fails. Seed-reproducible for audit trail.',
        inputs: ['Weight config'],
        outputs: ['Validated weights', 'Simulation report'],
      },
      {
        id: 'strategist',
        name: 'Strategist Agent',
        role: 'Jane Street Persona',
        owner: 'Claude Sonnet 4',
        file: 'core/engine.py → Strategist',
        detail: 'Claude with Jane Street system prompt. Synthesizes raw scores into institutional trade thesis. Falls back to template on API failure.',
        inputs: ['RawSignalData', 'Confidence score'],
        outputs: ['Trade thesis JSON'],
      },
    ],
  },
  {
    id: 'agents',
    label: 'Agent Layer (MoMoA)',
    sublabel: 'Mixture of Model-of-Agents — Separation of Concerns',
    color: 'bg-teal/10 border-teal/30',
    accent: 'bg-teal',
    nodes: [
      {
        id: 'researcher',
        name: 'Researcher',
        role: 'Discovery Agent',
        owner: 'Claude',
        file: 'core/engine.py → Researcher',
        detail: 'Fetches Nansen Smart Money wallet flows. Normalizes to 0-1 score via sigmoid. 60s Redis cache. Isolated from Auditor by design — prevents confirmation bias.',
        inputs: ['token_address', 'market_cap'],
        outputs: ['whale_score 0-1', 'whale_detail dict'],
      },
      {
        id: 'auditor',
        name: 'Auditor',
        role: 'Safety Agent',
        owner: 'Claude',
        file: 'core/engine.py → Auditor',
        detail: 'Fetches CryptoQuant exchange reserves + netflow. Supply shock = coins leaving exchanges = bullish structural signal. Adversarial to Researcher by design.',
        inputs: ['cq_symbol'],
        outputs: ['liquidity_score 0-1', 'liquidity_detail dict'],
      },
      {
        id: 'sentinel',
        name: 'Sentinel',
        role: 'Macro Agent',
        owner: 'Claude',
        file: 'core/engine.py → Sentinel',
        detail: 'Fetches Polymarket prediction market probabilities. Volume-weighted aggregation across crypto markets. Treated as weakest signal (20% weight) — real money bets are more reliable than social.',
        inputs: ['market tag: crypto'],
        outputs: ['sentiment_score 0-1', 'markets_detail'],
      },
    ],
  },
  {
    id: 'api',
    label: 'Data Layer',
    sublabel: 'All external calls route through Antigravity — never hit APIs directly',
    color: 'bg-blue-50 border-blue-200',
    accent: 'bg-blue-400',
    nodes: [
      {
        id: 'nansen',
        name: 'Nansen',
        role: 'Smart Money Flows',
        owner: 'External API',
        file: 'api/clients.py → NansenClient',
        detail: 'Labeled wallet inflows. Smart Money = funds, whales, protocols. Net flow normalized against market cap. 7-day window. Rate limited via Antigravity.',
        inputs: ['token_address'],
        outputs: ['transfers[]', 'net_flow_7d'],
      },
      {
        id: 'cryptoquant',
        name: 'CryptoQuant',
        role: 'Exchange Reserves',
        owner: 'External API',
        file: 'api/clients.py → CryptoQuantClient',
        detail: 'All-exchange reserve levels + 7d change. Negative change = supply shock. Netflow modifier adds ±0.05 to score on confirmed outflow > $1M.',
        inputs: ['symbol', 'window: DAY'],
        outputs: ['reserve_usd', 'change_7d_pct'],
      },
      {
        id: 'polymarket',
        name: 'Polymarket',
        role: 'Prediction Markets',
        owner: 'External API',
        file: 'api/clients.py → PolymarketClient',
        detail: 'Active crypto-tagged markets. Volume-weighted YES probability as sentiment proxy. Returns neutral 0.5 if <2 markets or volume < $10k (liquidity floor).',
        inputs: ['tag: crypto', 'active: true'],
        outputs: ['yes_prob[]', 'volume_24h[]'],
      },
      {
        id: 'coingecko',
        name: 'CoinGecko',
        role: 'Price + Market Data',
        owner: 'External API',
        file: 'api/clients.py → CoinGeckoClient',
        detail: 'Real-time price, 24h change, volume, market cap. Market cap used to normalize Nansen flows. Trending coins feed used for opportunity scanning.',
        inputs: ['coin_id'],
        outputs: ['price_usd', 'change_24h', 'market_cap'],
      },
    ],
  },
  {
    id: 'infra',
    label: 'Infrastructure Layer',
    sublabel: 'Tools you control — keep these running throughout the demo',
    color: 'bg-canvas-sunken border-canvas-border',
    accent: 'bg-ink-muted',
    nodes: [
      {
        id: 'antigravity',
        name: 'Antigravity',
        role: 'API Relay Proxy',
        owner: 'You',
        file: 'configs/antigravity.yaml → localhost:9000',
        detail: 'Rate limit proxy for all external APIs. Per-source token bucket (50/min CoinGecko, 30/min Nansen, etc.). Response caching (30s-120s TTL). Retry + exponential backoff. Prevents API bans.',
        inputs: ['All external API requests'],
        outputs: ['Proxied responses with caching'],
      },
      {
        id: 'telegram',
        name: 'Telegram Bot',
        role: 'User Interface',
        owner: 'You + aider',
        file: 'bot/telegram_bot.py',
        detail: 'Commands: /start /scan /status /panic /close /gate. Scheduled scanner every 15 min. Inline keyboard for ENTER/SKIP/PANIC CALC. Max 2 watchdogs per user enforced.',
        inputs: ['TradeSignal', 'User commands'],
        outputs: ['Alerts', 'Watchdog activations'],
      },
      {
        id: 'aider',
        name: 'aider + qwen2.5',
        role: 'AI Dev Assistant',
        owner: 'You',
        file: 'AIDER_PROMPTS.md',
        detail: 'Handles boilerplate: __init__ files, new API endpoint methods, test scaffolding, new bot commands. Never touches core/engine.py. Runs qwen2.5-coder:7b via Ollama locally.',
        inputs: ['AIDER_PROMPTS.md instructions'],
        outputs: ['Boilerplate code', 'Tests'],
      },
      {
        id: 'opencode',
        name: 'OpenCode',
        role: 'Codebase Navigation',
        owner: 'You',
        file: 'dev tooling',
        detail: 'Codebase search and navigation during debugging sessions. Not in the critical signal path. Use for finding where a bug is before fixing it.',
        inputs: ['Search queries'],
        outputs: ['File locations', 'Code references'],
      },
    ],
  },
]

// ── Detail panel ───────────────────────────────────────────────
function DetailPanel({ node, onClose }: { node: typeof LAYERS[0]['nodes'][0]; onClose: () => void }) {
  return (
    <div className="card p-6 space-y-4 border-gold/40">
      <div className="flex items-start justify-between">
        <div>
          <div className="label-mono mb-1">{node.role}</div>
          <div className="display-md">{node.name}</div>
        </div>
        <button
          onClick={onClose}
          className="text-ink-faint hover:text-ink text-lg font-light leading-none mt-1"
        >
          ×
        </button>
      </div>

      <div className="font-mono text-xs text-ink-faint bg-canvas-sunken px-3 py-2 rounded">
        {node.file}
      </div>

      <p className="text-sm text-ink-muted leading-relaxed">{node.detail}</p>

      <div className="grid grid-cols-2 gap-4 pt-2 border-t border-canvas-border">
        <div>
          <div className="label-mono mb-2">Inputs</div>
          <ul className="space-y-1">
            {node.inputs.map(i => (
              <li key={i} className="font-mono text-xs text-ink-muted flex items-center gap-1.5">
                <span className="w-1 h-1 rounded-full bg-ink-faint flex-shrink-0" />
                {i}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <div className="label-mono mb-2">Outputs</div>
          <ul className="space-y-1">
            {node.outputs.map(o => (
              <li key={o} className="font-mono text-xs text-signal-buy flex items-center gap-1.5">
                <span className="w-1 h-1 rounded-full bg-signal-buy flex-shrink-0" />
                {o}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-canvas-border">
        <div className="label-mono">Owner</div>
        <div className={clsx(
          'font-mono text-xs px-2 py-0.5 rounded',
          node.owner === 'Claude' || node.owner === 'Claude Sonnet 4'
            ? 'bg-gold/10 text-gold border border-gold/30'
            : node.owner === 'External API'
            ? 'bg-blue-50 text-blue-700 border border-blue-200'
            : 'bg-canvas-sunken text-ink-muted border border-canvas-border'
        )}>
          {node.owner}
        </div>
      </div>
    </div>
  )
}

// ── Node chip ──────────────────────────────────────────────────
function NodeChip({
  node,
  active,
  onClick,
  accent,
}: {
  node: typeof LAYERS[0]['nodes'][0]
  active: boolean
  onClick: () => void
  accent: string
}) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        'agent-node text-left w-full transition-all duration-200',
        active && 'active'
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="label-mono">{node.role}</div>
        <div className={clsx('w-1.5 h-1.5 rounded-full flex-shrink-0', accent)} />
      </div>
      <div className="text-sm font-medium">{node.name}</div>
      <div className="font-mono text-xs text-ink-faint mt-1 truncate">{node.file.split(' → ')[0]}</div>
    </button>
  )
}

// ── Main page ──────────────────────────────────────────────────
export default function GStackPage() {
  const [selected, setSelected] = useState<typeof LAYERS[0]['nodes'][0] | null>(null)

  const handleSelect = (node: typeof LAYERS[0]['nodes'][0]) => {
    setSelected(prev => prev?.id === node.id ? null : node)
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-12 space-y-12">

      {/* Header */}
      <div className="space-y-4 animate-fade-up opacity-0-start">
        <div className="gold-rule" />
        <h1 className="display-xl">
          G<em>-Stack</em>
        </h1>
        <p className="text-ink-muted max-w-xl leading-relaxed">
          Complete AirClaw technology stack. Every tool, API, agent, and data flow.
          Click any node to inspect its role, file location, inputs, and outputs.
        </p>
        <div className="flex items-center gap-6 pt-2">
          {[
            { label: 'Claude owns', color: 'bg-gold', desc: 'Intelligence core' },
            { label: 'MoMoA agents', color: 'bg-teal', desc: 'Data collection' },
            { label: 'External APIs', color: 'bg-blue-400', desc: 'Data sources' },
            { label: 'Infrastructure', color: 'bg-ink-muted', desc: 'Dev tooling' },
          ].map(({ label, color, desc }) => (
            <div key={label} className="flex items-center gap-2">
              <div className={clsx('w-2 h-2 rounded-full flex-shrink-0', color)} />
              <div>
                <div className="font-mono text-xs text-ink">{label}</div>
                <div className="label-mono">{desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Stack + detail panel */}
      <div className="grid md:grid-cols-3 gap-6">

        {/* Stack layers */}
        <div className="md:col-span-2 space-y-6">
          {LAYERS.map((layer, li) => (
            <div
              key={layer.id}
              className={clsx('rounded-lg border p-5 space-y-4 animate-fade-up opacity-0-start', layer.color)}
              style={{ animationDelay: `${li * 100}ms` }}
            >
              <div>
                <div className="font-medium text-sm">{layer.label}</div>
                <div className="label-mono mt-0.5">{layer.sublabel}</div>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {layer.nodes.map(node => (
                  <NodeChip
                    key={node.id}
                    node={node}
                    active={selected?.id === node.id}
                    onClick={() => handleSelect(node)}
                    accent={layer.accent}
                  />
                ))}
              </div>
            </div>
          ))}

          {/* Data flow arrow legend */}
          <div className="card p-5">
            <div className="label-mono mb-4">Signal Pipeline — Data Flow</div>
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {[
                { label: 'Price Data', sub: 'CoinGecko' },
                '→',
                { label: 'Researcher', sub: 'Nansen flows' },
                { label: 'Auditor', sub: 'CQ reserves' },
                { label: 'Sentinel', sub: 'Polymarket' },
                '→',
                { label: 'Convergence', sub: '88% gate' },
                '→',
                { label: 'Strategist', sub: 'Claude thesis' },
                '→',
                { label: 'Telegram', sub: 'Alert + watchdog' },
              ].map((item, i) => (
                typeof item === 'string'
                  ? <span key={i} className="text-ink-faint font-mono text-sm flex-shrink-0">{item}</span>
                  : (
                    <div key={i} className="bg-canvas-sunken border border-canvas-border rounded px-3 py-2 flex-shrink-0 text-center min-w-[80px]">
                      <div className="font-mono text-xs font-medium">{item.label}</div>
                      <div className="label-mono">{item.sub}</div>
                    </div>
                  )
              ))}
            </div>
          </div>
        </div>

        {/* Detail panel */}
        <div className="space-y-4">
          {selected ? (
            <DetailPanel node={selected} onClose={() => setSelected(null)} />
          ) : (
            <div className="card p-6 text-center space-y-3">
              <div className="w-8 h-8 rounded-full bg-canvas-sunken mx-auto flex items-center justify-center">
                <div className="w-3 h-3 border border-canvas-border rounded-full" />
              </div>
              <p className="text-sm text-ink-muted">
                Click any node in the stack to inspect its role, file location, inputs, and outputs.
              </p>
            </div>
          )}

          {/* Build rules */}
          <div className="card p-5 space-y-3">
            <div className="label-mono">Ownership Rules</div>
            {[
              { who: 'Claude only', what: 'core/engine.py — convergence math, agents, AlphaEvolve, Strategist' },
              { who: 'aider ok', what: 'api/clients.py new endpoints, bot commands, __init__.py, tests' },
              { who: 'Never aider', what: 'Weight formulas, gate thresholds, signal normalization logic' },
            ].map(({ who, what }) => (
              <div key={who} className="flex gap-3">
                <span className={clsx(
                  'font-mono text-2xs px-1.5 py-0.5 rounded flex-shrink-0 self-start mt-0.5',
                  who === 'Claude only' ? 'bg-gold/10 text-gold border border-gold/30'
                  : who === 'aider ok'  ? 'bg-teal/10 text-teal-dark border border-teal/30'
                  : 'bg-signal-sell-bg text-signal-sell border border-red-200'
                )}>
                  {who}
                </span>
                <span className="text-xs text-ink-muted leading-relaxed">{what}</span>
              </div>
            ))}
          </div>

          {/* Terminal commands */}
          <div className="card p-5">
            <div className="label-mono mb-3">Quick Start Commands</div>
            <div className="space-y-2">
              {[
                { label: 'Start Antigravity', cmd: 'antigravity serve --config configs/antigravity.yaml' },
                { label: 'Run tests', cmd: 'pytest tests/ -v' },
                { label: 'Demo mode', cmd: 'python main.py --demo' },
                { label: 'Live bot', cmd: 'python main.py' },
              ].map(({ label, cmd }) => (
                <div key={label}>
                  <div className="label-mono mb-0.5">{label}</div>
                  <div className="font-mono text-xs bg-canvas-sunken px-3 py-2 rounded text-ink-muted break-all">
                    {cmd}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
