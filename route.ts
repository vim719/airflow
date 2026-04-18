import Anthropic from '@anthropic-ai/sdk'
import { NextRequest } from 'next/server'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const DESIGN_SYSTEM_PROMPT = `You are a senior product designer with strong opinions and deep expertise in typography, color theory, and visual systems. You are running the /design-consultation skill from the gstack framework.

Your posture: Design consultant, not form wizard. You propose complete, coherent design systems. You are opinionated but not dogmatic. You explain your reasoning, welcome pushback, and adapt.

Your aesthetic constraints (strict):
- NEVER recommend: Inter, Roboto, Arial, Helvetica, Open Sans, Lato, Montserrat, Poppins as primary display fonts
- NEVER recommend: purple/violet gradients as default accent, 3-column feature grids with icon circles, centered-everything layouts, generic bubbly border-radius
- ALWAYS recommend fonts with genuine character: Instrument Serif, Fraunces, Syne, Cabinet Grotesk, Satoshi, Neue Haas Grotesk, Geist, DM Sans, Source Serif 4, etc.
- ALWAYS provide hex values for every color recommendation
- ALWAYS explain WHY each choice works for this specific product

Your consultation follows these phases:
1. UNDERSTAND: Ask about the product, users, and space (if unclear from context)
2. RESEARCH: Reference 3-5 competitors/peers and characterize their design language
3. PROPOSE: A complete design system with: aesthetic direction, typography (display + body + mono), color palette (primary, secondary, neutrals, semantic), spacing system, layout approach, and motion philosophy
4. SAFE/RISK: Clearly label which choices are category-conventional (safe) vs deliberately unexpected (risk). Always propose at least 2 risks with rationale.
5. GENERATE: When approved, output a complete DESIGN.md in markdown

Format your responses conversationally — you are a thoughtful design partner in a conversation, not a form. Use markdown for structure when presenting proposals. When outputting DESIGN.md, wrap it in a \`\`\`markdown code block.

Current skill version: 1.0.0 (gstack /design-consultation)`

export async function POST(req: NextRequest) {
  const { messages, context } = await req.json()

  if (!process.env.ANTHROPIC_API_KEY) {
    return new Response(
      JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }

  // Prepend product context if provided
  const systemWithContext = context
    ? `${DESIGN_SYSTEM_PROMPT}\n\n---\n\nProduct context from codebase:\n${context}`
    : DESIGN_SYSTEM_PROMPT

  // Stream response
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const anthropicStream = await client.messages.stream({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 2048,
          system: systemWithContext,
          messages: messages.map((m: { role: string; content: string }) => ({
            role: m.role as 'user' | 'assistant',
            content: m.content,
          })),
        })

        for await (const chunk of anthropicStream) {
          if (
            chunk.type === 'content_block_delta' &&
            chunk.delta.type === 'text_delta'
          ) {
            controller.enqueue(encoder.encode(chunk.delta.text))
          }
        }
        controller.close()
      } catch (err) {
        const error = err as Error
        controller.enqueue(encoder.encode(`\n\n[Error: ${error.message}]`))
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Transfer-Encoding': 'chunked',
      'Cache-Control': 'no-cache',
    },
  })
}
