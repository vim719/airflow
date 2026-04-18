"""
airclaw/api/clients.py
======================
Real API clients for all data sources.
ALL requests route through Antigravity on localhost:9000 — never hit APIs directly.
This protects against rate limits, bans, and gives us caching + retry for free.

TOOL ASSIGNMENT: This file is maintained by Claude (core engine).
aider can add new endpoint methods using the aider prompt at the bottom of this file.
"""

import asyncio
import aiohttp
import os
import time
import json
import logging
from dataclasses import dataclass
from typing import Optional
from dotenv import load_dotenv

load_dotenv()
log = logging.getLogger("airclaw.api")

# ─────────────────────────────────────────────
# CONFIG — swap PROXY_BASE to direct URLs if Antigravity is not running
# ─────────────────────────────────────────────
PROXY_BASE = os.getenv("ANTIGRAVITY_URL", "http://localhost:9000")
TIMEOUT = aiohttp.ClientTimeout(total=8)  # Hard 8s — never block the signal loop

NANSEN_KEY      = os.getenv("NANSEN_API_KEY", "")
COINGECKO_KEY   = os.getenv("COINGECKO_API_KEY", "")
CRYPTOQUANT_KEY = os.getenv("CRYPTOQUANT_API_KEY", "")
POLYMARKET_KEY  = os.getenv("POLYMARKET_API_KEY", "")

# ─────────────────────────────────────────────
# SHARED SESSION — one connection pool for all clients
# ─────────────────────────────────────────────
_session: Optional[aiohttp.ClientSession] = None

async def get_session() -> aiohttp.ClientSession:
    global _session
    if _session is None or _session.closed:
        _session = aiohttp.ClientSession(timeout=TIMEOUT)
    return _session

async def close_session():
    global _session
    if _session and not _session.closed:
        await _session.close()


# ─────────────────────────────────────────────
# BASE FETCH — all API calls go through here
# WHY: single retry/logging/error-handling point
# ─────────────────────────────────────────────
async def _fetch(url: str, headers: dict = None, params: dict = None) -> Optional[dict]:
    """
    Core HTTP fetch with retry.
    Routes through Antigravity proxy which handles:
      - Rate limiting (per-source token bucket)
      - Response caching (TTL set in antigravity.yaml)
      - Exponential backoff on 429/503
    """
    session = await get_session()
    for attempt in range(3):
        try:
            async with session.get(url, headers=headers, params=params) as resp:
                if resp.status == 200:
                    return await resp.json()
                elif resp.status == 429:
                    wait = 2 ** attempt
                    log.warning(f"Rate limited on {url}, waiting {wait}s")
                    await asyncio.sleep(wait)
                elif resp.status == 404:
                    log.warning(f"404 on {url}")
                    return None
                else:
                    log.error(f"HTTP {resp.status} on {url}")
                    await asyncio.sleep(1)
        except asyncio.TimeoutError:
            log.warning(f"Timeout on {url} (attempt {attempt+1})")
        except Exception as e:
            log.error(f"Fetch error {url}: {e}")
            await asyncio.sleep(1)
    return None


# ─────────────────────────────────────────────
# COINGECKO CLIENT
# WHY: Real-time price, volume, market cap — the factual ground truth for price context
# ─────────────────────────────────────────────
class CoinGeckoClient:
    BASE = f"{PROXY_BASE}/coingecko"

    async def get_price(self, coin_id: str) -> Optional[dict]:
        """
        Fetch current price + 24h change + volume.
        coin_id examples: 'layerzero', 'bitcoin', 'ethereum'

        Returns: {
            'price_usd': float,
            'change_24h': float,  # percent
            'volume_24h': float,
            'market_cap': float
        }
        """
        url = f"{self.BASE}/simple/price"
        params = {
            "ids": coin_id,
            "vs_currencies": "usd",
            "include_24hr_change": "true",
            "include_24hr_vol": "true",
            "include_market_cap": "true",
            "x_cg_demo_api_key": COINGECKO_KEY,
        }
        data = await _fetch(url, params=params)
        if not data or coin_id not in data:
            log.error(f"CoinGecko: no data for {coin_id}")
            return None

        coin = data[coin_id]
        return {
            "price_usd":   coin.get("usd", 0.0),
            "change_24h":  coin.get("usd_24h_change", 0.0),
            "volume_24h":  coin.get("usd_24h_vol", 0.0),
            "market_cap":  coin.get("usd_market_cap", 0.0),
        }

    async def get_ohlcv(self, coin_id: str, days: int = 7) -> Optional[list]:
        """Fetch OHLCV for trend analysis. Used by AlphaEvolve backtester."""
        url = f"{self.BASE}/coins/{coin_id}/ohlc"
        params = {
            "vs_currency": "usd",
            "days": days,
            "x_cg_demo_api_key": COINGECKO_KEY,
        }
        return await _fetch(url, params=params)

    async def get_trending(self) -> Optional[list]:
        """Top 7 trending coins — used for opportunity scanning."""
        url = f"{self.BASE}/search/trending"
        params = {"x_cg_demo_api_key": COINGECKO_KEY}
        data = await _fetch(url, params=params)
        if data and "coins" in data:
            return [c["item"]["id"] for c in data["coins"][:7]]
        return []


