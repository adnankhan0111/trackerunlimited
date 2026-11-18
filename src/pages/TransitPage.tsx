import React from 'react';
import useSWR from 'swr';
import axios from 'axios';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import type { LatLngExpression } from 'leaflet';
import { motion } from 'framer-motion';
import { Plane, Compass, RefreshCw } from 'lucide-react';
import { useTitanStore } from '../store/useTitanStore';
import { useSeoSchema } from '../hooks/useSeoSchema';

interface FlightItem {
  icao24: string;
  callsign: string;
  originCountry: string;
  lon: number;
  lat: number;
  altitudeMeters: number;
  velocityKmh: number;
  heading: number;
}

const fetcher = (url: string) => axios.get(url).then((r) => r.data);

export const TransitPage: React.FC = () => {
  const { coords } = useTitanStore();
  const { data, isLoading } = useSWR<{ flights: FlightItem[] }>(
    `/api/flights?lat=${coords.lat}&lon=${coords.lon}`,
    fetcher,
    { refreshInterval: 15000 }
  );

  useSeoSchema({
    title: `Live Flight Radar (${coords.label}) — Project Titan Aviation Telemetry`,
    description: `Real-time ADS-B aircraft positions, callsigns, altitudes, and speeds over ${coords.label}.`,
    schema: {
      '@context': 'https://schema.org',
      '@type': 'Dataset',
      name: 'Project Titan Live Airspace Radar',
      description: 'Live ADS-B flight coordinates and telemetry vectors.',
    },
  });

  const flights = data?.flights || [];
  const center: LatLngExpression = [coords.lat, coords.lon];

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-7xl mx-auto px-4 sm:px-8 py-6 space-y-6"
    >
      <div className="bg-[#0d1323] border border-slate-800 rounded-2xl p-5 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-sky-400 flex items-center gap-2">
              <Plane className="w-4 h-4" /> Live Airspace Radar — {coords.label}
            </h2>
            <p className="text-xs text-slate-400">
              Tracking {flights.length} active ADS-B transponders within ~400 km radius
            </p>
          </div>
          <span className="text-xs font-mono text-slate-400 flex items-center gap-1.5 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
            <RefreshCw className={`w-3.5 h-3.5 text-sky-400 ${isLoading ? 'animate-spin' : ''}`} />
            OpenSky ADS-B Live
          </span>
        </div>

        <div className="h-96 rounded-xl overflow-hidden border border-slate-800 z-0">
          <MapContainer center={center} zoom={7} style={{ height: '100%', width: '100%' }}>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {flights.map((f) => {
              if (!f.lat || !f.lon) return null;
              const pos: LatLngExpression = [f.lat, f.lon];
              return (
                <CircleMarker
                  key={f.icao24}
                  center={pos}
                  radius={7}
                  pathOptions={{ color: '#38bdf8', fillColor: '#0284c7', fillOpacity: 0.85 }}
                >
                  <Popup>
                    <div className="text-slate-900 text-xs font-sans space-y-0.5">
                      <strong>Flight: {f.callsign}</strong>
                      <div>Origin: {f.originCountry}</div>
                      <div>Altitude: {f.altitudeMeters.toLocaleString()} m</div>
                      <div>Speed: {f.velocityKmh} km/h</div>
                    </div>
                  </Popup>
                </CircleMarker>
              );
            })}
          </MapContainer>
        </div>
      </div>

      {/* Live Flight Telemetry Table */}
      <div className="bg-[#0d1323] border border-slate-800 rounded-2xl p-5 shadow-xl overflow-x-auto">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2 mb-3">
          <Compass className="w-4 h-4 text-sky-400" /> Active Transponder Stream
        </h3>
        <table className="w-full text-left border-collapse text-xs font-mono">
          <thead>
            <tr className="border-b border-slate-800 text-slate-400">
              <th className="py-2.5 px-3">Callsign</th>
              <th className="py-2.5 px-3">Origin Country</th>
              <th className="py-2.5 px-3">Altitude</th>
              <th className="py-2.5 px-3">Ground Speed</th>
              <th className="py-2.5 px-3">Heading</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {flights.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-6 text-center text-slate-500">
                  Scanning airspace transponders...
                </td>
              </tr>
            ) : (
              flights.map((f) => (
                <tr key={f.icao24} className="hover:bg-slate-900/60 transition">
                  <td className="py-2.5 px-3 font-bold text-sky-400">{f.callsign}</td>
                  <td className="py-2.5 px-3 text-slate-300">{f.originCountry}</td>
                  <td className="py-2.5 px-3 text-slate-200">{f.altitudeMeters.toLocaleString()} m</td>
                  <td className="py-2.5 px-3 text-emerald-400">{f.velocityKmh} km/h</td>
                  <td className="py-2.5 px-3 text-slate-400">{f.heading}°</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
};