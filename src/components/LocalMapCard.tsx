import { useEffect, useState } from 'react';
import useSWR from 'swr';
import axios from 'axios';
import L from 'leaflet';
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  CircleMarker,
  useMap,
  useMapEvents,
} from 'react-leaflet';
import { motion } from 'framer-motion';
import {
  MapPin,
  Plus,
  Crosshair,
  AlertTriangle,
  RefreshCw,
  Send,
  X,
} from 'lucide-react';
import { useTitanStore } from '../store/useTitanStore';

type IncidentCategory = 'traffic' | 'weather' | 'outage' | 'emergency' | 'community';

interface IncidentPin {
  id: string;
  title: string;
  category: IncidentCategory;
  lat: number;
  lon: number;
  createdAt: string;
}

interface IncidentsResponse {
  incidents?: IncidentPin[];
}

const CATEGORY_META: Record<IncidentCategory, { label: string; color: string }> = {
  traffic: { label: 'Traffic / Road', color: '#f59e0b' },
  weather: { label: 'Weather Alert', color: '#38bdf8' },
  outage: { label: 'Power / Net Outage', color: '#a855f7' },
  emergency: { label: 'Emergency', color: '#ef4444' },
  community: { label: 'Community Event', color: '#10b981' },
};

const fetcher = (url: string) =>
  axios.get<IncidentsResponse>(url).then((r) => {
    if (typeof r.data === 'string') {
      throw new Error('Expected JSON, received HTML');
    }
    return r.data;
  });