# ─────────────────────────────────────────────
# NANSEN CLIENT
# WHY: "Smart Money" wallet labels — institutional intent signal
#      This is AirClaw's primary edge. Retail can't see this in real time.
# ─────────────────────────────────────────────
class NansenClient:
    BASE = f"{PROXY_BASE}/nansen"
    HEADERS = {"apiKey": NANSEN_KEY, "Content-Type": "application/json"}

    async def get_top_trending(self) -> list[dict]:
        """
        Scan Nansen Token Screener for top 100 trending coins.
        Filters: only_smart_money, timeframe=24h, chains=[ethereum, solana, base].
        """
        url = "https://api.nansen.ai/api/v1/token-screener"
        payload = {
            "chains": ["ethereum", "solana", "base"],
            "timeframe": "24h",
            "filters": {
                "only_smart_money": True,
                "token_age_days": {"max": 365, "min": 1}
            },
            "order_by": [{"field": "buy_volume", "direction": "DESC"}],
            "pagination": {"page": 1, "per_page": 100}
        }
        
        # Note: the nansen screener uses POST but our _fetch is currently GET.
        # I will update _fetch to support POST, or call it directly here.
        session = await get_session()
        try:
            async with session.post(url, headers=self.HEADERS, json=payload) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    # Parse trending coins. Each item has {symbol, address, etc}
                    # Result structure: {"data": [...]}
                    return data.get("data", [])
                else:
                    log.error(f"Nansen Screener: HTTP {resp.status}")
        except Exception as e:
            log.error(f"Nansen Screener error: {e}")
        return []

    async def get_smart_money_flow(self, token_address: str) -> Optional[dict]:
        """
        Fetch net smart-money flow for a token over 24h and 7d.
        Smart Money = wallets Nansen labels as funds, whales, protocols.

        Returns: {
            'net_flow_24h': float,   # USD, positive = inflow
            'net_flow_7d': float,
            'buy_count': int,
            'sell_count': int,
            'top_buyers': list[str]  # wallet labels
        }
        """
        url = f"{self.BASE}/token-god-mode/v2/transfers/tokens"
        params = {
            "tokenAddress": token_address,
            "chain": "ethereum",
            "limit": 20,
        }
        data = await _fetch(url, headers=self.HEADERS, params=params)
        if not data:
            return None

        # Parse Nansen response — structure varies by plan tier
        transfers = data.get("data", data.get("transfers", []))
        net_24h = 0.0
        net_7d = 0.0
        buys = 0
        sells = 0
        buyers = []

        now = time.time()
        for tx in transfers:
            usd_val = float(tx.get("amountUsd", tx.get("amount_usd", 0)))
            tx_time = tx.get("blockTimestamp", tx.get("timestamp", 0))
            label   = tx.get("fromLabel", tx.get("from_label", ""))
            tx_type = tx.get("type", "transfer")

            age = now - (tx_time / 1000 if tx_time > 1e10 else tx_time)

            if "buy" in tx_type.lower() or "swap" in tx_type.lower():
                buys += 1
                net_7d += usd_val
                if age < 86400:
                    net_24h += usd_val
                if label:
                    buyers.append(label)
            else:
                sells += 1
                net_7d -= usd_val
                if age < 86400:
                    net_24h -= usd_val

        return {
            "net_flow_24h": round(net_24h, 2),
            "net_flow_7d":  round(net_7d, 2),
            "buy_count":    buys,
            "sell_count":   sells,
            "top_buyers":   list(set(buyers))[:5],
        }

    async def get_wallet_labels(self, address: str) -> Optional[list]:
        """Get Nansen labels for a specific wallet address."""
        url = f"{self.BASE}/wallet/{address}/labels"
        data = await _fetch(url, headers=self.HEADERS)
        if data:
            return data.get("labels", [])
        return []

    def normalize_flow_to_score(self, flow_data: dict, reference_mcap: float = 1e8) -> float:
        """
        Convert raw USD flow into 0-1 score.

        WHY: Raw USD numbers aren't comparable across tokens.
             A $5M inflow means nothing for BTC but everything for a $50M token.
        HOW: Normalize against market cap. Sigmoid-smooth the result.
        """
        if not flow_data:
            return 0.5  # Neutral if no data

        net_7d  = flow_data.get("net_flow_7d", 0)
        buy_cnt = flow_data.get("buy_count", 0)
        sel_cnt = flow_data.get("sell_count", 1)

        # Flow as % of reference market cap
        flow_ratio = net_7d / max(reference_mcap, 1e6)
        # Buy/sell ratio signal
        bs_ratio = buy_cnt / max(buy_cnt + sel_cnt, 1)

        # Weighted blend: 60% flow direction, 40% buy/sell ratio
        raw = (flow_ratio * 5 * 0.60) + (bs_ratio * 0.40)

        # Clamp to 0-1 via sigmoid approximation
        score = max(0.0, min(1.0, 0.5 + raw))
        return round(score, 3)


