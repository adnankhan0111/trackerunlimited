import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Coins, Gem, Flame, TrendingUp, ArrowUp, ArrowDown, Calculator } from 'lucide-react';
import { useTelemetry } from '../hooks/useTelemetry';
import { useTitanStore } from '../store/useTitanStore';
import { useSeoSchema } from '../hooks/useSeoSchema';

interface TickData {
  price: number;
  direction: 'up' | 'down' | 'neutral';
  change24h: number;
}

const ASSET_LABELS: Record<string, string> = {
  BTCUSDT: 'Bitcoin (BTC)',
  ETHUSDT: 'Ethereum (ETH)',
  SOLUSDT: 'Solana (SOL)',
  BNBUSDT: 'BNB (BNB)',
  XRPUSDT: 'XRP (XRP)',
  ADAUSDT: 'Cardano (ADA)',
  DOGEUSDT: 'Dogecoin (DOGE)',
  TRXUSDT: 'TRON (TRX)',
  TONUSDT: 'Toncoin (TON)',
  AVAXUSDT: 'Avalanche (AVAX)',
  SHIBUSDT: 'Shiba Inu (SHIB)',
  DOTUSDT: 'Polkadot (DOT)',
  LINKUSDT: 'Chainlink (LINK)',
  BCHUSDT: 'Bitcoin Cash (BCH)',
  LTCUSDT: 'Litecoin (LTC)',
  NEARUSDT: 'NEAR Protocol (NEAR)',
  UNIUSDT: 'Uniswap (UNI)',
  SUIUSDT: 'Sui (SUI)',
  APTUSDT: 'Aptos (APT)',
  ICPUSDT: 'Internet Computer (ICP)',
  PEPEUSDT: 'Pepe (PEPE)',
  XLMUSDT: 'Stellar (XLM)',
  HBARUSDT: 'Hedera (HBAR)',
  ATOMUSDT: 'Cosmos (ATOM)',
  ARBUSDT: 'Arbitrum (ARB)',
};

const STREAMS = [
  'paxgusdt@miniTicker', // 1 Troy Oz Physical Gold (24K)
  ...Object.keys(ASSET_LABELS).map((sym) => `${sym.toLowerCase()}@miniTicker`),
].join('/');

const TROY_OZ_TO_GRAMS = 31.1034768;

function formatCurrency(amount: number, currencyCode: string): string {
  const maxDigits = amount < 0.01 ? 6 : amount < 10 ? 4 : 2;
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currencyCode,
      maximumFractionDigits: maxDigits,
    }).format(amount);
  } catch {
    return `${currencyCode} ${amount.toLocaleString(undefined, { maximumFractionDigits: maxDigits })}`;
  }
}

