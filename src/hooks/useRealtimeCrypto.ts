import { useEffect, useState } from 'react';

export interface LiveAssetTick {
  price: number;
  prevPrice: number;
  direction: 'up' | 'down' | 'neutral';
  change24h: number;
}

export interface RealtimeCryptoState {
  bitcoin?: LiveAssetTick;
  ethereum?: LiveAssetTick;
  solana?: LiveAssetTick;
  connected: boolean;
  lastTick: string;
}

const SYMBOL_MAP: Record<string, 'bitcoin' | 'ethereum' | 'solana'> = {
  BTCUSDT: 'bitcoin',
  ETHUSDT: 'ethereum',
  SOLUSDT: 'solana',
};

export function useRealtimeCrypto(): RealtimeCryptoState {
  const [state, setState] = useState<RealtimeCryptoState>({
    connected: false,
    lastTick: '--:--:--',
  });

  useEffect(() => {
    const ws = new WebSocket(
      'wss://stream.binance.com:9443/stream?streams=btcusdt@miniTicker/ethusdt@miniTicker/solusdt@miniTicker'
    );

    ws.onopen = () => {
      setState((prev) => ({ ...prev, connected: true }));
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as {
          data?: { s: string; c: string; o: string };
        };
        if (!msg.data) return;

        const key = SYMBOL_MAP[msg.data.s];
        if (!key) return;

        const newPrice = parseFloat(msg.data.c);
        const openPrice = parseFloat(msg.data.o);
        const change24h = openPrice > 0 ? ((newPrice - openPrice) / openPrice) * 100 : 0;

        setState((prev) => {
          const oldPrice = prev[key]?.price ?? newPrice;
          const direction: 'up' | 'down' | 'neutral' =
            newPrice > oldPrice ? 'up' : newPrice < oldPrice ? 'down' : prev[key]?.direction ?? 'neutral';

          return {
            ...prev,
            connected: true,
            lastTick: new Date().toLocaleTimeString(),
            [key]: {
              price: newPrice,
              prevPrice: oldPrice,
              direction,
              change24h,
            },
          };
        });
      } catch {
        // Ignore malformed frames
      }
    };

    ws.onclose = () => {
      setState((prev) => ({ ...prev, connected: false }));
    };

    return () => {
      ws.close();
    };
  }, []);

  return state;
}