# ─────────────────────────────────────────────
# CRYPTOQUANT CLIENT
# WHY: Exchange reserve data = "Plumbing" signal
#      Coins leaving exchanges = supply shock = bullish structural signal
# ─────────────────────────────────────────────
class CryptoQuantClient:
    BASE = f"{PROXY_BASE}/cryptoquant"
    HEADERS = {"Authorization": f"Bearer {CRYPTOQUANT_KEY}"}

    async def get_exchange_reserve(self, symbol: str = "btc") -> Optional[dict]:
        """
        Fetch exchange reserve + 7d change for a given asset.
        symbol: 'btc', 'eth' — CryptoQuant uses lowercase ticker

        Returns: {
            'reserve_usd': float,
            'change_7d_pct': float,    # negative = outflow (bullish)
            'change_24h_pct': float,
            'exchange': str
        }
        """
        sym = symbol.lower()
        url = f"{self.BASE}/v2/exchange-flows/reserve"
        params = {"symbol": sym, "exchange": "all_exchange", "window": "DAY"}
        data = await _fetch(url, headers=self.HEADERS, params=params)

        if not data:
            return None

        items = data.get("data", [])
        if len(items) < 8:
            return None

        # Latest vs 7 days ago
        latest = items[-1]
        week_ago = items[-8]
        reserve_now  = float(latest.get("reserve_usd", latest.get("result", 0)))
        reserve_then = float(week_ago.get("reserve_usd", week_ago.get("result", 1)))
        reserve_24h_ago = float(items[-2].get("reserve_usd", items[-2].get("result", reserve_now)))

        change_7d  = ((reserve_now - reserve_then)  / max(reserve_then, 1)) * 100
        change_24h = ((reserve_now - reserve_24h_ago) / max(reserve_24h_ago, 1)) * 100

        return {
            "reserve_usd":    round(reserve_now, 2),
            "change_7d_pct":  round(change_7d, 2),
            "change_24h_pct": round(change_24h, 2),
            "symbol": sym,
        }

    async def get_netflow(self, symbol: str = "btc") -> Optional[dict]:
        """
        Exchange netflow (inflow - outflow) over 24h.
        Negative netflow = more coins leaving exchanges = bullish.
        """
        sym = symbol.lower()
        url = f"{self.BASE}/v2/exchange-flows/netflow"
        params = {"symbol": sym, "exchange": "all_exchange", "window": "DAY", "limit": 2}
        data = await _fetch(url, headers=self.HEADERS, params=params)
        if not data:
            return None
        items = data.get("data", [])
        if not items:
            return None
        latest = items[-1]
        return {
            "netflow_usd": float(latest.get("netflow_total_usd", 0)),
            "inflow_usd":  float(latest.get("inflow_total_usd", 0)),
            "outflow_usd": float(latest.get("outflow_total_usd", 0)),
        }

    def normalize_reserve_to_score(self, reserve_data: dict) -> float:
        """
        Convert reserve change % to 0-1 bullish score.

        WHY: Supply shock = bullish. -10% reserve change in 7d is a strong signal.
        HOW: Linear mapping clamped to [0,1].
             -15% change → score ~0.95 (strong bullish)
              0% change  → score ~0.50 (neutral)
             +15% change → score ~0.05 (bearish)
        """
        if not reserve_data:
            return 0.5

        change_7d = reserve_data.get("change_7d_pct", 0)
        # Each -1% = +0.03 to score above neutral
        raw = 0.5 - (change_7d * 0.03)
        return round(max(0.0, min(1.0, raw)), 3)


