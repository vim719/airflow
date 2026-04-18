"""
airclaw/bot/telegram_bot.py
============================
Production Telegram bot — the user-facing layer.

Commands:
  /start     — welcome + register user
  /scan      — trigger manual watchlist scan
  /status    — show active watchdog positions
  /panic     — instant risk assessment on active position
  /close     — close a watchdog position
  /gate      — run AlphaEvolve gate check and show results

Auto-signals: fired by the scheduler every 15 minutes.

TOOL ASSIGNMENT: Bot UI wiring → aider can extend handlers.
                 Signal logic → NEVER touch core/engine.py.
"""

import asyncio
import logging
import os
from dotenv import load_dotenv
from telegram import (
    Update,
    InlineKeyboardButton,
    InlineKeyboardMarkup,
)
from telegram.ext import (
    Application,
    CommandHandler,
    CallbackQueryHandler,
    ContextTypes,
)
from telegram.constants import ParseMode

load_dotenv()
log = logging.getLogger("airclaw.bot")

TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
ALLOWED_CHAT_IDS = [
    int(x) for x in os.getenv("ALLOWED_CHAT_IDS", "").split(",") if x.strip()
]

# ── Injected by main.py after orchestrator is initialized ──
orchestrator = None

# ── Default watchlist — extend this for demo ──
WATCHLIST = [
    {
        "symbol":        "ZRO/USDT",
        "coin_id":       "layerzero",
        "token_address": "0x6985884C4392D348587B19cb9eAAf157F13271cd",
        "cq_symbol":     "eth",
    },
    {
        "symbol":        "ETH/USDT",
        "coin_id":       "ethereum",
        "token_address": "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
        "cq_symbol":     "eth",
    },
    {
        "symbol":        "BTC/USDT",
        "coin_id":       "bitcoin",
        "token_address": "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599",
        "cq_symbol":     "btc",
    },
]


# ─────────────────────────────────────────────
# AUTH GUARD
# WHY: Demo is for 10 known traders. No public access.
# ─────────────────────────────────────────────
def is_authorized(update: Update) -> bool:
    if not ALLOWED_CHAT_IDS:
        return True  # Open during dev if no IDs set
    return update.effective_chat.id in ALLOWED_CHAT_IDS


# ─────────────────────────────────────────────
# FORMATTING HELPERS
# ─────────────────────────────────────────────
def fmt_signal_message(signal) -> str:
    """Format TradeSignal for Telegram. Institutional tone."""
    pct_t1 = ((signal.target_1 / signal.entry) - 1) * 100
    pct_t2 = ((signal.target_2 / signal.entry) - 1) * 100
    pct_sl = ((signal.stop_loss / signal.entry) - 1) * 100

    return (
        f"AIRCLAW — {signal.action} {signal.symbol}\n"
        f"Confidence: {signal.confidence:.1f}%\n"
        f"\n"
        f"Price:     ${signal.price:.4f}\n"
        f"Entry:     ${signal.entry:.4f}\n"
        f"Target 1:  ${signal.target_1:.4f}  (+{pct_t1:.1f}%)\n"
        f"Target 2:  ${signal.target_2:.4f}  (+{pct_t2:.1f}%)\n"
        f"Stop Loss: ${signal.stop_loss:.4f}  ({pct_sl:.1f}%)\n"
        f"R:R        {signal.risk_reward:.1f}:1\n"
        f"\n"
        f"WHY:\n"
        f"  Whale:     {signal.why_whale}\n"
        f"  Liquidity: {signal.why_liquidity}\n"
        f"  Sentiment: {signal.why_sentiment}\n"
        f"\n"
        f"THESIS: {signal.thesis}\n"
        f"\n"
        f"Watchdog: ACTIVE"
    )

def signal_keyboard(signal) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup([
        [
            InlineKeyboardButton("ENTER AT MARKET", callback_data=f"enter|{signal.symbol}|{signal.entry}"),
            InlineKeyboardButton("SKIP", callback_data="skip"),
        ],
        [InlineKeyboardButton("PANIC CALC", callback_data=f"panic|{signal.symbol}")],
    ])


# ─────────────────────────────────────────────
# COMMAND HANDLERS
# ─────────────────────────────────────────────

async def cmd_start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not is_authorized(update):
        return
    await update.message.reply_text(
        "AirClaw Intelligence Engine\n"
        "Jane Street-grade signal system\n\n"
        "Commands:\n"
        "/scan   — scan watchlist now\n"
        "/status — active watchdog positions\n"
        "/panic  — risk assessment\n"
        "/close  — close position\n"
        "/gate   — run AlphaEvolve simulation\n"
    )


