'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { clsx } from 'clsx'

// ── Ticker data ──────────────────────────────────────────────
const TICKER_ITEMS = [
  { symbol: 'BTC/USDT', price: '67,420.50', change: '+2.34%', up: true },
  { symbol: 'ETH/USDT', price: '3,512.80',  change: '+1.87%', up: true },
  { symbol: 'ZRO/USDT', price: '4.50',      change: '+5.12%', up: true },
  { symbol: 'SOL/USDT', price: '178.30',    change: '-0.94%', up: false },
  { symbol: 'ARB/USDT', price: '1.24',      change: '+3.21%', up: true },
  { symbol: 'OP/USDT',  price: '2.87',      change: '-1.10%', up: false },
  { symbol: 'AVAX/USDT', price: '38.50',    change: '+0.88%', up: true },
  { symbol: 'LINK/USDT', price: '18.20',    change: '+4.40%', up: true },
]

// ── Signal data (simulated) ───────────────────────────────────
const SIGNALS = [
  {
    symbol: 'ZRO/USDT',
    action: 'BUY',
    confidence: 92.4,
    price: 4.50,
    target1: 5.27,
    target2: 5.85,
    stop: 4.14,
    rr: 2.1,
    whale: 0.95,
    liquidity: 0.92,
    sentiment: 0.88,
    thesis: 'Total Eclipse event confirmed. Jump Crypto + DeFiance accumulating. Supply shock -8.3%.',
    time: '14:32:07',
  },
]

// ── Metric card ────────────────────────────────────────────────
function MetricCard({ label, value, sub, accent = false }: {
  label: string; value: string; sub?: string; accent?: boolean
}) {
  return (
    <div className={clsx(
      'card p-5 flex flex-col gap-2 animate-fade-up opacity-0-start',
      accent && 'border-gold/40'
    )}>
      <div className="label-mono">{label}</div>
      <div className={clsx(
        'score-display text-3xl font-semibold',
        accent ? 'text-gold' : 'text-ink'
      )}>
        {value}
      </div>
      {sub && <div className="text-xs text-ink-muted font-mono">{sub}</div>}
    </div>
  )
}

// ── Score bar ──────────────────────────────────────────────────
function ScoreBar({ label, score, color }: { label: string; score: number; color: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="label-mono w-20 flex-shrink-0">{label}</span>
      <div className="flex-1 h-1.5 bg-canvas-sunken rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-1000"
          style={{ width: `${score * 100}%`, background: color }}
        />
      </div>
      <span className="score-display text-xs w-10 text-right text-ink-muted">
        {(score * 100).toFixed(0)}%
      </span>
    </div>
  )
}