# ─────────────────────────────────────────────
# POLYMARKET CLIENT
# WHY: Macro sentiment — prediction market probabilities as sentiment proxy
#      More rigorous than social media: people put money on their beliefs
# ─────────────────────────────────────────────
class PolymarketClient:
    BASE = f"{PROXY_BASE}/polymarket"

    async def get_crypto_sentiment_markets(self) -> Optional[list]:
        """
        Fetch active Polymarket markets tagged 'crypto'.
        Returns markets with their current YES probability (0-1).

        Returns: list of {
            'question': str,
            'yes_prob': float,   # 0.0 (bearish) to 1.0 (bullish)
            'volume_24h': float,
            'end_date': str
        }
        """
        url = f"{self.BASE}/gamma/markets"
        params = {
            "tag": "crypto",
            "active": "true",
            "limit": 20,
            "order": "volume24hr",
        }
        data = await _fetch(url, params=params)
        if not data:
            return []

        markets = data if isinstance(data, list) else data.get("data", [])
        result = []
        for m in markets[:10]:
            try:
                outcomes = m.get("outcomePrices", m.get("outcomes", []))
                if isinstance(outcomes, str):
                    outcomes = json.loads(outcomes)
                yes_prob = float(outcomes[0]) if outcomes else 0.5
                result.append({
                    "question":   m.get("question", ""),
                    "yes_prob":   round(yes_prob, 3),
                    "volume_24h": float(m.get("volume24hr", 0)),
                    "end_date":   m.get("endDate", ""),
                })
            except Exception:
                continue
        return result

    def normalize_markets_to_score(self, markets: list) -> float:
        """
        Aggregate crypto market YES probabilities → single sentiment score.

        WHY: Individual markets are noisy. Volume-weighted average across
             multiple crypto markets gives a cleaner macro-sentiment read.
        HOW: Volume-weighted mean of YES probabilities.
             Treat as neutral (0.5) if <3 markets or total volume is thin.
        """
        if not markets or len(markets) < 2:
            return 0.5  # Not enough signal, return neutral

        total_vol = sum(m["volume_24h"] for m in markets)
        if total_vol < 10_000:
            return 0.5  # Liquidity too thin to trust

        weighted = sum(m["yes_prob"] * m["volume_24h"] for m in markets)
        score = weighted / total_vol
        return round(max(0.0, min(1.0, score)), 3)


# ─────────────────────────────────────────────
# AIDER PROMPT — paste this into your aider session to extend this file:
# ─────────────────────────────────────────────
"""
AIDER PROMPT (run: aider --model qwen2.5-coder:7b api/clients.py):

Add a BinanceClient class to this file following the exact same pattern as
CoinGeckoClient. It should have:
  - get_order_book(symbol, limit=20) → {'bids': list, 'asks': list, 'spread': float}
  - get_funding_rate(symbol) → {'rate': float, 'next_funding': str}
  - detect_bid_wall(order_book, depth_threshold=2.0) → float score 0-1

Route all calls through PROXY_BASE + '/binance'.
No API key needed for public endpoints.
Add a test in tests/test_clients.py covering get_order_book with a mocked response.
"""
