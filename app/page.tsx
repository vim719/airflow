'use client'

import { useState, useEffect, useRef } from 'react'
import { clsx } from 'clsx'

// ── Components ────────────────────────────────────────────────

function ScoreCard({ label, value, sub, color, percent }: any) {
  return (
    <div className="ac-card p-4 space-y-3">
      <div className="label-mono">{label}</div>
      <div className="font-mono text-2xl font-bold tabular-nums" style={{ color }}>{value}</div>
      <div className="h-[2px] bg-[var(--ac-border)] w-full rounded-full overflow-hidden">
        <div 
          className="h-full rounded-full transition-all duration-1000 ease-in-out" 
          style={{ width: `${percent}%`, background: color }}
        />
      </div>
      <div className="label-mono text-[9px] opacity-60 tracking-tight">{sub}</div>
    </div>
  )
}

function SignalConsole({ signal, loading }: any) {
  if (!signal) {
    return (
      <div className="ac-card overflow-hidden mb-4">
        <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--ac-border)] bg-black/20">
          <div className="label-mono">Convergence Stream</div>
          <div className="flex items-center gap-2">
            <div className="status-dot bg-ac-muted/40"></div>
            <span className="label-mono text-[9px]">Awaiting Signal...</span>
          </div>
        </div>
        <div className="p-10 text-center opacity-40">
          <div className="font-syne text-xl uppercase font-bold text-ac-muted mb-2 tracking-tight">Scanner Online</div>
          <div className="font-mono text-[10px] max-w-xs mx-auto leading-relaxed">
            PROPRIETARY BEYESIAN CONVERGENCE FILTER ACTIVE. SCREENING HIGH-CONFIDENCE SMART MONEY INFLOWS ON ETH, SOL, BASE.
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="ac-card overflow-hidden mb-4">
      <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--ac-border)] bg-black/20">
        <div className="label-mono">High-Confidence Event</div>
        <div className="bg-ac-gold-bg border-[0.5px] border-ac-gold px-2 py-0.5 rounded text-[10px] font-mono text-ac-gold font-bold">
          {signal.confidence.toFixed(1)}% CONF
        </div>
      </div>
      <div className="p-4">
        <div className="flex items-baseline gap-4 mb-4">
          <span className={clsx("font-mono text-2xl font-bold", signal.action === 'BUY' ? 'text-ac-green' : 'text-ac-red')}>
            {signal.action}
          </span>
          <span className="font-mono text-xl text-ac-text font-medium">{signal.symbol}</span>
          <span className="font-mono text-xs text-ac-muted ml-auto tabular-nums">@ ${signal.price.toFixed(4)}</span>
        </div>
        
        <div className="border-[0.5px] border-[var(--ac-border)] bg-black/40 p-3 rounded mb-4 text-[11px] font-mono text-ac-muted leading-relaxed">
          <span className="text-ac-text opacity-50 uppercase mr-1.5 font-bold">[Thesis]</span>
          {signal.thesis}
        </div>

        <div className="grid grid-cols-4 gap-2">
          {[
            { label: 'ENTRY', value: `$${signal.price.toFixed(4)}`, color: 'var(--ac-blue)' },
            { label: 'TGT 01', value: `$${signal.target1.toFixed(4)}`, color: 'var(--ac-green)' },
            { label: 'TGT 02', value: `$${signal.target2.toFixed(4)}`, color: 'var(--ac-green)' },
            { label: 'SL 00', value: `$${signal.stop.toFixed(4)}`, color: 'var(--ac-red)' },
          ].map((lvl) => (
            <div key={lvl.label} className="text-center p-2 border-[0.5px] border-[var(--ac-border)] rounded bg-black/10">
              <div className="label-mono text-[9px] mb-1">{lvl.label}</div>
              <div className="font-mono text-[11px] font-bold tabular-nums" style={{ color: lvl.color }}>{lvl.value}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function FindingRow({ icon, text }: any) {
  const iconColor = icon === 'confirm' ? 'var(--ac-green)' : icon === 'warn' ? 'var(--ac-gold)' : 'var(--ac-red)';
  return (
    <div className="flex gap-2.5 mb-2 group cursor-pointer hover:bg-white/5 p-1 rounded transition-colors">
      <div className="w-[12px] h-[12px] rounded-full mt-0.5 flex-shrink-0" style={{ background: iconColor, opacity: 0.8 }} />
      <span className="font-mono text-[10px] text-ac-muted group-hover:text-ac-text transition-colors">{text}</span>
    </div>
  )
}

// ── Main Terminal ──────────────────────────────────────────────

export default function HomePage() {
  const [time, setTime] = useState('')
  const [signals, setSignals] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState(0)
  const [logs, setLogs] = useState<any[]>([
    { ts: '09:41:02', level: 'OK', msg: 'Core Intelligence Online' },
    { ts: '09:41:03', level: 'INF', msg: 'AlphaEvolve Simulation loop n=100 complete' },
    { ts: '09:41:04', level: 'INF', msg: 'Nansen Real-time Pipeline &bull; ACTIVE' },
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
        if (data.signals && data.signals.length > 0) {
          setSignals(data.signals)
          addLog('SIG', `Detected ${data.signals.length} Institutional Signatures.`)
        }
      } catch (err) {
        addLog('ERR', 'API Stream Offline &bull; Autonomous Mode Active')
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
    setLogs(prev => [...prev.slice(-8), { ts, level, msg }])
  }

  const activeSignal = signals[0]

  return (
    <div className="grid-bg min-h-screen py-6 px-4 font-inter text-ac-text selection:bg-ac-gold-bg selection:text-ac-gold">
      <div className="max-w-[720px] mx-auto space-y-4">
        
        {/* Header */}
        <header className="flex justify-between items-end border-b-[0.5px] border-ac-border pb-4 mb-2">
          <div>
            <h1 className="font-syne text-4xl font-extrabold tracking-tight uppercase leading-none">AirClaw</h1>
            <p className="label-mono mt-2 opacity-50">MoMoA Institutional Terminal &bull; Researcher Node 101</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-ac-green-bg px-3 py-1.5 rounded-full border-[0.5px] border-ac-green/30">
              <div className="status-dot bg-ac-green"></div>
              <span className="label-mono text-ac-green text-[9px] font-bold italic">{loading ? 'SYNCING' : 'LIVE'}</span>
            </div>
          </div>
        </header>

        {/* Global Stats Grid */}
        <div className="grid grid-cols-3 gap-3">
          <ScoreCard 
            label="Whale Intent" 
            value={activeSignal ? `${(activeSignal.whale * 100).toFixed(1)}%` : '94.2%'} 
            sub="Nansen Smart Money" 
            color="var(--ac-green)" 
            percent={activeSignal ? activeSignal.whale * 100 : 94.2}
          />
          <ScoreCard 
            label="Liquidity Plumb" 
            value={activeSignal ? `${(activeSignal.liquidity * 100).toFixed(1)}%` : '91.8%'} 
            sub="CryptoQuant Reservoir" 
            color="var(--ac-gold)" 
            percent={activeSignal ? activeSignal.liquidity * 100 : 91.8}
          />
          <ScoreCard 
            label="Macro Sentiment" 
            value={activeSignal ? `${(activeSignal.sentiment * 100).toFixed(1)}%` : '85.4%'} 
            sub="Polymarket / Kalshi" 
            color="var(--ac-blue)" 
            percent={activeSignal ? activeSignal.sentiment * 100 : 85.4}
          />
        </div>

        {/* Primary Command Center */}
        <SignalConsole signal={activeSignal} loading={loading} />

        {/* AlphaEvolve Engine Tracking */}
        <div className="ac-card bg-black/30">
          <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--ac-border)]">
            <div className="label-mono text-[9px]">Simulation Engine &bull; AlphaEvolve Loop</div>
            <div className="flex items-center gap-2">
                <span className="label-mono text-[8px] text-ac-green font-bold">GATE PASSED</span>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-2 p-4 text-center">
            <div>
              <div className="font-mono text-lg font-bold text-ac-green tracking-tight">4.7</div>
              <div className="label-mono text-[8px] mt-1 opacity-50">Sharpe Ratio</div>
            </div>
            <div>
              <div className="font-mono text-lg font-bold text-ac-gold tracking-tight">73%</div>
              <div className="label-mono text-[8px] mt-1 opacity-50">Win Rate</div>
            </div>
            <div>
              <div className="font-mono text-lg font-bold text-ac-red tracking-tight">-2.1%</div>
              <div className="label-mono text-[8px] mt-1 opacity-50">Max Drawdown</div>
            </div>
            <div>
              <div className="font-mono text-lg font-bold tracking-tight">3.4:1</div>
              <div className="label-mono text-[8px] mt-1 opacity-50">Risk/Reward</div>
            </div>
          </div>
        </div>

        {/* Side Controls: Research & Watchdog */}
        <div className="grid grid-cols-2 gap-3">
          
          {/* Research Room Tabs */}
          <div className="ac-card flex flex-col h-[180px]">
            <div className="flex border-b border-[var(--ac-border)] px-4">
              {['FINDINGS', 'RISKS', 'PROMPTS'].map((tab, i) => (
                <div 
                  key={tab} 
                  className={clsx(
                    "px-2.5 py-2 label-mono cursor-pointer border-b-2 transition-all duration-200 text-[9px]",
                    activeTab === i ? "text-ac-text border-ac-gold" : "text-ac-muted border-transparent"
                  )}
                  onClick={() => setActiveTab(i)}
                >
                  {tab}
                </div>
              ))}
            </div>
            <div className="p-4 flex-1 overflow-y-auto">
              {activeTab === 0 && (
                <>
                  <FindingRow icon="confirm" text="Whale volume confirmed &bull; Jump Crypto" />
                  <FindingRow icon="confirm" text="Exchange reserves decline detected" />
                  <FindingRow icon="warn" text="Thin liquidity on secondary venues" />
                  <FindingRow icon="confirm" text="Model validated @ 88% min confidence" />
                </>
              )}
              {activeTab === 1 && (
                <>
                  <FindingRow icon="warn" text="Rate limit risk on upstream API (Proxy buffer)" />
                  <FindingRow icon="warn" text="Label decay on Nansen entities (14d)" />
                  <FindingRow icon="reject" text="Claude latency high (800ms) &bull; Async mode" />
                </>
              )}
              {activeTab === 2 && (
                <>
                   <FindingRow icon="confirm" text="Researcher TDD build prompt &rarr;" />
                   <FindingRow icon="confirm" text="Strategist Bayesian prompt &rarr;" />
                </>
              )}
            </div>
          </div>

          {/* Active Watchdogs */}
          <div className="ac-card flex flex-col h-[180px]">
            <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--ac-border)]">
                <div className="label-mono text-[9px]">Active Monitor (1/2)</div>
                <div className="flex items-center gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-ac-green animate-pulse"></div>
                </div>
            </div>
            <div className="p-4 space-y-3">
                <div className="p-2 border-[0.5px] border-ac-border rounded bg-black/20">
                    <div className="flex justify-between items-center mb-1">
                        <span className="font-mono text-[10px] font-bold text-ac-text">ZRO/USDT</span>
                        <span className="font-mono text-[10px] text-ac-green font-bold">+4.0%</span>
                    </div>
                    <div className="flex justify-between text-[8px] font-mono text-ac-muted">
                        <span>ENT: $4.50</span>
                        <span>CRN: $4.68</span>
                    </div>
                    <div className="mt-2 text-center py-0.5 bg-ac-green-bg border-[0.5px] border-ac-green/30 rounded font-mono text-[7px] text-ac-green font-extrabold uppercase tracking-widest">
                        SECURED
                    </div>
                </div>
                <div className="p-2 border-dashed border-[0.5px] border-ac-border rounded text-center py-6 opacity-20">
                   <span className="label-mono text-[8px]">Empty Slot</span>
                </div>
            </div>
          </div>
        </div>

        {/* Global Action Terminal */}
        <div className="flex gap-2 flex-wrap">
          <button className="bg-ac-gold-bg border-[0.5px] border-ac-gold px-4 py-1.5 rounded font-mono text-[9px] text-ac-gold hover:bg-ac-gold-bg/40 transition-all font-bold tracking-tight">SETUP GUIDE &rarr;</button>
          <button className="border-[0.5px] border-ac-border px-4 py-1.5 rounded font-mono text-[9px] text-ac-text hover:bg-ac-surface transition-all tracking-tight">STRATEGIST PROMPT</button>
          <button className="border-[0.5px] border-ac-border px-4 py-1.5 rounded font-mono text-[9px] text-ac-text hover:bg-ac-surface transition-all tracking-tight">RE-RUN SIM</button>
          <button className="border-[0.5px] border-ac-red text-ac-red bg-ac-red-bg px-4 py-1.5 rounded font-mono text-[9px] hover:opacity-80 transition-all font-bold tracking-tight">PANIC CALC</button>
        </div>

        {/* Live System Log */}
        <div className="log-terminal h-[100px]">
          {logs.map((log, i) => (
            <div key={i} className="flex gap-2 px-1">
              <span className="opacity-30 flex-shrink-0">{log.ts}</span>
              <span className={clsx(
                "flex-shrink-0",
                log.level === 'OK' ? 'text-ac-green' : 
                log.level === 'ERR' ? 'text-ac-red' : 
                log.level === 'SIG' ? 'text-ac-gold' :
                'text-ac-blue'
              )}>
                [{log.level}]
              </span>
              <span className="truncate">{log.msg}</span>
            </div>
          ))}
          <div ref={logEndRef} />
        </div>

        {/* Secondary Info Footer */}
        <footer className="pt-4 flex justify-between items-center text-ac-muted opacity-30 font-mono text-[9px] pb-12">
           <span>AIRCLAW INTEL &bull; JANE STREET STRATEGY ACTIVE</span>
           <span className="tabular-nums tracking-wide">{time}</span>
           <span>TERMINAL ACCESS // 2219-SALZIL</span>
        </footer>

      </div>
    </div>
  )
}
