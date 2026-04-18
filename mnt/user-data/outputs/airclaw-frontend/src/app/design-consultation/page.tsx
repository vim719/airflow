'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { clsx } from 'clsx'

// ── Types ──────────────────────────────────────────────────────
type Message = {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

type Phase =
  | 'idle'
  | 'understanding'
  | 'researching'
  | 'proposing'
  | 'refining'
  | 'generating'

// ── Starter prompts ────────────────────────────────────────────
const STARTERS = [
  {
    label: 'New SaaS product',
    prompt: 'I\'m building AirClaw — an institutional-grade crypto intelligence engine for sophisticated traders. Think Jane Street meets Bloomberg terminal. Help me design a complete design system for the web dashboard.',
  },
  {
    label: 'Fintech dashboard',
    prompt: 'I need a design system for a quantitative trading dashboard. Users are professional traders who spend 8+ hours a day on screen. Data density matters. The product must feel institutional, not consumer.',
  },
  {
    label: 'API developer tool',
    prompt: 'I\'m building a developer API product for data engineers. Think Stripe docs meets Retool. Light theme, precision typography, excellent code display. Create a design system.',
  },
  {
    label: 'Research tool',
    prompt: 'I\'m building a research intelligence platform for investment analysts. They read long-form reports, track signals, and annotate. Editorial feel. Help me design a system that makes reading and analysis feel luxurious.',
  },
]

// ── Markdown renderer (simple, no deps) ───────────────────────
function renderMarkdown(text: string): string {
  return text
    // Code blocks
    .replace(/```(\w+)?\n([\s\S]*?)```/g, (_, lang, code) =>
      `<pre class="bg-canvas-sunken border border-canvas-border rounded p-4 overflow-x-auto my-3"><code class="font-mono text-xs text-ink leading-relaxed">${escapeHtml(code.trim())}</code></pre>`
    )
    // Inline code
    .replace(/`([^`]+)`/g,
      '<code class="bg-canvas-sunken border border-canvas-border rounded px-1.5 py-0.5 font-mono text-xs text-ink">$1</code>'
    )
    // H2
    .replace(/^## (.+)$/gm,
      '<h2 class="font-serif text-xl mt-6 mb-2 text-ink">$1</h2>'
    )
    // H3
    .replace(/^### (.+)$/gm,
      '<h3 class="font-sans text-sm font-semibold mt-4 mb-1.5 text-ink uppercase tracking-wide">$1</h3>'
    )
    // Bold
    .replace(/\*\*([^*]+)\*\*/g, '<strong class="font-semibold text-ink">$1</strong>')
    // Italic
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    // HR
    .replace(/^---$/gm, '<hr class="border-canvas-border my-4" />')
    // Unordered list items
    .replace(/^- (.+)$/gm,
      '<li class="flex gap-2 text-sm text-ink-muted leading-relaxed mb-1"><span class="text-gold mt-1 flex-shrink-0">·</span><span>$1</span></li>'
    )
    // Wrap consecutive li items
    .replace(/(<li[^>]*>.*<\/li>\n?)+/gs, '<ul class="my-2 space-y-0.5">$&</ul>')
    // Paragraphs (double newline)
    .replace(/\n\n(?!<)/g, '</p><p class="text-sm text-ink-muted leading-relaxed mb-3">')
    .replace(/^(?!<)(.+)/, '<p class="text-sm text-ink-muted leading-relaxed mb-3">$1')
}

function escapeHtml(text: string): string {
  return text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
}

// ── DESIGN.md extractor ────────────────────────────────────────
function extractDesignMd(content: string): string | null {
  const match = content.match(/```(?:markdown)?\n([\s\S]*?# Design System[\s\S]*?)```/)
  return match ? match[1] : null
}

// ── Phase indicator ────────────────────────────────────────────
function PhaseIndicator({ phase }: { phase: Phase }) {
  const phases: { id: Phase; label: string }[] = [
    { id: 'understanding', label: 'Understand' },
    { id: 'researching',   label: 'Research'   },
    { id: 'proposing',     label: 'Propose'    },
    { id: 'refining',      label: 'Refine'     },
    { id: 'generating',    label: 'Generate'   },
  ]
  const currentIdx = phases.findIndex(p => p.id === phase)

  return (
    <div className="flex items-center gap-1">
      {phases.map((p, i) => (
        <div key={p.id} className="flex items-center gap-1">
          <div className={clsx(
            'flex items-center gap-1.5 px-2 py-0.5 rounded-full text-2xs font-mono transition-all duration-300',
            i < currentIdx
              ? 'bg-teal/10 text-teal-dark border border-teal/20'
              : i === currentIdx
              ? 'bg-gold/10 text-gold border border-gold/30'
              : 'bg-transparent text-ink-faint border border-transparent'
          )}>
            {i < currentIdx && (
              <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                <path d="M1.5 4L3 5.5L6.5 2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
              </svg>
            )}
            {p.label}
          </div>
          {i < phases.length - 1 && (
            <div className={clsx(
              'w-3 h-px transition-colors duration-300',
              i < currentIdx ? 'bg-teal/40' : 'bg-canvas-border'
            )} />
          )}
        </div>
      ))}
    </div>
  )
}

// ── Message bubble ─────────────────────────────────────────────
function MessageBubble({ message, isStreaming }: { message: Message; isStreaming?: boolean }) {
  const isUser = message.role === 'user'
  const designMd = !isUser ? extractDesignMd(message.content) : null

  return (
    <div className={clsx('flex gap-3', isUser && 'flex-row-reverse')}>
      {/* Avatar */}
      <div className={clsx(
        'w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-2xs font-mono font-medium mt-0.5',
        isUser
          ? 'bg-ink text-canvas'
          : 'bg-gold/10 border border-gold/30 text-gold'
      )}>
        {isUser ? 'You' : 'DC'}
      </div>

      {/* Content */}
      <div className={clsx('flex-1 min-w-0', isUser && 'flex justify-end')}>
        {isUser ? (
          <div className="bubble-user text-sm leading-relaxed max-w-lg">
            {message.content}
          </div>
        ) : (
          <div className="space-y-2 max-w-2xl">
            <div
              className="bubble-agent prose-sm"
              dangerouslySetInnerHTML={{ __html: renderMarkdown(message.content) + (isStreaming ? '<span class="inline-block w-0.5 h-3.5 bg-gold animate-pulse ml-0.5 align-middle" />' : '') }}
            />

            {/* DESIGN.md download if found */}
            {designMd && (
              <button
                onClick={() => {
                  const blob = new Blob([designMd], { type: 'text/markdown' })
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement('a')
                  a.href = url
                  a.download = 'DESIGN.md'
                  a.click()
                  URL.revokeObjectURL(url)
                }}
                className="inline-flex items-center gap-2 text-xs font-mono bg-teal/10 text-teal-dark border border-teal/30 px-3 py-1.5 rounded hover:bg-teal/20 transition-colors"
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M6 1v7M3.5 5.5L6 8l2.5-2.5M2 10h8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Download DESIGN.md
              </button>
            )}
          </div>
        )}

        <div className={clsx(
          'label-mono mt-1.5',
          isUser ? 'text-right' : 'text-left'
        )}>
          {message.timestamp.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────
export default function DesignConsultationPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [phase, setPhase] = useState<Phase>('idle')
  const [isStreaming, setIsStreaming] = useState(false)
  const [context, setContext] = useState('')
  const [showContext, setShowContext] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const streamingIdRef = useRef<string | null>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`
  }, [input])

  // Detect phase from assistant message content
  const detectPhase = (content: string): Phase => {
    const lower = content.toLowerCase()
    if (lower.includes('design system') && lower.includes('# ')) return 'generating'
    if (lower.includes('safe choices') || lower.includes('risks')) return 'proposing'
    if (lower.includes('competitor') || lower.includes('landscape') || lower.includes('research')) return 'researching'
    if (lower.includes('adjust') || lower.includes('tweak') || lower.includes('change')) return 'refining'
    return 'understanding'
  }

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || isStreaming) return

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: content.trim(),
      timestamp: new Date(),
    }

    setMessages(prev => [...prev, userMsg])
    setInput('')
    setIsStreaming(true)
    if (phase === 'idle') setPhase('understanding')

    // Create assistant message placeholder
    const assistantId = crypto.randomUUID()
    streamingIdRef.current = assistantId
    const assistantMsg: Message = {
      id: assistantId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
    }
    setMessages(prev => [...prev, assistantMsg])

    try {
      const allMessages = [
        ...messages.map(m => ({ role: m.role, content: m.content })),
        { role: 'user', content: content.trim() },
      ]

      const response = await fetch('/api/design-consultation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: allMessages, context }),
      })

      if (!response.ok) throw new Error(`API error ${response.status}`)
      if (!response.body) throw new Error('No response body')

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let accumulated = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        accumulated += decoder.decode(value, { stream: true })

        setMessages(prev =>
          prev.map(m =>
            m.id === assistantId ? { ...m, content: accumulated } : m
          )
        )
      }

      // Detect phase from final content
      setPhase(detectPhase(accumulated))
    } catch (err) {
      const error = err as Error
      setMessages(prev =>
        prev.map(m =>
          m.id === streamingIdRef.current
            ? { ...m, content: `Sorry, something went wrong: ${error.message}. Make sure ANTHROPIC_API_KEY is set in your .env.local file.` }
            : m
        )
      )
    } finally {
      setIsStreaming(false)
      streamingIdRef.current = null
    }
  }, [messages, isStreaming, phase, context])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  const startFresh = () => {
    setMessages([])
    setPhase('idle')
    setInput('')
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-12">

      {/* Header */}
      <div className="space-y-4 mb-8 animate-fade-up opacity-0-start">
        <div className="gold-rule" />
        <div className="flex items-start justify-between">
          <div>
            <div className="label-mono mb-2">gstack / design-consultation v1.0.0</div>
            <h1 className="display-xl">
              Design<br /><em>Consultation</em>
            </h1>
            <p className="text-ink-muted mt-3 max-w-lg leading-relaxed text-sm">
              Senior product designer powered by Claude. Understands your product,
              researches the landscape, proposes a complete design system — typography,
              color, spacing, motion. Outputs DESIGN.md as your project's design source of truth.
            </p>
          </div>

          {messages.length > 0 && (
            <button
              onClick={startFresh}
              className="text-xs font-mono text-ink-muted hover:text-ink border border-canvas-border px-3 py-1.5 rounded hover:border-gold transition-all"
            >
              New session
            </button>
          )}
        </div>

        {/* Phase tracker */}
        {phase !== 'idle' && (
          <div className="animate-fade-in">
            <PhaseIndicator phase={phase} />
          </div>
        )}
      </div>

      {/* Starters (idle state) */}
      {messages.length === 0 && (
        <div className="space-y-4 mb-8 animate-fade-up opacity-0-start delay-150">
          <div className="label-mono">Start a consultation</div>
          <div className="grid grid-cols-2 gap-3">
            {STARTERS.map(({ label, prompt }) => (
              <button
                key={label}
                onClick={() => sendMessage(prompt)}
                className="card card-hover p-4 text-left group"
              >
                <div className="text-sm font-medium mb-1 group-hover:text-gold transition-colors">
                  {label}
                </div>
                <p className="text-xs text-ink-muted leading-relaxed line-clamp-2">{prompt}</p>
              </button>
            ))}
          </div>

          {/* Context input (optional) */}
          <div className="card p-4">
            <button
              onClick={() => setShowContext(v => !v)}
              className="flex items-center gap-2 text-xs font-mono text-ink-muted hover:text-ink transition-colors w-full"
            >
              <svg
                width="12" height="12" viewBox="0 0 12 12" fill="none"
                className={clsx('transition-transform', showContext && 'rotate-90')}
              >
                <path d="M4 2l4 4-4 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Add product context (optional — paste README, describe your product)
            </button>
            {showContext && (
              <textarea
                value={context}
                onChange={e => setContext(e.target.value)}
                placeholder="Paste your README, product description, or tech stack here. The consultant will use this as context."
                className="mt-3 w-full bg-canvas-sunken border border-canvas-border rounded p-3 font-mono text-xs text-ink resize-none h-24 focus:outline-none focus:border-gold transition-colors"
              />
            )}
          </div>
        </div>
      )}

      {/* Message thread */}
      {messages.length > 0 && (
        <div className="space-y-6 mb-6">
          {messages.map((msg, i) => (
            <MessageBubble
              key={msg.id}
              message={msg}
              isStreaming={isStreaming && i === messages.length - 1 && msg.role === 'assistant'}
            />
          ))}
          <div ref={bottomRef} />
        </div>
      )}

      {/* Input */}
      <div className={clsx(
        'card p-3 transition-all duration-200',
        isStreaming ? 'border-gold/30' : 'focus-within:border-gold/50'
      )}>
        <textarea
          ref={textareaRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isStreaming}
          placeholder={
            messages.length === 0
              ? 'Describe your product — what you\'re building, who it\'s for, what space it\'s in...'
              : 'Continue the consultation... (Shift+Enter for new line)'
          }
          className="w-full bg-transparent font-sans text-sm text-ink placeholder-ink-faint resize-none focus:outline-none min-h-[52px] max-h-[200px] leading-relaxed"
          rows={2}
        />
        <div className="flex items-center justify-between mt-2 pt-2 border-t border-canvas-border">
          <div className="label-mono">
            {isStreaming ? (
              <span className="flex items-center gap-1.5 text-gold">
                <span className="w-1.5 h-1.5 rounded-full bg-gold animate-pulse-dot" />
                Consulting...
              </span>
            ) : (
              'Enter to send · Shift+Enter for new line'
            )}
          </div>
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || isStreaming}
            className={clsx(
              'px-4 py-1.5 rounded text-xs font-mono font-medium transition-all',
              input.trim() && !isStreaming
                ? 'bg-ink text-canvas hover:bg-ink-soft'
                : 'bg-canvas-sunken text-ink-faint cursor-not-allowed'
            )}
          >
            Send
          </button>
        </div>
      </div>

      {/* Footer note */}
      <div className="mt-4 label-mono text-center text-ink-faint">
        Powered by Claude Sonnet 4 · gstack /design-consultation v1.0.0
        · Outputs DESIGN.md as your design source of truth
      </div>
    </div>
  )
}
