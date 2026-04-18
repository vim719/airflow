"""
airclaw/main.py
===============
Single entry point. Boots:
  1. Logging
  2. Antigravity health check
  3. AlphaEvolve gate (validates weights before any live signal)
  4. Telegram bot (polling + job queue)

Run: python main.py

For demo: python main.py --demo
  Demo mode runs one immediate scan on startup and prints to terminal.
"""

import asyncio
import logging
import sys
import os
import argparse
import aiohttp
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

load_dotenv()

# ── Logging setup — file + console ──
os.makedirs("logs", exist_ok=True)
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s — %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler("logs/airclaw.log"),
    ]
)
log = logging.getLogger("airclaw.main")

# ── Imports after logging setup ──
from core.engine import AirClawOrchestrator, TradeSignal
from bot.telegram_bot import build_application, WATCHLIST
from api.clients import close_session

# ── FastAPI app setup ──
server = FastAPI(title="AirClaw Intelligence API")
server.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

active_signals: list[TradeSignal] = []
last_scan_time: float = 0

@server.get("/api/signals")
async def get_signals():
    return {
        "status": "live",
        "last_scan": last_scan_time,
        "count": len(active_signals),
        "signals": active_signals
    }

@server.get("/api/health")
async def health():
    return {"status": "ok", "engine": "AirClaw/1.0.0"}


# ─────────────────────────────────────────────
# STARTUP CHECKS
# ─────────────────────────────────────────────

def check_env():
    """Fail fast on missing critical config."""
    required = ["TELEGRAM_BOT_TOKEN", "ANTHROPIC_API_KEY"]
    optional = ["NANSEN_API_KEY", "COINGECKO_API_KEY", "CRYPTOQUANT_API_KEY", "POLYMARKET_API_KEY"]

    missing_required = [k for k in required if not os.getenv(k)]
    if missing_required:
        log.error(f"MISSING REQUIRED ENV VARS: {missing_required}")
        sys.exit(1)

    missing_optional = [k for k in optional if not os.getenv(k)]
    if missing_optional:
        log.warning(f"Missing optional API keys (signals will use neutral scores): {missing_optional}")

async def check_antigravity():
    """Verify Antigravity proxy is running."""
    proxy_url = os.getenv("ANTIGRAVITY_URL", "http://localhost:9000")
    try:
        async with aiohttp.ClientSession() as s:
            async with s.get(f"{proxy_url}/health", timeout=aiohttp.ClientTimeout(total=3)) as r:
                if r.status == 200:
                    log.info(f"Antigravity: OK at {proxy_url}")
                    return True
    except Exception:
        pass
    log.warning(f"Antigravity not responding at {proxy_url}. API calls will hit endpoints directly.")
    log.warning("Start Antigravity with: antigravity serve --port 9000")
    return False


# ─────────────────────────────────────────────
# DEMO MODE — terminal output for presentation
# ─────────────────────────────────────────────

async def run_demo(orchestrator: AirClawOrchestrator):
    """
    Demo mode: scan watchlist, print results to terminal.
    Shows the full pipeline running with real data.
    """
    print("\n" + "="*60)
    print("  AirClaw Intelligence Engine — DEMO MODE")
    print("  Jane Street Architecture | Real API Data")
    print("="*60 + "\n")

    # Gate check
    print("[1/3] Running AlphaEvolve gate check (n=100)...")
    gate = await orchestrator.run_gate_check()
    print(f"      Sharpe:    {gate['sharpe_ratio']}")
    print(f"      Win rate:  {gate['win_rate_pct']}%")
    print(f"      Gate:      {'PASSED' if gate['passed_gate'] else 'FAILED — weights evolved'}")
    if gate.get("weights_evolved"):
        print(f"      New weights: {gate.get('new_weights')}")
    print()

    # Scan
    print(f"[2/3] Scanning {len(WATCHLIST)} symbols with live API data...")
    print(f"      Symbols: {[w['symbol'] for w in WATCHLIST]}")
    print()
    signals = await orchestrator.scan_watchlist(WATCHLIST)

    if not signals:
        print("[3/3] No signals above threshold right now.")
        print(f"      Confidence gate: {orchestrator.convergence.SIGNAL_GATE}%")
        print("      This is correct behavior — AirClaw does NOT fire on weak setups.")
        print("\n      [DEMO OVERRIDE] Showing what a signal looks like...")
        _show_sample_signal()
    else:
        print(f"[3/3] {len(signals)} signal(s) fired:\n")
        for signal in signals:
            print(signal.to_telegram_message())
            print("-"*60)

    print("\nDEMO COMPLETE. In production, signals auto-deliver to Telegram.")
    print("Start full bot: python main.py")


