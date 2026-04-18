# AIDER PROMPTS FOR AIRCLAW
# Use: aider --model qwen2.5-coder:7b <file>
# These tasks are safe for aider. Core engine logic stays with Claude.
# ════════════════════════════════════════════════════════════════

# ── PROMPT 1: Add Binance order book client ──────────────────────
# Run: aider --model qwen2.5-coder:7b api/clients.py tests/test_clients.py
"""
Add a BinanceClient class to api/clients.py.

Follow the exact pattern of CoinGeckoClient.
BASE = f"{PROXY_BASE}/binance"
No API key needed for public endpoints.

Methods:
  async get_order_book(symbol: str, limit: int = 20) -> Optional[dict]
    URL: f"{self.BASE}/api/v3/depth?symbol={symbol.replace('/','')}USDT&limit={limit}"
    Returns: {"bids": list, "asks": list, "spread": float, "bid_wall": float, "ask_wall": float}
    bid_wall = largest single bid price × size product in top 10 bids
    ask_wall = largest single ask price × size product in top 10 asks

  async get_funding_rate(symbol: str) -> Optional[dict]
    URL: f"{self.BASE}/fapi/v1/fundingRate?symbol={symbol}USDT&limit=1"
    Returns: {"rate": float, "next_funding_time": str}

  def detect_bid_wall_score(self, order_book: dict) -> float
    If bid_wall > ask_wall * 1.5 → strong bid support → score 0.7-0.9
    If bid_wall < ask_wall * 0.7 → ask pressure → score 0.2-0.4
    Otherwise → neutral → 0.5
    Returns float 0-1

Add tests in tests/test_clients.py:
  - test_order_book_structure: mock response, verify keys exist
  - test_bid_wall_detection_bullish: bid_wall >> ask_wall → score > 0.6
  - test_bid_wall_detection_bearish: ask_wall >> bid_wall → score < 0.5
"""

# ── PROMPT 2: Add __init__.py files ──────────────────────────────
# Run: aider --model qwen2.5-coder:7b .
"""
Create empty __init__.py files in these directories:
  airclaw/api/__init__.py
  airclaw/core/__init__.py
  airclaw/bot/__init__.py
  airclaw/tests/__init__.py

Also create a pytest.ini in the root with:
  [pytest]
  asyncio_mode = auto
  testpaths = tests
  log_cli = true
  log_cli_level = INFO
"""

# ── PROMPT 3: Add logging decorator ──────────────────────────────
# Run: aider --model qwen2.5-coder:7b core/engine.py
"""
Add a timing decorator to core/engine.py called `@timed_async`.
It should:
  - Log the function name and elapsed time in ms on completion
  - Log any exception with full traceback before re-raising
  - Use loguru or the existing logging module (match what's in the file)

Apply it to:
  - AirClawOrchestrator.generate_signal
  - AirClawOrchestrator.scan_watchlist
  - AirClawOrchestrator.run_gate_check

Example log output:
  [engine] generate_signal completed in 2341ms
  [engine] scan_watchlist completed in 7823ms
"""

# ── PROMPT 4: Add /watchlist command to bot ───────────────────────
# Run: aider --model qwen2.5-coder:7b bot/telegram_bot.py
"""
Add a /watchlist command to bot/telegram_bot.py.

It should:
  - Display the current WATCHLIST (symbol, coin_id)
  - Show current price for each symbol (call get_price from CoinGeckoClient)
  - Show 24h change % for each
  - Format as a clean plain-text table

Register it in build_application() with:
  app.add_handler(CommandHandler("watchlist", cmd_watchlist))

The handler must be async and check is_authorized(update).
"""

# ── PROMPT 5: Add scan results summary command ────────────────────
# Run: aider --model qwen2.5-coder:7b bot/telegram_bot.py
"""
Add a /history command to bot/telegram_bot.py.

It should:
  - Show the last 5 signals from orchestrator.signal_log
  - Display: symbol, action, confidence, timestamp, price
  - If no history: "No signals fired yet."

Register in build_application().
"""