async def cmd_scan(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not is_authorized(update):
        return
    await update.message.reply_text("Scanning watchlist... (this takes ~15s)")

    try:
        signals = await orchestrator.scan_watchlist(WATCHLIST)
    except Exception as e:
        log.error(f"Scan error: {e}")
        await update.message.reply_text(f"Scan error: {e}")
        return

    if not signals:
        await update.message.reply_text(
            "No signals above threshold.\n"
            f"Gate: {orchestrator.convergence.SIGNAL_GATE}% confidence required.\n"
            "Market conditions below convergence threshold."
        )
        return

    for signal in signals:
        msg = fmt_signal_message(signal)
        kb  = signal_keyboard(signal)
        await update.message.reply_text(msg, reply_markup=kb)


async def cmd_status(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not is_authorized(update):
        return
    user_id = update.effective_user.id
    pos = orchestrator.watchdog.positions.get(user_id)

    if not pos:
        await update.message.reply_text("No active watchdog positions.")
        return

    # Get current price for P&L
    try:
        # Find coin_id from watchlist
        entry_symbol = pos["symbol"]
        wl_entry = next((w for w in WATCHLIST if w["symbol"] == entry_symbol), None)
        if wl_entry:
            price_data = await orchestrator.researcher.coingecko.get_price(wl_entry["coin_id"])
            current_price = price_data["price_usd"] if price_data else pos["entry"]
        else:
            current_price = pos["entry"]
    except Exception:
        current_price = pos["entry"]

    status = orchestrator.watchdog.get_status(user_id, current_price)
    pnl = status["pnl_pct"]
    pnl_str = f"+{pnl:.2f}%" if pnl >= 0 else f"{pnl:.2f}%"

    msg = (
        f"WATCHDOG STATUS\n\n"
        f"Symbol:   {status['symbol']}\n"
        f"Entry:    ${status['entry']:.4f}\n"
        f"Current:  ${status['current']:.4f}\n"
        f"P&L:      {pnl_str}\n"
        f"Target 1: ${status['target_1']:.4f}\n"
        f"Target 2: ${status['target_2']:.4f}\n"
        f"Stop:     ${status['stop_loss']:.4f}\n"
        f"Status:   {status['status']}\n"
        f"Active:   {status['hours_active']}h"
    )
    await update.message.reply_text(msg)


async def cmd_panic(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not is_authorized(update):
        return
    user_id = update.effective_user.id
    pos = orchestrator.watchdog.positions.get(user_id)

    if not pos:
        await update.message.reply_text("No active position. Nothing to panic about.")
        return

    try:
        wl_entry = next((w for w in WATCHLIST if w["symbol"] == pos["symbol"]), None)
        if wl_entry:
            price_data = await orchestrator.researcher.coingecko.get_price(wl_entry["coin_id"])
            current_price = price_data["price_usd"] if price_data else pos["entry"]
        else:
            current_price = pos["entry"]
    except Exception:
        current_price = pos["entry"]

    status = orchestrator.watchdog.get_status(user_id, current_price)
    pnl = status["pnl_pct"]

    if pnl > 0:
        recommendation = f"Position is profitable (+{pnl:.2f}%). Recommend holding to Target 1 (${status['target_1']:.4f})."
    elif pnl > -3:
        recommendation = f"Position is at {pnl:.2f}%. Within normal variance. Stop at ${status['stop_loss']:.4f} is protection."
    else:
        recommendation = f"Position at {pnl:.2f}%. Approaching stop (${status['stop_loss']:.4f}). Consider exiting to protect capital."

    msg = (
        f"PANIC ASSESSMENT\n\n"
        f"P&L:            {'+' if pnl >= 0 else ''}{pnl:.2f}%\n"
        f"Entry:          ${status['entry']:.4f}\n"
        f"Current:        ${status['current']:.4f}\n"
        f"Stop Loss:      ${status['stop_loss']:.4f}\n"
        f"Distance to Stop: {((status['current'] - status['stop_loss']) / status['current']) * 100:.1f}%\n\n"
        f"RECOMMENDATION:\n{recommendation}"
    )

    kb = InlineKeyboardMarkup([[
        InlineKeyboardButton("CLOSE POSITION NOW", callback_data=f"close|{user_id}"),
        InlineKeyboardButton("HOLD", callback_data="hold"),
    ]])
    await update.message.reply_text(msg, reply_markup=kb)


async def cmd_close(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not is_authorized(update):
        return
    user_id = update.effective_user.id
    result = orchestrator.watchdog.close(user_id)
    await update.message.reply_text(f"Watchdog: {result}")


async def cmd_gate(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not is_authorized(update):
        return
    await update.message.reply_text("Running AlphaEvolve simulation (n=100)...")
    try:
        result = await orchestrator.run_gate_check()
        evolved = " [WEIGHTS EVOLVED]" if result.get("weights_evolved") else ""
        msg = (
            f"ALPHAEVOLVE GATE CHECK{evolved}\n\n"
            f"Sharpe Ratio:  {result['sharpe_ratio']}\n"
            f"Win Rate:      {result['win_rate_pct']}%\n"
            f"Max Drawdown:  {result['max_drawdown_pct']}%\n"
            f"Avg Return:    {result['avg_return_pct']}%\n"
            f"Signals (n):   {result['n_signals']}\n"
            f"Gate (>={orchestrator.alpha_evolve.SHARPE_GATE}): {'PASSED' if result['passed_gate'] else 'FAILED'}\n\n"
            f"Active Weights:\n"
            f"  Whale:     {orchestrator.convergence.weights['whale']:.0%}\n"
            f"  Liquidity: {orchestrator.convergence.weights['liquidity']:.0%}\n"
            f"  Sentiment: {orchestrator.convergence.weights['sentiment']:.0%}"
        )
        await update.message.reply_text(msg)
    except Exception as e:
        await update.message.reply_text(f"Gate check error: {e}")


# ─────────────────────────────────────────────
# CALLBACK HANDLERS (inline button presses)
# ─────────────────────────────────────────────

async def handle_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    user_id = query.from_user.id
    data = query.data

    if data.startswith("enter|"):
        _, symbol, entry_str = data.split("|")
        entry = float(entry_str)
        # Build a minimal signal for watchdog
        pos = orchestrator.watchdog.positions.get(user_id)
        if not pos:
            # Find the signal in log
            recent = next(
                (s for s in reversed(orchestrator.signal_log) if s.symbol == symbol), None
            )
            if recent:
                msg = orchestrator.watchdog.activate(user_id, recent)
            else:
                msg = "Signal expired. Re-run /scan."
        else:
            msg = "Position already active. Use /status."
        await query.edit_message_text(query.message.text + f"\n\n{msg}")

    elif data.startswith("close|"):
        target_uid = int(data.split("|")[1])
        result = orchestrator.watchdog.close(target_uid)
        await query.edit_message_text(f"Watchdog closed: {result}")

    elif data == "hold":
        await query.edit_message_text(query.message.text + "\n\nHolding position.")

    elif data == "skip":
        await query.edit_message_text("Signal skipped. No watchdog activated.")

    elif data.startswith("panic|"):
        await query.edit_message_text("Use /panic command for full assessment.")


# ─────────────────────────────────────────────
# SCHEDULED SCANNER — fires every 15 minutes
# WHY: Autonomous scanning without user prompting = the "self-aware" part
# ─────────────────────────────────────────────

async def scheduled_scan(context: ContextTypes.DEFAULT_TYPE):
    """
    Auto-scan fired by JobQueue every 15 minutes.
    Sends signal alerts to all authorized chats automatically.
    """
    log.info("Scheduled scan starting...")
    try:
        signals = await orchestrator.scan_watchlist(WATCHLIST)
        if not signals:
            log.info("Scheduled scan: no signals above threshold")
            return

        for chat_id in ALLOWED_CHAT_IDS:
            for signal in signals:
                msg = fmt_signal_message(signal)
                kb  = signal_keyboard(signal)
                try:
                    await context.bot.send_message(
                        chat_id=chat_id,
                        text=msg,
                        reply_markup=kb,
                    )
                except Exception as e:
                    log.error(f"Failed to send to {chat_id}: {e}")
    except Exception as e:
        log.error(f"Scheduled scan error: {e}")


# ─────────────────────────────────────────────
# BOT FACTORY
# ─────────────────────────────────────────────

def build_application(orch) -> Application:
    """
    Build and return the Telegram Application.
    Called by main.py after orchestrator is ready.
    """
    global orchestrator
    orchestrator = orch

    app = Application.builder().token(TOKEN).build()

    # Commands
    app.add_handler(CommandHandler("start",  cmd_start))
    app.add_handler(CommandHandler("scan",   cmd_scan))
    app.add_handler(CommandHandler("status", cmd_status))
    app.add_handler(CommandHandler("panic",  cmd_panic))
    app.add_handler(CommandHandler("close",  cmd_close))
    app.add_handler(CommandHandler("gate",   cmd_gate))

    # Inline buttons
    app.add_handler(CallbackQueryHandler(handle_callback))

    # Scheduled scanner — every 15 minutes
    if ALLOWED_CHAT_IDS:
        app.job_queue.run_repeating(
            scheduled_scan,
            interval=900,   # 15 minutes
            first=60,       # First scan 60s after startup
        )
        log.info(f"Scheduled scanner armed: every 15min to {len(ALLOWED_CHAT_IDS)} chats")

    return app
