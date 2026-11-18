import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import type { LatLngExpression } from 'leaflet';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Plus, ThumbsUp, Navigation } from 'lucide-react';
import { useTitanStore, type LocalIncident } from '../store/useTitanStore';

function RecenterMap({ center }: { center: LatLngExpression }) {
  const map = useMap();

  useEffect(() => {
    map.setView(center, 13);
  }, [center, map]);

  return null;
}

export const LocalMapCard: React.FC = () => {
  const { coords, setCoords, incidents, addIncident, upvoteIncident } = useTitanStore();
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [type, setType] = useState<LocalIncident['type']>('Event');

  const mapCenter: LatLngExpression = [coords.lat, coords.lon];

  const handleLocateMe = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((pos) => {
      setCoords(pos.coords.latitude, pos.coords.longitude, 'My Live GPS Sector');
    });
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!title.trim()) return;
    addIncident({
      type,
      title,
      lat: coords.lat + (Math.random() - 0.5) * 0.015,
      lon: coords.lon + (Math.random() - 0.5) * 0.015,
    });
    setTitle('');
    setShowForm(false);
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="col-span-1 lg:col-span-2 bg-[#0d1323]/90 backdrop-blur-md border border-slate-800 rounded-2xl p-5 shadow-2xl"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-2">
            <MapPin className="w-4 h-4" /> Hyper-Local Event & Incident Radar
          </h2>
          <p className="text-xs text-slate-400">{coords.label}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleLocateMe}
            className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition cursor-pointer"
          >
            <Navigation className="w-3.5 h-3.5 text-cyan-400" /> Near Me
          </button>
          <button
            type="button"
            onClick={() => setShowForm(!showForm)}
            className="text-xs bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1 transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" /> Report Pin
          </button>
        </div>
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.form
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            onSubmit={handleSubmit}
            className="overflow-hidden mb-4 bg-slate-950 border border-slate-800 rounded-xl p-3 flex flex-col sm:flex-row gap-2"
          >
            <select
              value={type}
              onChange={(e) => setType(e.target.value as LocalIncident['type'])}
              className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200"
            >
              <option value="Event">Local Event</option>
              <option value="Traffic">Traffic Alert</option>
              <option value="Hazard">Weather Hazard</option>
              <option value="Utility">Power / Utility</option>
            </select>
            <input
              type="text"
              placeholder="Describe what's happening right now..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500"
            />
            <button
              type="submit"
              className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-xs px-4 py-1.5 rounded-lg cursor-pointer"
            >
              Publish Live
            </button>
          </motion.form>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="md:col-span-3 h-64 rounded-xl overflow-hidden border border-slate-800 z-0">
          <MapContainer
            center={mapCenter}
            zoom={13}
            style={{ height: '100%', width: '100%' }}
            zoomControl={false}
          >
            <TileLayer
  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
/>
            <RecenterMap center={mapCenter} />
            {incidents.map((inc) => {
              const pinPosition: LatLngExpression = [inc.lat, inc.lon];
              return (
                <CircleMarker
                  key={inc.id}
                  center={pinPosition}
                  radius={9}
                  pathOptions={{
                    color: inc.type === 'Event' ? '#06b6d4' : '#f59e0b',
                    fillOpacity: 0.7,
                  }}
                >
                  <Popup>
                    <div className="text-slate-900 text-xs font-sans">
                      <strong>[{inc.type}]</strong> {inc.title}
                    </div>
                  </Popup>
                </CircleMarker>
              );
            })}
          </MapContainer>
        </div>

        <div className="md:col-span-2 space-y-2.5 max-h-64 overflow-y-auto pr-1">
          {incidents.map((inc) => (
            <motion.div
              layout
              key={inc.id}
              className="bg-slate-950/90 border border-slate-800/90 rounded-xl p-3 flex flex-col justify-between gap-2"
            >
              <div className="flex items-center justify-between text-[11px]">
                <span className="px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 font-medium">
                  {inc.type}
                </span>
                <span className="text-slate-500">{inc.timestamp}</span>
              </div>
              <p className="text-xs text-slate-200 leading-relaxed">{inc.title}</p>
              <button
                type="button"
                onClick={() => upvoteIncident(inc.id)}
                className="self-start text-[11px] text-slate-400 hover:text-emerald-400 flex items-center gap-1 transition cursor-pointer"
              >
                <ThumbsUp className="w-3 h-3" /> Verify ({inc.upvotes})
              </button>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.section>
  );
};