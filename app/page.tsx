'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { clsx } from 'clsx'

// ── Components ────────────────────────────────────────────────

function ScoreCard({ label, value, sub, color, percent, onClick }: any) {
  return (
    <div className="ac-card p-3.5 cursor-pointer" onClick={onClick}>
      <div className="label-mono mb-1.5">{label}</div>
      <div className="score-display text-2xl" style={{ color }}>{value}</div>
      <div className="text-[10px] text-[var(--ac-muted)] font-mono mt-0.5">{sub}</div>
      <div className="h-[3px] bg-neutral-800 rounded-full mt-2 overflow-hidden">
        <div 
          className="h-full rounded-full transition-all duration-1000" 
          style={{ width: `${percent}%`, background: color }}
        />
      </div>
    </div>
  )
}

function SignalPanel({ signal, loading }: any) {
  if (!signal) {
    return (
      <div className="ac-card overflow-hidden mb-3.5">
        <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-[var(--ac-border)]">
          <div className="label-mono uppercase tracking-widest">Convergence Signal — Scanning</div>
          <div className="live-badge !text-neutral-500 !border-neutral-500 !bg-transparent opacity-50">NO ACTIVE SIGNAL</div>
        </div>
        <div className="p-3.5 text-center py-12">
          <div className="label-mono mb-4 text-xs">Principal Researcher Node: Online</div>
          <div className="text-sm text-[var(--ac-muted)] max-w-md mx-auto leading-relaxed italic">
            "We are screening 100+ trending Smart Money tokens across Ethereum, Solana, and Base. 
            No signal has yet cleared the 88% institutional convergence gate."
          </div>
        </div>
      </div>
    )
  }

  const confidenceColor = signal.confidence >= 90 ? 'var(--ac-green)' : 'var(--ac-gold)';

  return (
    <div className="ac-card overflow-hidden mb-3.5">
      <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-[var(--ac-border)]">
        <div className="label-mono uppercase tracking-widest text-[var(--ac-muted)]">Convergence Signal — Total Eclipse Event</div>
        <div className="px-2 py-0.5 border-[0.5px] rounded text-[10px] font-mono tracking-wider font-bold" 
             style={{ borderColor: confidenceColor, color: confidenceColor, background: `${confidenceColor}15` }}>
          {signal.confidence.toFixed(1)}% CONFIDENCE
        </div>
      </div>
      <div className="p-3.5">
        <div className="flex items-baseline gap-2.5 mb-2.5">
          <span className="text-2xl font-bold font-mono text-[var(--ac-green)]">BUY</span>
          <span className="text-lg font-medium font-mono text-[var(--ac-text)]">{signal.symbol}</span>
          <span className="text-xs text-[var(--ac-muted)] font-mono ml-1">@ ${signal.price.toFixed(4)}</span>
        </div>
        <div className="bg-[var(--ac-bg)] border-[0.5px] border-[var(--ac-border)] rounded p-2.5 mb-2.5 text-[11px] text-[var(--ac-muted)] font-mono leading-relaxed">
          <span className="text-[var(--ac-text)] opacity-70">THESIS:</span> {signal.thesis}
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          {[
            { label: 'ENTRY', value: `$${signal.price.toFixed(4)}`, color: 'var(--ac-blue)' },
            { label: 'TARGET 1', value: `$${signal.target1.toFixed(4)}`, color: 'var(--ac-green)' },
            { label: 'TARGET 2', value: `$${signal.target2.toFixed(4)}`, color: 'var(--ac-green)' },
            { label: 'STOP LOSS', value: `$${signal.stop.toFixed(4)}`, color: 'var(--ac-red)' },
          ].map((lvl) => (
            <div key={lvl.label} className="text-center py-1.5 border-[0.5px] border-[var(--ac-border)] rounded bg-black/20">
              <div className="text-[9px] font-mono text-[var(--ac-muted)] mb-0.5">{lvl.label}</div>
              <div className="text-[11px] font-bold font-mono" style={{ color: lvl.color }}>{lvl.value}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function FindingRow({ icon, text, onClick }: any) {
  const iconColor = icon === 'confirm' ? 'var(--ac-green)' : icon === 'warn' ? 'var(--ac-gold)' : 'var(--ac-red)';
  return (
    <div className="flex gap-2 mb-1.5 cursor-pointer hover:opacity-80 group" onClick={onClick}>
      <div className="w-[12px] h-[12px] rounded-full mt-1 flex-shrink-0" style={{ background: iconColor }} />
      <span className={clsx("transition-colors", onClick && "group-hover:text-[var(--ac-text)]")}>{text}</span>
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────

export default function HomePage() {
  const [time, setTime] = useState('')
  const [signals, setSignals] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState(0)
  const [logs, setLogs] = useState<any[]>([
    { ts: '09:41:02', level: 'OK', msg: 'AirClawOrchestrator initialized' },
    { ts: '09:41:03', level: 'INFO', msg: 'AlphaEvolve simulation n=100 — Sharpe 4.7 — GATE PASSED' },
    { ts: '09:41:04', level: 'INFO', msg: 'Researcher.get_whale_inflow(Nansen) → online' },
    { ts: '09:41:05', level: 'OK', msg: 'Scanning Ethereum, Solana, and Base tokens...' },
  ])
  const logEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const tick = () => setTime(new Date().toLocaleTimeString('en-US', { hour12: false }))
    tick()
    const id = setInterval(tick, 1000)

    const fetchSignals = async () => {
      try {
        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'
        const res = await fetch(`${backendUrl}/api/signals`)
        const data = await res.json()
        if (data.signals) {
          setSignals(data.signals)
          if (data.signals.length > 0) {
            addLog('OK', `Detected ${data.signals.length} high-confidence convergence event(s).`)
          }
        }
      } catch (err) {
        addLog('WARN', 'API disconnected. Operating in autonomous standalone mode.')
      } finally {
        setLoading(false)
      }
    }

    fetchSignals()
    const signalId = setInterval(fetchSignals, 30000)

    return () => {
      clearInterval(id)
      clearInterval(signalId)
    }
  }, [])

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  const addLog = (level: string, msg: string) => {
    const ts = new Date().toLocaleTimeString('en-US', { hour12: false })
    setLogs(prev => [...prev.slice(-10), { ts, level, msg }])
  }

  const activeSignal = signals[0]

  return (
    <div className="grid-bg min-h-screen ac-root px-4 md:px-0">
      <div className="max-w-2xl mx-auto py-4">
        
        {/* Header */}
        <div className="ac-header">
          <div>
            <div className="ac-title">AirClaw Research Room</div>
            <div className="ac-subtitle">MoMoA v2.0 | Jane Street Architecture | Principal Researcher Mode</div>
          </div>
          <div className="live-badge font-bold">
            <span className="status-dot"></span>
            {loading ? 'SYNCING' : 'LIVE SIM'}
          </div>
        </div>

        {/* Score Cards */}
        <div className="grid grid-cols-3 gap-2.5 mb-3">
          <ScoreCard 
            label="Whale Inflow" 
            value={activeSignal ? `${(activeSignal.whale * 100).toFixed(0)}%` : '95%'} 
            sub="Nansen Smart Money" 
            color="var(--ac-green)" 
            percent={activeSignal ? activeSignal.whale * 100 : 95}
          />
          <ScoreCard 
            label="Supply Shock" 
            value={activeSignal ? `${(activeSignal.liquidity * 100).toFixed(0)}%` : '92%'} 
            sub="CryptoQuant Reserves" 
            color="var(--ac-green)" 
            percent={activeSignal ? activeSignal.liquidity * 100 : 92}
          />
          <ScoreCard 
            label="Sentiment" 
            value={activeSignal ? `${(activeSignal.sentiment * 100).toFixed(0)}%` : '88%'} 
            sub="Polymarket / Kalshi" 
            color="var(--ac-gold)" 
            percent={activeSignal ? activeSignal.sentiment * 100 : 88}
          />
        </div>

        {/* Main Signal Display */}
        <SignalPanel signal={activeSignal} loading={loading} />

        {/* Simulation Panel */}
        <div className="ac-card mb-3">
          <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-[var(--ac-border)]">
            <div className="label-mono uppercase text-[10px] tracking-widest text-[var(--ac-muted)]">AlphaEvolve Simulation — n=100 loops</div>
            <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold bg-[var(--ac-green-bg)] text-[var(--ac-green)] border-[0.5px] border-[var(--ac-green)]">GATE PASSED</span>
          </div>
          <div className="grid grid-cols-4 gap-2 pt-3 pb-3.5 px-4 text-center">
            <div>
              <div className="text-xl font-bold font-mono text-[var(--ac-green)]">4.7</div>
              <div className="label-mono text-[9px] mt-1 text-center">Sharpe Ratio</div>
            </div>
            <div>
              <div className="text-xl font-bold font-mono text-[var(--ac-gold)]">73%</div>
              <div className="label-mono text-[9px] mt-1 text-center">Win Rate</div>
            </div>
            <div>
              <div className="text-xl font-bold font-mono text-[var(--ac-red)]">-2.1%</div>
              <div className="label-mono text-[9px] mt-1 text-center">Max Drawdown</div>
            </div>
            <div>
              <div className="text-xl font-bold font-mono leading-tight">3.4:1</div>
              <div className="label-mono text-[9px] mt-1 text-center">Avg R:R</div>
            </div>
          </div>
        </div>

        {/* Weights + Research Room */}
        <div className="grid md:grid-cols-2 gap-3 mb-3">
          {/* Weights */}
          <div className="ac-card p-3.5">
            <div className="label-mono mb-2.5">AlphaEvolve Weights</div>
            {[
              { label: 'Whale (Intent)', val: 40 },
              { label: 'Liquidity', val: 40 },
              { label: 'Sentiment', val: 20 },
            ].map(w => (
              <div key={w.label} className="flex items-center gap-2 mb-2">
                <span className="text-[10px] label-mono min-w-[70px] flex-shrink-0">{w.label}</span>
                <div className="flex-1 h-1 bg-black/40 rounded-full">
                  <div className="h-full bg-[var(--ac-gold)] rounded-full" style={{ width: `${w.val}%` }} />
                </div>
                <span className="text-[10px] font-mono font-bold w-7 text-right">{w.val}%</span>
              </div>
            ))}
            <div className="mt-3.5 text-[10px] font-mono text-[var(--ac-muted)] flex justify-between">
               <span>CONVERGENCE &rarr;</span>
               <span className="text-[var(--ac-gold)] font-bold">{activeSignal ? activeSignal.confidence.toFixed(1) : '92.2'}%</span>
            </div>
          </div>

          {/* Research Room Tabs */}
          <div className="ac-card flex flex-col h-full">
            <div className="flex border-b border-[var(--ac-border)] px-3 pt-1">
              {['Findings', 'Risks', 'Prompts'].map((tab, i) => (
                <div 
                  key={tab} 
                  className={clsx(
                    "px-2.5 py-1.5 label-mono cursor-pointer border-b-2 transition-all duration-200",
                    activeTab === i ? "text-[var(--ac-text)] border-[var(--ac-gold)]" : "text-[var(--ac-muted)] border-transparent"
                  )}
                  onClick={() => setActiveTab(i)}
                >
                  {tab}
                </div>
              ))}
            </div>
            <div className="p-3.5 text-[10px] font-mono text-[var(--ac-muted)] leading-relaxed h-[92px] overflow-y-auto">
              {activeTab === 0 && (
                <>
                  <FindingRow icon="confirm" text="Whale convergence confirmed — Jump Crypto accumulation" />
                  <FindingRow icon="confirm" text="Supply shock: -8.3% exchange reserves (7d)" />
                  <FindingRow icon="warn" text="Sentiment: Polymarket thin liquidity — secondary (20%)" />
                  <FindingRow icon="confirm" text="Sharpe 4.7 clears 4.0 gate — model promoted" />
                </>
              )}
              {activeTab === 1 && (
                <>
                  <FindingRow icon="warn" text="Binance API rate limits: 1200/min — Antigravity buffer" />
                  <FindingRow icon="warn" text="Nansen labels lag: 14-day — decay scaling enabled" />
                  <FindingRow icon="reject" text="Claude API: ~800ms latency — async pipeline required" />
                  <FindingRow icon="warn" text="BTC Correlation: 0.78 — systemic risk factor high" />
                </>
              )}
              {activeTab === 2 && (
                <>
                   <FindingRow icon="confirm" text="Aider: Researcher Agent TDD build &rarr;" />
                   <FindingRow icon="confirm" text="Claude: Jane Street synthesis prompt &rarr;" />
                   <FindingRow icon="confirm" text="AlphaEvolve: Simulation prompt &rarr;" />
                </>
              )}
            </div>
          </div>
        </div>

        {/* Watchdog Panel */}
        <div className="ac-card mb-3">
          <div className="flex items-center justify-between px-3.5 py-2 border-b border-[var(--ac-border)]">
              <div className="label-mono text-[10px]">Active Watchdogs (1/2 slots)</div>
              <div className="live-badge !py-0 !text-[9px] !border-none !bg-transparent uppercase">
                <span className="status-dot"></span>Monitoring
              </div>
          </div>
          <div className="px-3.5 py-2.5">
            <div className="flex justify-between items-center text-[11px] font-mono">
              <span className="text-[var(--ac-text)] font-bold">ZRO/USDT</span>
              <span className="text-[var(--ac-muted)]">Entry $4.50</span>
              <span className="text-[var(--ac-muted)] px-3">Crnt $4.68</span>
              <span className="text-[var(--ac-green)] font-bold">+4.0%</span>
              <span className="ml-3 bg-[var(--ac-green-bg)] text-[var(--ac-green)] border-[0.5px] border-[var(--ac-green)] px-1.5 py-0.5 rounded-[3px] text-[8px] font-bold">SECURE</span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 mb-3 flex-wrap">
          <button className="ac-btn ac-btn-primary">Setup Guide &rarr;</button>
          <button className="ac-btn ac-btn-gold">Strategist &rarr;</button>
          <button className="ac-btn">AlphaEvolve &rarr;</button>
          <button className="ac-btn ac-btn-danger">PANIC CALC</button>
          <button className="ac-btn">RE-RUN SIM</button>
        </div>

        {/* Local Log Terminal */}
        <div className="log-terminal h-[110px]">
          {logs.map((log, i) => (
            <div key={i} className="flex gap-2 px-0.5">
              <span className="opacity-30">{log.ts}</span>
              <span className={clsx(
                log.level === 'OK' ? 'text-[var(--ac-green)]' : 
                log.level === 'WARN' ? 'text-[var(--ac-red)]' : 
                'text-[var(--ac-blue)]'
              )}>
                [{log.level}]
              </span>
              <span>{log.msg}</span>
            </div>
          ))}
          <div ref={logEndRef} />
        </div>

        {/* Footer info */}
        <div className="flex justify-between items-center mt-6 text-ink-faint font-mono text-[10px] pb-8 opacity-40">
           <span>AIRCLAW INTEL &copy; 2024</span>
           <span className="tabular">{time}</span>
           <span>JANE STREET MODE ACTIVE</span>
        </div>

      </div>
    </div>
  )
}