const draftPinIcon = L.divIcon({
  className: 'titan-draft-pin',
  html: `<div style="width:18px;height:18px;border-radius:9999px;background:#22d3ee;border:3px solid #020617;box-shadow:0 0 12px #22d3ee;"></div>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

function MapCenterSync({
  lat,
  lon,
  triggerKey,
}: {
  lat: number;
  lon: number;
  triggerKey: string;
}) {
  const map = useMap();
  useEffect(() => {
    map.flyTo([lat, lon], 11, { duration: 1.0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [triggerKey, map]);
  return null;
}

function MapClickHandler({
  enabled,
  onPick,
}: {
  enabled: boolean;
  onPick: (lat: number, lon: number) => void;
}) {
  useMapEvents({
    click(e) {
      if (enabled) {
        onPick(e.latlng.lat, e.latlng.lng);
      }
    },
  });
  return null;
}

export function LocalMapCard() {
  const { coords, setCoords } = useTitanStore();
  const [isPinMode, setIsPinMode] = useState(false);
  const [draftPos, setDraftPos] = useState<{ lat: number; lon: number } | null>(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<IncidentCategory>('traffic');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const { data, isLoading, mutate } = useSWR<IncidentsResponse>('/api/incidents', fetcher, {
    refreshInterval: 15000,
    revalidateOnFocus: true,
  });

  const incidents = data?.incidents ?? [];

  const handleLocateMe = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords(pos.coords.latitude, pos.coords.longitude, 'My GPS Location');
      },
      () => {
        // Ignore denied geolocation gracefully
      }
    );
  };

  const handleCreatePin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draftPos || !title.trim()) return;

    setSubmitting(true);
    setSubmitError(null);

    const newPin: IncidentPin = {
      id: `pin-${Date.now()}`,
      title: title.trim(),
      category,
      lat: draftPos.lat,
      lon: draftPos.lon,
      createdAt: new Date().toISOString(),
    };

    try {
      // Optimistically show the pin immediately, then persist to Cloudflare KV
      await mutate(
        async (current) => {
          const res = await axios.post<{ incident?: IncidentPin }>('/api/incidents', newPin);
          const saved = res.data?.incident ?? newPin;
          return { incidents: [saved, ...(current?.incidents ?? [])] };
        },
        {
          optimisticData: { incidents: [newPin, ...incidents] },
          rollbackOnError: true,
          revalidate: true,
        }
      );

      setTitle('');
      setDraftPos(null);
      setIsPinMode(false);
    } catch {
      setSubmitError('Could not save pin. Ensure /api/incidents KV is deployed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="lg:col-span-2 bg-[#0d1323] border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col gap-4"
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-2">
            <MapPin className="w-4 h-4" /> Hyper-Local Incident Radar — {coords.label}
          </h2>
          <p className="text-xs text-slate-400">
            Live Cloudflare KV community pins • Syncs every 15s across all visitors
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleLocateMe}
            className="px-2.5 py-1.5 rounded-lg text-xs font-mono bg-slate-950 text-slate-300 border border-slate-800 hover:border-cyan-500/50 transition cursor-pointer flex items-center gap-1.5"
          >
            <Crosshair className="w-3.5 h-3.5 text-cyan-400" /> GPS
          </button>

          <button
            type="button"
            onClick={() => {
              setIsPinMode((v) => !v);
              setDraftPos(null);
              setSubmitError(null);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
              isPinMode
                ? 'bg-rose-500 text-slate-950'
                : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950'
            }`}
          >
            {isPinMode ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
            {isPinMode ? 'Cancel Pin' : 'Report Incident'}
          </button>

          <span className="text-[11px] font-mono text-emerald-400 bg-slate-950 border border-emerald-500/30 px-2.5 py-1.5 rounded-lg flex items-center gap-1.5">
            <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
            {incidents.length} LIVE
          </span>
        </div>
      </div>

      {/* Pin-Drop Instruction / Form */}
      {isPinMode && (
        <form
          onSubmit={handleCreatePin}
          className="bg-slate-950 border border-cyan-500/40 rounded-xl p-3.5 space-y-3 text-xs"
        >
          <div className="flex items-center justify-between text-cyan-300 font-mono">
            <span>
              {draftPos
                ? `Selected: ${draftPos.lat.toFixed(4)}°, ${draftPos.lon.toFixed(4)}°`
                : 'Step 1: Click anywhere on the map below to place your pin'}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Incident Category"
              value={category}
              onChange={(e) => setCategory(e.target.value as IncidentCategory)}
              className="bg-[#0d1323] border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
            >
              {Object.entries(CATEGORY_META).map(([key, meta]) => (
                <option key={key} value={key}>
                  {meta.label}
                </option>
              ))}
            </select>

            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Short description (e.g. Heavy traffic jam on NH-19)..."
              maxLength={80}
              className="flex-1 min-w-[180px] bg-[#0d1323] border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
            />

            <button
              type="submit"
              disabled={!draftPos || !title.trim() || submitting}
              className="px-3.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-slate-950 font-bold transition cursor-pointer flex items-center gap-1.5"
            >
              <Send className="w-3.5 h-3.5" />
              {submitting ? 'Saving...' : 'Publish'}
            </button>
          </div>

          {submitError && (
            <p className="text-rose-400 font-mono text-[11px] flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" /> {submitError}
            </p>
          )}
        </form>
      )}

      {/* Map Canvas */}
      <div className="relative h-[420px] rounded-xl overflow-hidden border border-slate-800 z-0">
        <MapContainer
          center={[coords.lat, coords.lon]}
          zoom={11}
          style={{ height: '100%', width: '100%' }}
        >
          <MapCenterSync
            lat={coords.lat}
            lon={coords.lon}
            triggerKey={`${coords.lat}-${coords.lon}`}
          />
          <MapClickHandler
            enabled={isPinMode}
            onPick={(lat, lon) => setDraftPos({ lat, lon })}
          />

          <TileLayer
            attribution="&copy; OpenStreetMap"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            className="titan-dark-tiles"
          />

          {/* Draft Pin Preview */}
          {draftPos && <Marker position={[draftPos.lat, draftPos.lon]} icon={draftPinIcon} />}

          {/* Live KV Community Incident Pins */}
          {incidents.map((pin) => {
            const meta = CATEGORY_META[pin.category] ?? CATEGORY_META.community;
            return (
              <CircleMarker
                key={pin.id}
                center={[pin.lat, pin.lon]}
                radius={8}
                pathOptions={{
                  color: meta.color,
                  fillColor: meta.color,
                  fillOpacity: 0.75,
                  weight: 2,
                }}
              >
                <Popup>
                  <div className="text-slate-900 text-xs font-sans space-y-1 min-w-[160px]">
                    <div className="font-bold text-sm">{pin.title}</div>
                    <div className="font-semibold" style={{ color: meta.color }}>
                      {meta.label}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {new Date(pin.createdAt).toLocaleString()}
                    </div>
                  </div>
                </Popup>
              </CircleMarker>
            );
          })}
        </MapContainer>

        {/* Legend */}
        <div className="absolute bottom-3 left-3 z-[400] bg-[#0b1120]/90 backdrop-blur-sm border border-slate-800 rounded-lg px-3 py-1.5 flex flex-wrap items-center gap-3 text-[10px] font-mono text-slate-300">
          {Object.entries(CATEGORY_META).map(([key, meta]) => (
            <span key={key} className="flex items-center gap-1">
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: meta.color }}
              />
              {meta.label.split(' ')[0]}
            </span>
          ))}
        </div>
      </div>
    </motion.div>
  );
}