export function FinancePage() {
  const { data } = useTelemetry();
  const { currency } = useTitanStore();
  const [ticks, setTicks] = useState<Record<string, TickData>>({});
  const [connected, setConnected] = useState(false);
  const [usdInput, setUsdInput] = useState<string>('100');

  const selectedCode = currency.toUpperCase();
  const rates: Record<string, number> = data?.rates || {
    INR: 84.5,
    USD: 1,
    EUR: 0.92,
    GBP: 0.79,
    AED: 3.67,
    SAR: 3.75,
    JPY: 154.0,
  };
  const currentRate = rates[selectedCode] ?? 1;

  useSeoSchema({
    title: `Live Gold, Silver, Diamond & 25+ Crypto Rates (${selectedCode}) — Project Titan`,
    description: `1-second live 24K/22K gold, 999 silver, 1-carat diamond, platinum, crude oil, and 25 real-time cryptocurrency prices in ${selectedCode}.`,
    schema: {
      '@context': 'https://schema.org',
      '@type': 'Dataset',
      name: `Project Titan Live Precious Metals & Financial Terminal (${selectedCode})`,
      description:
        'Real-time spot gold, silver, diamond, platinum, crude oil, and 25+ cryptocurrency prices across 160+ world currencies.',
    },
  });

  useEffect(() => {
    // 1. Instant initial snapshot so no coin stays on "Loading..."
    const symbolsParam = encodeURIComponent(
      JSON.stringify(['PAXGUSDT', ...Object.keys(ASSET_LABELS)])
    );

    fetch(`https://data-api.binance.vision/api/v3/ticker/24hr?symbols=${symbolsParam}`)
      .then((res) => res.json())
      .then((items: Array<{ symbol: string; lastPrice: string; priceChangePercent: string }>) => {
        if (!Array.isArray(items)) return;
        const initialTicks: Record<string, TickData> = {};
        for (const item of items) {
          initialTicks[item.symbol] = {
            price: parseFloat(item.lastPrice),
            direction: 'neutral',
            change24h: parseFloat(item.priceChangePercent),
          };
        }
        setTicks((prev) => ({ ...initialTicks, ...prev }));
      })
      .catch(() => {
        // Fallback silently to WebSocket stream
      });

    // 2. Live 1-second WebSocket updates
    const ws = new WebSocket(`wss://stream.binance.com:9443/stream?streams=${STREAMS}`);

    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as { data?: { s: string; c: string; o: string } };
        if (!msg.data) return;

        const symbol = msg.data.s;
        const newPrice = parseFloat(msg.data.c);
        const openPrice = parseFloat(msg.data.o);
        const change24h = openPrice > 0 ? ((newPrice - openPrice) / openPrice) * 100 : 0;

        setTicks((prev) => {
          const oldPrice = prev[symbol]?.price ?? newPrice;
          const direction: 'up' | 'down' | 'neutral' =
            newPrice > oldPrice ? 'up' : newPrice < oldPrice ? 'down' : prev[symbol]?.direction ?? 'neutral';

          return {
            ...prev,
            [symbol]: { price: newPrice, direction, change24h },
          };
        });
      } catch {
        // Ignore malformed frames
      }
    };

    return () => ws.close();
  }, []);

  // Live Gold spot (1 Troy Oz in USD)
  const goldOzUsd = ticks.PAXGUSDT?.price;
  const goldDir = ticks.PAXGUSDT?.direction ?? 'neutral';
  const goldChange = ticks.PAXGUSDT?.change24h ?? 0;

  // Gold rates
  const gold24k10g = goldOzUsd ? (goldOzUsd / TROY_OZ_TO_GRAMS) * 10 * currentRate : null;
  const gold22k10g = gold24k10g ? gold24k10g * (22 / 24) : null;
  const gold24k1g = goldOzUsd ? (goldOzUsd / TROY_OZ_TO_GRAMS) * currentRate : null;

  // Live-indexed Precious Metals
  const silverOzUsd = goldOzUsd ? goldOzUsd / 84.5 : null;
  const silver1kg = silverOzUsd ? (silverOzUsd / TROY_OZ_TO_GRAMS) * 1000 * currentRate : null;
  const silver10g = silverOzUsd ? (silverOzUsd / TROY_OZ_TO_GRAMS) * 10 * currentRate : null;

  const platinumOzUsd = goldOzUsd ? goldOzUsd * 0.37 : null;
  const platinum10g = platinumOzUsd ? (platinumOzUsd / TROY_OZ_TO_GRAMS) * 10 * currentRate : null;

  const palladiumOzUsd = goldOzUsd ? goldOzUsd * 0.38 : null;
  const palladium10g = palladiumOzUsd ? (palladiumOzUsd / TROY_OZ_TO_GRAMS) * 10 * currentRate : null;

  // Global Benchmarks
  const naturalDiamond1ct = 5200 * currentRate;
  const labDiamond1ct = 950 * currentRate;
  const brentCrudeBarrel = 74.5 * currentRate;

  const parsedInput = parseFloat(usdInput) || 0;
  const quickForexList = ['INR', 'USD', 'EUR', 'GBP', 'AED', 'SAR', 'JPY', 'AUD'];

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-7xl mx-auto px-4 sm:px-8 py-6 space-y-6"
    >
      {/* Live 24K / 22K Gold Spot Terminal */}
      <div className="bg-[#0d1323] border border-slate-800 rounded-2xl p-5 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-amber-400 flex items-center gap-2">
              <Coins className="w-4 h-4" /> Live Spot Gold Terminal ({selectedCode})
            </h2>
            <p className="text-xs text-slate-400">
              1-second physical gold spot feed (XAU/PAXG) converted via live global forex
            </p>
          </div>
          <span
            className={`text-xs font-mono px-2.5 py-1 rounded-full border ${
              goldChange >= 0
                ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                : 'text-rose-400 bg-rose-500/10 border-rose-500/20'
            }`}
          >
            24h: {goldChange >= 0 ? '+' : ''}
            {goldChange.toFixed(2)}%
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 font-mono">
          <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-4">
            <span className="text-xs text-slate-400 block mb-1">24K Gold (10 Grams)</span>
            <div
              className={`text-xl font-bold flex items-center gap-1.5 ${
                goldDir === 'up'
                  ? 'text-emerald-400'
                  : goldDir === 'down'
                  ? 'text-rose-400'
                  : 'text-amber-300'
              }`}
            >
              {goldDir === 'up' && <ArrowUp className="w-4 h-4" />}
              {goldDir === 'down' && <ArrowDown className="w-4 h-4" />}
              <span>{gold24k10g ? formatCurrency(gold24k10g, selectedCode) : 'Syncing...'}</span>
            </div>
          </div>

          <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-4">
            <span className="text-xs text-slate-400 block mb-1">22K Gold (10 Grams)</span>
            <div className="text-xl font-bold text-slate-100">
              {gold22k10g ? formatCurrency(gold22k10g, selectedCode) : 'Syncing...'}
            </div>
          </div>

          <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-4">
            <span className="text-xs text-slate-400 block mb-1">24K Gold (1 Gram)</span>
            <div className="text-xl font-bold text-slate-100">
              {gold24k1g ? formatCurrency(gold24k1g, selectedCode) : 'Syncing...'}
            </div>
          </div>
        </div>
      </div>

      {/* Silver, Diamond, Platinum, Palladium & Crude Oil */}
      <div className="bg-[#0d1323] border border-slate-800 rounded-2xl p-5 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-2">
              <Gem className="w-4 h-4" /> Silver, Diamonds &amp; Global Commodities ({selectedCode})
            </h2>
            <p className="text-xs text-slate-400">
              Precious metals, gemstone benchmarks &amp; energy rates in your selected currency
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 font-mono">
          <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-4">
            <span className="text-xs text-slate-400 block mb-1">999 Fine Silver (1 Kg)</span>
            <div className="text-lg font-bold text-slate-100">
              {silver1kg ? formatCurrency(silver1kg, selectedCode) : 'Syncing...'}
            </div>
            <span className="text-[11px] text-slate-500">
              10g: {silver10g ? formatCurrency(silver10g, selectedCode) : '--'}
            </span>
          </div>

          <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-4">
            <span className="text-xs text-sky-400 block mb-1">Natural Diamond (1 Carat)</span>
            <div className="text-lg font-bold text-white">
              {formatCurrency(naturalDiamond1ct, selectedCode)}
            </div>
            <span className="text-[11px] text-slate-500">
              Lab-Grown 1ct: {formatCurrency(labDiamond1ct, selectedCode)}
            </span>
          </div>

          <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-4">
            <span className="text-xs text-indigo-400 block mb-1">Platinum (10 Grams)</span>
            <div className="text-lg font-bold text-slate-100">
              {platinum10g ? formatCurrency(platinum10g, selectedCode) : 'Syncing...'}
            </div>
            <span className="text-[11px] text-slate-500">
              Palladium 10g: {palladium10g ? formatCurrency(palladium10g, selectedCode) : '--'}
            </span>
          </div>

          <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-4">
            <span className="text-xs text-orange-400 flex items-center gap-1 mb-1">
              <Flame className="w-3.5 h-3.5" /> Brent Crude Oil (Barrel)
            </span>
            <div className="text-lg font-bold text-slate-100">
              {formatCurrency(brentCrudeBarrel, selectedCode)}
            </div>
            <span className="text-[11px] text-slate-500">Global Energy Benchmark</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Live 1s Digital Asset Market Board (25 Assets) */}
        <div className="lg:col-span-2 bg-[#0d1323] border border-slate-800 rounded-2xl p-5 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-2">
              <TrendingUp className="w-4 h-4" /> Real-Time Market Ticks ({selectedCode}) — 25 Live Assets
            </h3>
            <span className="text-[11px] font-mono text-slate-400">
              {connected ? 'WebSocket Connected' : 'Connecting...'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 font-mono text-xs">
            {Object.entries(ASSET_LABELS).map(([symbol, label]) => {
              const tick = ticks[symbol];
              const dir = tick?.direction ?? 'neutral';
              const priceColor =
                dir === 'up'
                  ? 'text-emerald-400'
                  : dir === 'down'
                  ? 'text-rose-400'
                  : 'text-slate-100';

              return (
                <div
                  key={symbol}
                  className="flex items-center justify-between bg-slate-950 p-3 rounded-xl border border-slate-800/80"
                >
                  <div className="min-w-0 pr-2">
                    <span className="font-bold text-slate-200 block text-xs truncate">{label}</span>
                    {tick && (
                      <span
                        className={`text-[10px] ${
                          tick.change24h >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        24h: {tick.change24h >= 0 ? '+' : ''}
                        {tick.change24h.toFixed(2)}%
                      </span>
                    )}
                  </div>
                  <div className={`flex items-center gap-1 text-sm font-bold shrink-0 ${priceColor}`}>
                    {dir === 'up' && <ArrowUp className="w-3.5 h-3.5" />}
                    {dir === 'down' && <ArrowDown className="w-3.5 h-3.5" />}
                    <span>
                      {tick ? formatCurrency(tick.price * currentRate, selectedCode) : 'Loading...'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Instant Multi-Currency Forex Calculator */}
        <div className="bg-[#0d1323] border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4 h-fit">
          <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-2">
            <Calculator className="w-4 h-4" /> Instant Forex Converter
          </h3>

          <div>
            <label className="text-[11px] text-slate-400 block mb-1.5">Amount in USD ($)</label>
            <input
              type="number"
              min="0"
              value={usdInput}
              onChange={(e) => setUsdInput(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 focus:border-cyan-500 rounded-xl px-3.5 py-2.5 text-sm font-mono text-white focus:outline-none"
            />
          </div>

          <div className="space-y-2 font-mono text-xs pt-1">
            {quickForexList.map((code) => {
              const rate = rates[code];
              if (!rate) return null;
              return (
                <div
                  key={code}
                  className="flex items-center justify-between bg-slate-950/90 px-3 py-2 rounded-lg border border-slate-800/70"
                >
                  <span className="text-slate-400 font-semibold">{code}</span>
                  <span className="text-slate-100 font-bold">
                    {formatCurrency(parsedInput * rate, code)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </motion.div>
  );
}