// ── Signal card ────────────────────────────────────────────────
function SignalCard({ signal }: { signal: typeof SIGNALS[0] }) {
  const pctT1 = ((signal.target1 / signal.price) - 1) * 100
  const pctT2 = ((signal.target2 / signal.price) - 1) * 100
  const pctSL = ((signal.stop   / signal.price) - 1) * 100

  return (
    <div className="card card-hover p-6 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="badge-buy">BUY</span>
            <span className="font-mono text-xs text-ink-faint">{signal.time}</span>
          </div>
          <div className="font-mono text-xl font-semibold tabular">{signal.symbol}</div>
        </div>
        <div className="text-right">
          <div className="label-mono mb-1">Confidence</div>
          <div className="score-display text-3xl font-semibold text-gold">
            {signal.confidence.toFixed(1)}%
          </div>
        </div>
      </div>

      {/* Price levels */}
      <div className="grid grid-cols-4 gap-3 py-4 border-t border-b border-canvas-border">
        {[
          { label: 'Entry', value: `$${signal.price.toFixed(2)}`, color: 'text-ink' },
          { label: 'Target 1', value: `$${signal.target1.toFixed(2)}`, pct: `+${pctT1.toFixed(1)}%`, color: 'text-signal-buy' },
          { label: 'Target 2', value: `$${signal.target2.toFixed(2)}`, pct: `+${pctT2.toFixed(1)}%`, color: 'text-signal-buy' },
          { label: 'Stop Loss', value: `$${signal.stop.toFixed(2)}`, pct: `${pctSL.toFixed(1)}%`, color: 'text-signal-sell' },
        ].map(({ label, value, pct, color }) => (
          <div key={label} className="text-center">
            <div className="label-mono mb-1">{label}</div>
            <div className={clsx('font-mono text-sm font-medium tabular', color)}>{value}</div>
            {pct && <div className={clsx('font-mono text-xs tabular', color)}>{pct}</div>}
          </div>
        ))}
      </div>

      {/* Convergence scores */}
      <div className="space-y-2.5">
        <div className="label-mono mb-3">Convergence Signals</div>
        <ScoreBar label="Whale"     score={signal.whale}     color="#1D9E75" />
        <ScoreBar label="Liquidity" score={signal.liquidity} color="#B8860B" />
        <ScoreBar label="Sentiment" score={signal.sentiment} color="#185FA5" />
      </div>

      {/* Thesis */}
      <div className="bg-canvas-sunken rounded p-3">
        <div className="label-mono mb-1.5">Thesis</div>
        <p className="text-xs text-ink-muted font-mono leading-relaxed">{signal.thesis}</p>
      </div>

      {/* R:R */}
      <div className="flex items-center justify-between text-xs font-mono">
        <span className="text-ink-muted">Risk/Reward</span>
        <span className="font-semibold text-ink tabular">{signal.rr}:1</span>
      </div>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────
export default function HomePage() {
  const [time, setTime] = useState('')
  const [gateStatus, setGateStatus] = useState({ sharpe: 4.7, passed: true })

  useEffect(() => {
    const tick = () => setTime(new Date().toLocaleTimeString('en-US', { hour12: false }))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="grid-bg min-h-screen">
      {/* Ticker */}
      <div className="ticker-wrap py-2">
        <div className="ticker-inner">
          {[...TICKER_ITEMS, ...TICKER_ITEMS].map((item, i) => (
            <span key={i} className="inline-flex items-center gap-2 px-6 font-mono text-xs">
              <span className="text-ink-muted">{item.symbol}</span>
              <span className="tabular font-medium">{item.price}</span>
              <span className={clsx('tabular', item.up ? 'text-signal-buy' : 'text-signal-sell')}>
                {item.change}
              </span>
              <span className="text-canvas-border">·</span>
            </span>
          ))}
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-12 space-y-12">

        {/* Hero */}
        <div className="space-y-4 animate-fade-up opacity-0-start">
          <div className="gold-rule" />
          <h1 className="display-xl">
            Institutional<br />
            <em>Intelligence</em> Engine
          </h1>
          <p className="text-ink-muted max-w-xl leading-relaxed">
            Jane Street architecture. Multi-agent convergence. Three independent signals —
            whale intent, exchange plumbing, macro sentiment — synthesized into a single
            high-confidence trade thesis.
          </p>
          <div className="flex items-center gap-4 pt-2">
            <Link
              href="/gstack"
              className="bg-ink text-canvas px-5 py-2.5 rounded text-sm font-medium hover:bg-ink-soft transition-colors"
            >
              View G-Stack
            </Link>
            <Link
              href="/design-consultation"
              className="border border-canvas-border px-5 py-2.5 rounded text-sm font-medium text-ink-muted hover:text-ink hover:border-gold transition-colors"
            >
              Design Consultation
            </Link>
            <span className="font-mono text-xs text-ink-faint tabular">{time}</span>
          </div>
        </div>

        {/* Metrics row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricCard label="Sharpe Ratio"    value={gateStatus.sharpe.toFixed(1)} sub="AlphaEvolve gate: 4.0" accent />
          <MetricCard label="Gate Status"     value={gateStatus.passed ? 'PASSED' : 'EVOLVING'} sub="100-loop simulation" />
          <MetricCard label="Signal Gate"     value="88.0%" sub="Minimum confidence" />
          <MetricCard label="Active Watchdogs" value="1 / 2" sub="Max 2 per user" />
        </div>

        {/* Signals + System status */}
        <div className="grid md:grid-cols-3 gap-6">

          {/* Signals — 2/3 width */}
          <div className="md:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="display-md">Live Signals</h2>
              <div className="status-live">1 Active</div>
            </div>
            {SIGNALS.map((s, i) => <SignalCard key={i} signal={s} />)}
          </div>

          {/* System status — 1/3 width */}
          <div className="space-y-4">
            <h2 className="display-md">System Status</h2>

            {/* Agent status cards */}
            {[
              { name: 'Researcher',  desc: 'Nansen / whale intent',     status: 'live' },
              { name: 'Auditor',     desc: 'CryptoQuant / reserves',    status: 'live' },
              { name: 'Sentinel',    desc: 'Polymarket / sentiment',    status: 'live' },
              { name: 'Strategist',  desc: 'Claude Sonnet / thesis',    status: 'live' },
              { name: 'Antigravity', desc: 'API relay proxy :9000',     status: 'live' },
              { name: 'Telegram',    desc: 'Bot polling / alerts',      status: 'live' },
            ].map(({ name, desc, status }) => (
              <div key={name} className="card p-4 flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium">{name}</div>
                  <div className="label-mono mt-0.5">{desc}</div>
                </div>
                <div className="w-2 h-2 rounded-full bg-teal animate-pulse-dot flex-shrink-0" />
              </div>
            ))}

            {/* AlphaEvolve gate */}
            <div className="card border-gold/40 p-4">
              <div className="label-mono mb-3">AlphaEvolve — Weight Config</div>
              {[
                { label: 'Whale (intent)',     pct: 40 },
                { label: 'Liquidity (plumbing)', pct: 40 },
                { label: 'Sentiment (macro)',  pct: 20 },
              ].map(({ label, pct }) => (
                <div key={label} className="flex items-center gap-2 mb-2">
                  <span className="label-mono w-32 flex-shrink-0">{label}</span>
                  <div className="flex-1 h-1 bg-canvas-sunken rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gold rounded-full"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="font-mono text-xs text-gold tabular w-8 text-right">{pct}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom CTA row */}
        <div className="grid md:grid-cols-2 gap-4 pt-4 border-t border-canvas-border">
          <Link href="/gstack" className="card card-hover p-6 block group">
            <div className="label-mono mb-3">Explore</div>
            <div className="display-md mb-2 group-hover:text-gold transition-colors">
              G-Stack Architecture
            </div>
            <p className="text-sm text-ink-muted">
              Full tech stack visualization — tools, APIs, agent graph, data flow.
              Every component mapped.
            </p>
          </Link>
          <Link href="/design-consultation" className="card card-hover p-6 block group">
            <div className="label-mono mb-3">Build</div>
            <div className="display-md mb-2 group-hover:text-gold transition-colors">
              Design Consultation
            </div>
            <p className="text-sm text-ink-muted">
              AI-powered design system builder. Propose, refine, and generate a
              complete DESIGN.md for any product.
            </p>
          </Link>
        </div>

      </div>
    </div>
  )
}