def _show_sample_signal():
    """Shows a sample signal output for demo when no live signals fire."""
    print("""
AIRCLAW SIGNAL — BUY ZRO/USDT
Confidence: 92.4%

Price:     $4.5000
Entry:     $4.5000
Target 1:  $5.2650  (+17.0%)
Target 2:  $6.0750  (+35.0%)
Stop Loss: $4.1400  (-8.0%)
R:R        2.1:1

WHY:
  Whale:     Jump Crypto + DeFiance Capital net inflow $4.2M over 7d — labeled accumulation
  Liquidity: Exchange reserves -8.3% in 7 days — supply shock confirmed
  Sentiment: Polymarket crypto markets 67% YES probability — macro tailwind

THESIS: Institutional accumulation pattern confirmed via three independent signals.
Bear case: BTC macro correlation 0.78 — broader market reversal would invalidate.

Watchdog: ACTIVE — monitoring entry to exit
""")


# ─────────────────────────────────────────────
# BACKGROUND SCANNER
# ─────────────────────────────────────────────

async def background_scanner(orchestrator: AirClawOrchestrator):
    """
    Continuous market scanner. 
    1. Fetches trending tokens from Nansen Token Screener.
    2. Runs convergence analysis on each.
    3. Updates 'active_signals' for the API and Telegram.
    """
    global active_signals, last_scan_time
    
    while True:
        try:
            log.info("Starting background scan cycle...")
            
            # Step 1: Get market opportunities via Nansen Screener
            trending = await orchestrator.researcher.nansen.get_top_trending()
            if not trending:
                log.warning("Nansen Screener returned no trending tokens.")
                await asyncio.sleep(300)
                continue
            
            # Formulate scan list (limit to top 10 for performance/rate limits)
            scan_list = []
            for t in trending[:10]:
                scan_list.append({
                    "symbol": f"{t.get('ticker')}/USDT",
                    "coin_id": t.get("id"), # Might need mapping or CG check
                    "token_address": t.get("address"),
                    "cq_symbol": "eth" # Standard liquid baseline
                })
            
            # Step 2: Run convergence orchestrator
            signals = await orchestrator.scan_watchlist(scan_list)
            
            # Step 3: Update state
            active_signals = signals
            last_scan_time = time.time()
            log.info(f"Scan complete. Found {len(signals)} high-confidence signals.")
            
        except Exception as e:
            log.error(f"Scanner loop error: {e}")
            
        await asyncio.sleep(600) # Scan every 10 minutes

# ─────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────

async def main():
    parser = argparse.ArgumentParser(description="AirClaw Intelligence Engine")
    parser.add_argument("--demo",  action="store_true", help="Demo mode: scan once and print")
    parser.add_argument("--gate",  action="store_true", help="Run gate check only and exit")
    args = parser.parse_args()

    log.info("AirClaw starting up...")
    check_env()
    await check_antigravity()

    # Build orchestrator
    orchestrator = AirClawOrchestrator()
    log.info("Orchestrator initialized")

    if args.gate:
        result = await orchestrator.run_gate_check()
        print(f"Gate result: {result}")
        await close_session()
        return

    if args.demo:
        await run_demo(orchestrator)
        await close_session()
        return

    # ── Production mode: run gate check, then start bot and web server ──
    log.info("Running startup gate check...")
    gate = await orchestrator.run_gate_check()
    if not gate["passed_gate"]:
        log.warning(f"Gate check Sharpe={gate['sharpe_ratio']} — weights were evolved, continuing")

    # Start background scanner
    asyncio.create_task(background_scanner(orchestrator))

    log.info("Starting Telegram bot...")
    app = build_application(orchestrator)

    # Start API server in the background
    config = uvicorn.Config(server, host="0.0.0.0", port=8000, log_level="info")
    uvicorn_server = uvicorn.Server(config)
    asyncio.create_task(uvicorn_server.serve())

    # Run bot (blocking)
    async with app:
        await app.start()
        await app.updater.start_polling(drop_pending_updates=True)
        log.info("Bot is polling. API server is live at :8000. Send /start to your bot.")
        try:
            await asyncio.Event().wait()  # Block forever
        except (KeyboardInterrupt, asyncio.CancelledError):
            log.info("Shutting down...")
        finally:
            await app.updater.stop()
            await app.stop()

    await close_session()
    log.info("AirClaw stopped.")


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass
