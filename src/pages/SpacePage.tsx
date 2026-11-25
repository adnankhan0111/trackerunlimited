import { useMemo, useState } from 'react';
import useSWR from 'swr';
import axios from 'axios';
import L from 'leaflet';
import { MapContainer, TileLayer, Marker, Popup, CircleMarker, Circle } from 'react-leaflet';
import { motion } from 'framer-motion';
import {
  Satellite,
  Flame,
  Sun,
  Users,
  Layers,
  AlertTriangle,
  Sparkles,
  Orbit,
  Mountain,
  CloudLightning,
} from 'lucide-react';
import { useSeoSchema } from '../hooks/useSeoSchema';

interface HazardItem {
  id: string;
  title: string;
  category: string;
  categoryId: string;
  lon: number;
  lat: number;
  date: string;
}

interface SpaceApiResponse {
  updatedAt: string;
  hazards: HazardItem[];
  cosmicWeather: {
    kpIndex: number;
    kpTime: string;
    auroraLevel: string;
    solarFlare: {
      classType: string;
      peakTime: string;
    };
    scales: {
      radioBlackout: string;
      solarRadiation: string;
      geomagnetic: string;
    };
  };
  peopleInSpace: {
    count: number;
    crew: Array<{ name: string; craft: string }>;
  };
}

interface LiveIssData {
  latitude: number;
  longitude: number;
  velocity: number;
  altitude: number;
  visibility: string;
  footprint: number;
}

const fetcher = (url: string) =>
  axios.get(url).then((r) => {
    if (typeof r.data === 'string') {
      throw new Error('Expected JSON, received HTML');
    }
    return r.data;
  });

// Use yesterday's UTC date for NASA GIBS so full global satellite swaths are available
function getGibsDate(): string {
  const d = new Date(Date.now() - 24 * 60 * 60 * 1000);
  return d.toISOString().split('T')[0];
}

function getHazardColor(categoryId: string): string {
  if (categoryId === 'wildfires') return '#f97316';
  if (categoryId === 'volcanoes') return '#ef4444';
  if (categoryId === 'severeStorms') return '#38bdf8';
  return '#a855f7';
}

const issIcon = L.divIcon({
  className: 'titan-iss-icon',
  html: `<div style="width:28px;height:28px;display:flex;align-items:center;justify-content:center;filter:drop-shadow(0 0 8px #22d3ee);">
    <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="#22d3ee" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M13 7 9 3 5 7l4 4"/>
      <path d="m17 11 4 4-4 4-4-4"/>
      <path d="m8 12 4 4 6-6-4-4Z"/>
      <path d="m16 8 3-3"/>
      <path d="M9 21a6 6 0 0 0-6-6"/>
    </svg>
  </div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

export function SpacePage() {
  const [showSatellite, setShowSatellite] = useState(true);
  const [showPrecipClouds, setShowPrecipClouds] = useState(false);
  const [showFirmsThermal, setShowFirmsThermal] = useState(true);
  const [hazardFilter, setHazardFilter] = useState<'all' | 'wildfires' | 'volcanoes' | 'severeStorms'>('all');

  const gibsDate = useMemo(() => getGibsDate(), []);

  // NASA EONET + NOAA SWPC + People in Space (refreshed every 15 mins)
  const { data: spaceData, isLoading } = useSWR<SpaceApiResponse>('/api/space', fetcher, {
    refreshInterval: 15 * 60 * 1000,
    revalidateOnFocus: false,
  });

  // Live 2-second ISS Orbital Telemetry
  const { data: iss } = useSWR<LiveIssData>(
    'https://api.wheretheiss.at/v1/satellites/25544',
    fetcher,
    { refreshInterval: 2000 }
  );

  useSeoSchema({
    title: 'Space Data Cockpit — NASA GIBS Imagery, Wildfires, ISS & Solar Weather',
    description:
      'Live NASA GIBS satellite cloud canvas, FIRMS thermal wildfire and volcanic plume overlay, 2-second ISS orbital tracker, off-earth crew count, and NOAA solar flare alerts.',
    schema: {
      '@context': 'https://schema.org',
      '@type': 'Dataset',
      name: 'Project Titan Space & Earth Observation Cockpit',
      description: 'Real-time NASA GIBS satellite telemetry, active global hazards, ISS tracking, and NOAA space weather.',
    },
  });

  const filteredHazards = useMemo(() => {
    const list = spaceData?.hazards || [];
    if (hazardFilter === 'all') return list;
    return list.filter((h) => h.categoryId === hazardFilter);
  }, [spaceData, hazardFilter]);

  const wildfireCount = useMemo(
    () => (spaceData?.hazards || []).filter((h) => h.categoryId === 'wildfires').length,
    [spaceData]
  );
  const volcanoCount = useMemo(
    () => (spaceData?.hazards || []).filter((h) => h.categoryId === 'volcanoes').length,
    [spaceData]
  );

  const kp = spaceData?.cosmicWeather.kpIndex ?? 2.0;
  const kpColor =
    kp >= 5 ? 'text-rose-400' : kp >= 4 ? 'text-amber-400' : 'text-emerald-400';

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-7xl mx-auto px-4 sm:px-8 py-6 space-y-6"
    >
      {/* Top Cosmic Weather & Orbital Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 font-mono text-xs">
        <div className="bg-[#0d1323] border border-slate-800 rounded-xl p-4">
          <span className="text-slate-400 flex items-center gap-1.5 mb-1">
            <Users className="w-3.5 h-3.5 text-cyan-400" /> Personnel Off-Earth
          </span>
          <span className="text-xl font-bold text-white">
            {spaceData?.peopleInSpace.count ?? '—'}{' '}
            <span className="text-[11px] font-normal text-emerald-400">In Orbit</span>
          </span>
        </div>

        <div className="bg-[#0d1323] border border-slate-800 rounded-xl p-4">
          <span className="text-slate-400 flex items-center gap-1.5 mb-1">
            <Sun className="w-3.5 h-3.5 text-amber-400" /> Latest Solar Flare
          </span>
          <span className="text-xl font-bold text-amber-300">
            {spaceData?.cosmicWeather.solarFlare.classType ?? 'Syncing...'}
          </span>
        </div>

        <div className="bg-[#0d1323] border border-slate-800 rounded-xl p-4">
          <span className="text-slate-400 flex items-center gap-1.5 mb-1">
            <Sparkles className="w-3.5 h-3.5 text-purple-400" /> Magnetosphere (Kp)
          </span>
          <span className={`text-xl font-bold ${kpColor}`}>Kp {kp.toFixed(1)}</span>
          <span className="block text-[10px] text-slate-400 truncate">
            {spaceData?.cosmicWeather.auroraLevel ?? 'Monitoring...'}
          </span>
        </div>

        <div className="bg-[#0d1323] border border-slate-800 rounded-xl p-4">
          <span className="text-slate-400 flex items-center gap-1.5 mb-1">
            <Flame className="w-3.5 h-3.5 text-orange-400" /> Active Earth Hazards
          </span>
          <span className="text-xl font-bold text-orange-400">
            {spaceData?.hazards.length ?? 0}
          </span>
          <span className="block text-[10px] text-slate-400">
            {wildfireCount} Fires • {volcanoCount} Volcanoes
          </span>
        </div>
      </div>

      {/* Main NASA GIBS Satellite Canvas + Active Hazards Overlay */}
      <div className="bg-[#0d1323] border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-sm font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-2">
              <Satellite className="w-4 h-4" /> NASA GIBS Imagery &amp; Active Hazards Canvas
            </h1>
            <p className="text-xs text-slate-400">
              Non-video global Earth observation • VIIRS satellite mosaic ({gibsDate}), FIRMS thermal anomalies &amp; live ISS footprint
            </p>
          </div>

          {/* Layer Toggles */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-slate-500 flex items-center gap-1">
              <Layers className="w-3.5 h-3.5" /> Layers:
            </span>
            <button
              type="button"
              onClick={() => setShowSatellite((v) => !v)}
              className={`px-2.5 py-1 rounded-lg font-semibold transition cursor-pointer ${
                showSatellite
                  ? 'bg-cyan-500 text-slate-950'
                  : 'bg-slate-950 text-slate-400 border border-slate-800'
              }`}
            >
              GIBS True Color
            </button>
            <button
              type="button"
              onClick={() => setShowPrecipClouds((v) => !v)}
              className={`px-2.5 py-1 rounded-lg font-semibold transition cursor-pointer ${
                showPrecipClouds
                  ? 'bg-sky-400 text-slate-950'
                  : 'bg-slate-950 text-slate-400 border border-slate-800'
              }`}
            >
              Global Clouds/Rain
            </button>
            <button
              type="button"
              onClick={() => setShowFirmsThermal((v) => !v)}
              className={`px-2.5 py-1 rounded-lg font-semibold transition cursor-pointer ${
                showFirmsThermal
                  ? 'bg-orange-500 text-slate-950'
                  : 'bg-slate-950 text-slate-400 border border-slate-800'
              }`}
            >
              FIRMS Thermal
            </button>
          </div>
        </div>

        {/* Hazard Category Filter */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {(
            [
              { id: 'all', label: 'All Hazards' },
              { id: 'wildfires', label: 'Wildfires' },
              { id: 'volcanoes', label: 'Volcanic Plumes' },
              { id: 'severeStorms', label: 'Severe Storms' },
            ] as const
          ).map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setHazardFilter(f.id)}
              className={`px-3 py-1 rounded-lg font-mono transition cursor-pointer ${
                hazardFilter === f.id
                  ? 'bg-slate-100 text-slate-950 font-bold'
                  : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-white'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Leaflet Map Canvas */}
        <div className="relative h-[480px] rounded-xl overflow-hidden border border-slate-800 z-0">
          <MapContainer center={[20, 45]} zoom={2} minZoom={2} maxZoom={9} style={{ height: '100%', width: '100%' }}>
            {/* Dark OSM Base Map */}
            <TileLayer
              attribution='&copy; OpenStreetMap'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              className="titan-dark-tiles"
            />

            {/* NASA GIBS VIIRS True Color Satellite Mosaic */}
            {showSatellite && (
              <TileLayer
                attribution="NASA GIBS VIIRS"
                url={`https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_SNPP_CorrectedReflectance_TrueColor/default/${gibsDate}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg`}
                maxNativeZoom={9}
                opacity={0.78}
              />
            )}

            {/* NASA GIBS Global Precipitation & Cloud Structure Overlay */}
            {showPrecipClouds && (
              <TileLayer
                attribution="NASA IMERG"
                url={`https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/IMERG_Precipitation_Rate/default/${gibsDate}/GoogleMapsCompatible_Level6/{z}/{y}/{x}.png`}
                maxNativeZoom={6}
                opacity={0.65}
              />
            )}

            {/* NASA FIRMS 375m Thermal Anomalies Tile Layer */}
            {showFirmsThermal && (
              <TileLayer
                attribution="NASA FIRMS"
                url={`https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_SNPP_Thermal_Anomalies_375m_All/default/${gibsDate}/GoogleMapsCompatible_Level8/{z}/{y}/{x}.png`}
                maxNativeZoom={8}
                opacity={0.9}
              />
            )}

            {/* NASA EONET Active Hazard Markers */}
            {filteredHazards.map((h) => {
              const color = getHazardColor(h.categoryId);
              return (
                <CircleMarker
                  key={h.id}
                  center={[h.lat, h.lon]}
                  radius={6}
                  pathOptions={{
                    color,
                    fillColor: color,
                    fillOpacity: 0.75,
                    weight: 1.5,
                  }}
                >
                  <Popup>
                    <div className="text-slate-900 text-xs font-sans space-y-1 min-w-[160px]">
                      <div className="font-bold text-sm">{h.title}</div>
                      <div className="font-semibold text-orange-600">{h.category}</div>
                      <div>
                        Coords: {h.lat.toFixed(3)}°, {h.lon.toFixed(3)}°
                      </div>
                      <div className="text-slate-500">
                        {new Date(h.date).toLocaleDateString()}
                      </div>
                    </div>
                  </Popup>
                </CircleMarker>
              );
            })}

            {/* Live ISS Position & Orbital Horizon Footprint */}
            {iss && (
              <>
                <Circle
                  center={[iss.latitude, iss.longitude]}
                  radius={(iss.footprint / 2) * 1000}
                  pathOptions={{
                    color: '#22d3ee',
                    weight: 1,
                    dashArray: '4 4',
                    fillColor: '#22d3ee',
                    fillOpacity: 0.08,
                  }}
                />
                <Marker position={[iss.latitude, iss.longitude]} icon={issIcon}>
                  <Popup>
                    <div className="text-slate-900 text-xs font-sans space-y-0.5">
                      <div className="font-bold text-sm">International Space Station</div>
                      <div>Altitude: {iss.altitude.toFixed(1)} km</div>
                      <div>Velocity: {Math.round(iss.velocity).toLocaleString()} km/h</div>
                      <div>Visibility: {iss.visibility}</div>
                    </div>
                  </Popup>
                </Marker>
              </>
            )}
          </MapContainer>

          {/* Canvas Legend */}
          <div className="absolute bottom-3 left-3 z-[400] bg-[#0b1120]/90 backdrop-blur-sm border border-slate-800 rounded-lg px-3 py-1.5 flex flex-wrap items-center gap-3 text-[10px] font-mono text-slate-300">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-orange-500" /> Wildfire / Thermal
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-red-500" /> Volcanic Plume
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-sky-400" /> Severe Storm
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-cyan-400" /> Live ISS
            </span>
          </div>
        </div>
      </div>

      {/* Bottom 3-Column Cockpit Modules */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 1. Orbit Telemetry & Off-Earth Personnel Panel */}
        <div className="bg-[#0d1323] border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-2">
              <Orbit className="w-4 h-4" /> ISS Orbit Telemetry
            </h2>
            <span className="text-[10px] font-mono text-cyan-300 bg-cyan-500/10 border border-cyan-500/20 px-2 py-0.5 rounded-full">
              2s LIVE
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 font-mono text-xs">
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/80">
              <span className="text-slate-500 block">Latitude</span>
              <span className="text-base font-bold text-white">
                {iss ? `${iss.latitude.toFixed(4)}°` : '—'}
              </span>
            </div>
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/80">
              <span className="text-slate-500 block">Longitude</span>
              <span className="text-base font-bold text-white">
                {iss ? `${iss.longitude.toFixed(4)}°` : '—'}
              </span>
            </div>
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/80">
              <span className="text-slate-500 block">Altitude</span>
              <span className="text-sm font-bold text-cyan-300">
                {iss ? `${iss.altitude.toFixed(1)} km` : '—'}
              </span>
            </div>
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/80">
              <span className="text-slate-500 block">Orbital Velocity</span>
              <span className="text-sm font-bold text-emerald-400">
                {iss ? `${Math.round(iss.velocity).toLocaleString()} km/h` : '—'}
              </span>
            </div>
          </div>

          {/* Off-Earth Personnel Roster */}
          <div className="border-t border-slate-800 pt-3 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-300">Active Off-Earth Roster</span>
              <span className="font-mono text-cyan-400">
                {spaceData?.peopleInSpace.count ?? 0} Humans
              </span>
            </div>
            <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1 font-mono text-[11px]">
              {(spaceData?.peopleInSpace.crew || []).map((person) => (
                <div
                  key={`${person.craft}-${person.name}`}
                  className="flex items-center justify-between bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800/70"
                >
                  <span className="text-slate-200 truncate">{person.name}</span>
                  <span className="text-purple-400 shrink-0 ml-2">{person.craft}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 2. Cosmic Weather Alert Module */}
        <div className="bg-[#0d1323] border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
          <h2 className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-2">
            <Sun className="w-4 h-4" /> Cosmic Weather Alert Module
          </h2>

          <div className="space-y-3 font-mono text-xs">
            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800/80">
              <div className="flex items-center justify-between mb-1">
                <span className="text-slate-400">Planetary K-Index</span>
                <span className={`font-bold text-base ${kpColor}`}>Kp {kp.toFixed(1)} / 9</span>
              </div>
              <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${
                    kp >= 5 ? 'bg-rose-500' : kp >= 4 ? 'bg-amber-400' : 'bg-emerald-400'
                  }`}
                  style={{ width: `${Math.min(100, (kp / 9) * 100)}%` }}
                />
              </div>
              <span className="block text-[10px] text-slate-400 mt-1.5">
                Northern Aurora Index: <strong className="text-slate-200">{spaceData?.cosmicWeather.auroraLevel}</strong>
              </span>
            </div>

            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800/80 space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-400">Radio Blackout (R):</span>
                <span className="text-slate-100 font-semibold">
                  {spaceData?.cosmicWeather.scales.radioBlackout ?? 'R0 (none)'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Solar Radiation (S):</span>
                <span className="text-slate-100 font-semibold">
                  {spaceData?.cosmicWeather.scales.solarRadiation ?? 'S0 (none)'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Geomagnetic Storm (G):</span>
                <span className="text-slate-100 font-semibold">
                  {spaceData?.cosmicWeather.scales.geomagnetic ?? 'G0 (none)'}
                </span>
              </div>
            </div>

            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/80 flex items-center justify-between">
              <span className="text-slate-400">Latest GOES X-Ray Flare</span>
              <span className="text-amber-300 font-bold text-sm">
                {spaceData?.cosmicWeather.solarFlare.classType ?? 'Nominal'}
              </span>
            </div>
          </div>
        </div>

        {/* 3. Live Earth Hazards Feed (EONET) */}
        <div className="bg-[#0d1323] border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-orange-400 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" /> Active Global Hazards
            </h2>
            <span className="text-[11px] font-mono text-slate-500">
              {isLoading ? 'Syncing...' : `${filteredHazards.length} events`}
            </span>
          </div>

          <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1 font-mono text-xs">
            {filteredHazards.length === 0 ? (
              <div className="text-slate-500 text-center py-8">
                {isLoading ? 'Loading NASA EONET hazard feed...' : 'No active hazards in this category.'}
              </div>
            ) : (
              filteredHazards.slice(0, 25).map((h) => (
                <div
                  key={h.id}
                  className="bg-slate-950 border border-slate-800/80 rounded-xl p-3 space-y-1"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-bold text-slate-100 leading-snug">{h.title}</span>
                    {h.categoryId === 'wildfires' ? (
                      <Flame className="w-3.5 h-3.5 text-orange-400 shrink-0 mt-0.5" />
                    ) : h.categoryId === 'volcanoes' ? (
                      <Mountain className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
                    ) : (
                      <CloudLightning className="w-3.5 h-3.5 text-sky-400 shrink-0 mt-0.5" />
                    )}
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-slate-400">
                    <span>{h.category}</span>
                    <span>
                      {h.lat.toFixed(2)}°, {h.lon.toFixed(2)}°
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}