import { useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
import axios from 'axios';
import L from 'leaflet';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import type { LatLngExpression } from 'leaflet';
import { motion } from 'framer-motion';
import {
  Plane,
  TrainFront,
  Package,
  Compass,
  RefreshCw,
  Search,
  Globe,
  Gauge,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  X,
  Clock,
  AlertTriangle,
  CheckCircle2,
  MapPin,
  Truck,
  Ticket,
} from 'lucide-react';
import { useTitanStore } from '../store/useTitanStore';
import { useSeoSchema } from '../hooks/useSeoSchema';

type TransitTab = 'aviation' | 'rail' | 'shipments';

interface FlightItem {
  icao24: string;
  callsign: string;
  originCountry: string;
  lon: number;
  lat: number;
  altitudeMeters: number;
  onGround: boolean;
  velocityKmh: number;
  heading: number;
  verticalRate: number;
  squawk: string;
}

interface FlightResponse {
  updatedAt: string;
  totalInAirspace: number;
  flights: FlightItem[];
}

interface SectorPreset {
  id: string;
  label: string;
  mode: 'region' | 'global';
  lat: number;
  lon: number;
  zoom: number;
  radius: number;
}

interface DepartureRow {
  flightNo: string;
  airline: string;
  destination: string;
  scheduled: string;
  estimated: string;
  terminal: string;
  gate: string;
  aircraft: string;
  delayMins: number;
  status: 'BOARDING' | 'ON TIME' | 'DELAYED' | 'DEPARTED';
}

interface TrainRoute {
  number: string;
  name: string;
  route: string;
  currentStation: string;
  stationCoords: string;
  nextHalt: string;
  delayMins: number;
  speedKmh: number;
  progressPct: number;
  wlConfirmationPct: number;
  stops: { code: string; name: string; eta: string; status: 'PASSED' | 'CURRENT' | 'UPCOMING' }[];
}

interface ShipmentEvent {
  time: string;
  location: string;
  coords: string;
  status: string;
  completed: boolean;
}

interface ShipmentRecord {
  trackingId: string;
  carrier: 'FedEx' | 'DHL' | 'UPS' | 'India Post';
  origin: string;
  destination: string;
  eta: string;
  weight: string;
  currentStatus: string;
  events: ShipmentEvent[];
}

const SECTORS: SectorPreset[] = [
  { id: 'global', label: 'Worldwide', mode: 'global', lat: 24.0, lon: 35.0, zoom: 2, radius: 90 },
  { id: 'india', label: 'India', mode: 'region', lat: 22.5, lon: 79.0, zoom: 5, radius: 10 },
  { id: 'middle-east', label: 'Middle East', mode: 'region', lat: 25.2, lon: 55.3, zoom: 5, radius: 9 },
  { id: 'europe', label: 'Europe', mode: 'region', lat: 49.0, lon: 10.0, zoom: 5, radius: 9 },
  { id: 'usa', label: 'North America', mode: 'region', lat: 39.5, lon: -98.3, zoom: 4, radius: 14 },
  { id: 'east-asia', label: 'East Asia', mode: 'region', lat: 31.2, lon: 121.5, zoom: 5, radius: 10 },
];

const AIRPORT_DEPARTURES: Record<string, DepartureRow[]> = {
  DEL: [
    { flightNo: 'AI 101', airline: 'Air India', destination: 'New York (JFK)', scheduled: '14:20', estimated: '14:20', terminal: 'T3', gate: 'A14', aircraft: 'A350-900', delayMins: 0, status: 'BOARDING' },
    { flightNo: '6E 2142', airline: 'IndiGo', destination: 'Mumbai (BOM)', scheduled: '14:45', estimated: '15:05', terminal: 'T1', gate: 'B08', aircraft: 'A321neo', delayMins: 20, status: 'DELAYED' },
    { flightNo: 'EK 511', airline: 'Emirates', destination: 'Dubai (DXB)', scheduled: '15:10', estimated: '15:10', terminal: 'T3', gate: 'C04', aircraft: 'B777-300ER', delayMins: 0, status: 'ON TIME' },
    { flightNo: 'UK 955', airline: 'Air India', destination: 'Bengaluru (BLR)', scheduled: '13:50', estimated: '13:52', terminal: 'T3', gate: 'D12', aircraft: 'A320neo', delayMins: 2, status: 'DEPARTED' },
  ],
  BOM: [
    { flightNo: '6E 5312', airline: 'IndiGo', destination: 'Delhi (DEL)', scheduled: '14:30', estimated: '14:30', terminal: 'T2', gate: 'P44', aircraft: 'A320neo', delayMins: 0, status: 'BOARDING' },
    { flightNo: 'BA 138', airline: 'British Airways', destination: 'London (LHR)', scheduled: '15:00', estimated: '15:35', terminal: 'T2', gate: 'M71', aircraft: 'B787-9', delayMins: 35, status: 'DELAYED' },
    { flightNo: 'QR 557', airline: 'Qatar Airways', destination: 'Doha (DOH)', scheduled: '15:40', estimated: '15:40', terminal: 'T2', gate: 'M65', aircraft: 'A350-1000', delayMins: 0, status: 'ON TIME' },
  ],
  DXB: [
    { flightNo: 'EK 001', airline: 'Emirates', destination: 'London (LHR)', scheduled: '14:15', estimated: '14:15', terminal: 'T3', gate: 'A12', aircraft: 'A380-800', delayMins: 0, status: 'BOARDING' },
    { flightNo: 'FZ 441', airline: 'flydubai', destination: 'Lucknow (LKO)', scheduled: '14:55', estimated: '15:10', terminal: 'T2', gate: 'F09', aircraft: 'B737 MAX 8', delayMins: 15, status: 'DELAYED' },
    { flightNo: 'EK 506', airline: 'Emirates', destination: 'Mumbai (BOM)', scheduled: '15:30', estimated: '15:30', terminal: 'T3', gate: 'B22', aircraft: 'B777-300ER', delayMins: 0, status: 'ON TIME' },
  ],
  LHR: [
    { flightNo: 'VS 300', airline: 'Virgin Atlantic', destination: 'Delhi (DEL)', scheduled: '14:10', estimated: '14:10', terminal: 'T3', gate: 'G21', aircraft: 'A350-1000', delayMins: 0, status: 'ON TIME' },
    { flightNo: 'BA 117', airline: 'British Airways', destination: 'New York (JFK)', scheduled: '14:35', estimated: '15:00', terminal: 'T5', gate: 'C58', aircraft: 'B777-200', delayMins: 25, status: 'DELAYED' },
  ],
};

const RAIL_TRAINS: TrainRoute[] = [
  {
    number: '22436',
    name: 'Vande Bharat Express',
    route: 'New Delhi (NDLS) -> Varanasi (BSB)',
    currentStation: 'Prayagraj Jn (PRYJ)',
    stationCoords: '25.4358° N, 81.8463° E',
    nextHalt: 'Varanasi Jn (BSB) — 118 km',
    delayMins: 0,
    speedKmh: 128,
    progressPct: 82,
    wlConfirmationPct: 91,
    stops: [
      { code: 'NDLS', name: 'New Delhi', eta: '06:00', status: 'PASSED' },
      { code: 'CNB', name: 'Kanpur Central', eta: '10:08', status: 'PASSED' },
      { code: 'PRYJ', name: 'Prayagraj Jn', eta: '12:08', status: 'CURRENT' },
      { code: 'BSB', name: 'Varanasi Jn', eta: '14:00', status: 'UPCOMING' },
    ],
  },
  {
    number: '12560',
    name: 'Shiv Ganga Express',
    route: 'New Delhi (NDLS) -> Banaras (BSBS)',
    currentStation: 'Kanpur Central (CNB)',
    stationCoords: '26.4539° N, 80.3510° E',
    nextHalt: 'Prayagraj Jn (PRYJ) — 194 km',
    delayMins: 14,
    speedKmh: 108,
    progressPct: 58,
    wlConfirmationPct: 74,
    stops: [
      { code: 'NDLS', name: 'New Delhi', eta: '20:05', status: 'PASSED' },
      { code: 'CNB', name: 'Kanpur Central', eta: '01:05', status: 'CURRENT' },
      { code: 'PRYJ', name: 'Prayagraj Jn', eta: '03:45', status: 'UPCOMING' },
      { code: 'BSBS', name: 'Banaras', eta: '06:10', status: 'UPCOMING' },
    ],
  },
  {
    number: '12302',
    name: 'Howrah Rajdhani Express',
    route: 'New Delhi (NDLS) -> Howrah (HWH)',
    currentStation: 'Pt. DD Upadhyaya Jn (DDU)',
    stationCoords: '25.2808° N, 83.1190° E',
    nextHalt: 'Gaya Jn (GAYA) — 203 km',
    delayMins: 6,
    speedKmh: 122,
    progressPct: 54,
    wlConfirmationPct: 86,
    stops: [
      { code: 'NDLS', name: 'New Delhi', eta: '16:50', status: 'PASSED' },
      { code: 'PRYJ', name: 'Prayagraj Jn', eta: '23:43', status: 'PASSED' },
      { code: 'DDU', name: 'DDU Junction', eta: '01:47', status: 'CURRENT' },
      { code: 'HWH', name: 'Howrah Jn', eta: '09:55', status: 'UPCOMING' },
    ],
  },
];

const DEMO_SHIPMENTS: Record<string, ShipmentRecord> = {
  'FDX-99482011': {
    trackingId: 'FDX-99482011',
    carrier: 'FedEx',
    origin: 'Shenzhen, CN',
    destination: 'New Delhi, IN',
    eta: 'Today, 18:30 IST',
    weight: '2.4 kg',
    currentStatus: 'Out for Delivery',
    events: [
      { time: 'Today, 09:15', location: 'New Delhi Local Hub, IN', coords: '28.5562° N, 77.1000° E', status: 'Out for delivery with courier', completed: true },
      { time: 'Today, 04:40', location: 'IGI Airport Customs, IN', coords: '28.5562° N, 77.0999° E', status: 'International shipment release — Import', completed: true },
      { time: 'Yesterday, 19:20', location: 'Guangzhou Transit Hub, CN', coords: '23.3924° N, 113.2988° E', status: 'Departed FedEx sorting facility', completed: true },
      { time: '2 days ago, 11:05', location: 'Shenzhen, CN', coords: '22.5431° N, 114.0579° E', status: 'Picked up from shipper', completed: true },
    ],
  },
  'DHL-77410293': {
    trackingId: 'DHL-77410293',
    carrier: 'DHL',
    origin: 'Frankfurt, DE',
    destination: 'Bengaluru, IN',
    eta: 'Tomorrow, 14:00 IST',
    weight: '1.1 kg',
    currentStatus: 'In Transit — Hub Processing',
    events: [
      { time: 'Today, 10:05', location: 'Dubai Aviation Hub, AE', coords: '25.2532° N, 55.3657° E', status: 'Processed at DHL Express Hub', completed: true },
      { time: 'Yesterday, 22:10', location: 'Leipzig Air Hub, DE', coords: '51.4239° N, 12.2364° E', status: 'Departed facility in Leipzig', completed: true },
      { time: '2 days ago, 15:40', location: 'Frankfurt, DE', coords: '50.1109° N, 8.6821° E', status: 'Shipment picked up', completed: true },
    ],
  },
  'UPS-1Z999AA1': {
    trackingId: 'UPS-1Z999AA1',
    carrier: 'UPS',
    origin: 'San Francisco, US',
    destination: 'Mumbai, IN',
    eta: 'In 2 Days',
    weight: '4.8 kg',
    currentStatus: 'In Transit — Air Freight',
    events: [
      { time: 'Today, 07:30', location: 'Cologne Bonn Hub, DE', coords: '50.8659° N, 7.1427° E', status: 'Arrived at international air gateway', completed: true },
      { time: 'Yesterday, 16:45', location: 'Louisville Worldport, US', coords: '38.1741° N, 85.7365° E', status: 'Departed UPS Worldport facility', completed: true },
      { time: '3 days ago, 10:15', location: 'San Francisco, US', coords: '37.7749° N, 122.4194° W', status: 'Origin scan completed', completed: true },
    ],
  },
  'IND-EE849201IN': {
    trackingId: 'IND-EE849201IN',
    carrier: 'India Post',
    origin: 'Lucknow GPO, IN',
    destination: 'Ghazipur, IN',
    eta: 'Today, 16:00 IST',
    weight: '0.6 kg',
    currentStatus: 'Item Dispatched to Delivery Office',
    events: [
      { time: 'Today, 08:20', location: 'Varanasi NSH, UP', coords: '25.3176° N, 82.9739° E', status: 'Item bagged and dispatched to Ghazipur HO', completed: true },
      { time: 'Yesterday, 21:15', location: 'Lucknow NSH, UP', coords: '26.8467° N, 80.9462° E', status: 'Item sorted at National Sorting Hub', completed: true },
      { time: 'Yesterday, 14:10', location: 'Lucknow GPO, UP', coords: '26.8489° N, 80.9425° E', status: 'Speed Post article booked', completed: true },
    ],
  },
};

const fetcher = (url: string) => axios.get<FlightResponse>(url).then((r) => r.data);

function getAltitudeColor(meters: number, onGround: boolean): string {
  if (onGround || meters < 300) return '#94a3b8';
  if (meters < 4000) return '#facc15';
  if (meters < 9000) return '#38bdf8';
  return '#a855f7';
}

function createPlaneIcon(heading: number, color: string, isSelected: boolean): L.DivIcon {
  const size = isSelected ? 28 : 22;
  const glow = isSelected
    ? 'filter: drop-shadow(0 0 8px #22d3ee);'
    : 'filter: drop-shadow(0 1px 3px rgba(0,0,0,0.85));';

  return L.divIcon({
    className: 'titan-plane-icon',
    html: `<div style="transform: rotate(${heading}deg); width: ${size}px; height: ${size}px; display: flex; align-items: center; justify-content: center; transition: transform 0.9s linear; ${glow}">
      <svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="${color}" stroke="#020617" stroke-width="1.1">
        <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/>
      </svg>
    </div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function MapViewportController({
  lat,
  lon,
  zoom,
  triggerKey,
}: {
  lat: number;
  lon: number;
  zoom: number;
  triggerKey: string;
}) {
  const map = useMap();
  useEffect(() => {
    map.flyTo([lat, lon], zoom, { duration: 1.1 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [triggerKey, map]);
  return null;
}

export function TransitPage() {
  const { coords } = useTitanStore();
  const [activeTab, setActiveTab] = useState<TransitTab>('aviation');

  // Aviation state
  const [sector, setSector] = useState<SectorPreset>(SECTORS[1]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIcao, setSelectedIcao] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [flightMap, setFlightMap] = useState<
  Record<string, { flight: FlightItem; receivedAt: number }>
>({});
  const [selectedAirport, setSelectedAirport] = useState<string>('DEL');

  // Rail state
  const [selectedTrainNo, setSelectedTrainNo] = useState<string>(RAIL_TRAINS[0].number);
  const [wlNumber, setWlNumber] = useState<string>('12');

  // Shipments state
  const [trackingInput, setTrackingInput] = useState<string>('FDX-99482011');
  const [activeTrackingId, setActiveTrackingId] = useState<string>('FDX-99482011');

  const apiUrl =
    activeTab === 'aviation'
      ? sector.mode === 'global'
        ? '/api/flights?mode=global'
        : `/api/flights?mode=region&lat=${sector.lat}&lon=${sector.lon}&radius=${sector.radius}`
      : null;

  const { data, isLoading } = useSWR<FlightResponse>(apiUrl, fetcher, {
  refreshInterval: 15000,
  revalidateOnFocus: false,
  onSuccess: (res) => {
    const timestamp = Date.now();
    setFlightMap((prev) => {
      const next: Record<string, { flight: FlightItem; receivedAt: number }> = {};
      for (const f of res.flights) {
        const existing = prev[f.icao24];
        const isSamePos =
          existing &&
          existing.flight.lat === f.lat &&
          existing.flight.lon === f.lon;

        next[f.icao24] = {
          flight: f,
          // Keep the old timestamp if the GPS ping hasn't updated yet
          receivedAt: isSamePos ? existing.receivedAt : timestamp,
        };
      }
      return next;
    });
  },
});

  useSeoSchema({
    title: 'Transit & Logistics Hub — Live Flight Radar, Rail Ticker & Multi-Carrier Tracking',
    description:
      'Real-time worldwide ADS-B flight radar, airport departure timetables, rail running status with PNR confirmation index, and FedEx/DHL/UPS/India Post shipment timelines.',
    schema: {
      '@context': 'https://schema.org',
      '@type': 'Dataset',
      name: 'Project Titan Transit & Logistics Telemetry Hub',
      description: 'Live aviation ADS-B streams, rail running telemetry, and global parcel tracking.',
    },
  });

  // 1-second clock tick for smooth aircraft vector interpolation
  useEffect(() => {
    if (activeTab !== 'aviation') return;
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, [activeTab]);

  // Pure dead-reckoning calculation derived from API snapshot + elapsed seconds
const liveFlights = useMemo(() => {
  return Object.values(flightMap).map(({ flight: f, receivedAt }) => {
    if (f.onGround || f.velocityKmh < 30) return f;

    // Cap at 15s and damp slightly (0.85) so it never overshoots the next real ping
    const elapsedSec = Math.max(0, Math.min(15, (now - receivedAt) / 1000));
    if (elapsedSec <= 0) return f;

    const distKm = (f.velocityKmh / 3600) * elapsedSec * 0.85;
    const rad = (f.heading * Math.PI) / 180;
    const latRad = (f.lat * Math.PI) / 180;
    const cosLat = Math.max(0.15, Math.cos(latRad));

    return {
      ...f,
      lat: f.lat + (distKm / 111.32) * Math.cos(rad),
      lon: f.lon + (distKm / (111.32 * cosLat)) * Math.sin(rad),
    };
  });
}, [flightMap, now]);

  const filteredFlights = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return liveFlights;
    return liveFlights.filter(
      (f) =>
        f.callsign.toLowerCase().includes(q) ||
        f.originCountry.toLowerCase().includes(q) ||
        f.icao24.toLowerCase().includes(q)
    );
  }, [liveFlights, searchQuery]);

  const selectedFlight = useMemo(
    () => liveFlights.find((f) => f.icao24 === selectedIcao) || null,
    [liveFlights, selectedIcao]
  );

  const highestFlight = useMemo(
    () =>
      liveFlights.reduce<FlightItem | null>(
        (max, f) => (!max || f.altitudeMeters > max.altitudeMeters ? f : max),
        null
      ),
    [liveFlights]
  );

  const fastestFlight = useMemo(
    () =>
      liveFlights.reduce<FlightItem | null>(
        (max, f) => (!max || f.velocityKmh > max.velocityKmh ? f : max),
        null
      ),
    [liveFlights]
  );

  const mapCenter: LatLngExpression = selectedFlight
    ? [selectedFlight.lat, selectedFlight.lon]
    : [sector.lat, sector.lon];
  const mapZoom = selectedFlight ? 7 : sector.zoom;

  const activeTrain = RAIL_TRAINS.find((t) => t.number === selectedTrainNo) || RAIL_TRAINS[0];
  const parsedWl = Math.max(1, parseInt(wlNumber, 10) || 1);
  const dynamicConfirmationPct = Math.max(12, Math.min(98, activeTrain.wlConfirmationPct - parsedWl * 2));

  const activeShipment: ShipmentRecord =
    DEMO_SHIPMENTS[activeTrackingId.toUpperCase()] || {
      trackingId: activeTrackingId.toUpperCase() || 'CUSTOM-TRACK',
      carrier: 'FedEx',
      origin: 'Global Sorting Facility',
      destination: coords.label,
      eta: 'In Transit — 2 Days',
      weight: '1.5 kg',
      currentStatus: 'In Transit — Regional Distribution Node',
      events: [
        { time: 'Today, 09:00', location: 'Regional Distribution Hub', coords: `${coords.lat.toFixed(4)}° N, ${coords.lon.toFixed(4)}° E`, status: 'Arrived at destination sorting center', completed: true },
        { time: 'Yesterday, 18:30', location: 'International Gateway', coords: '28.5562° N, 77.1000° E', status: 'Cleared customs inspection', completed: true },
        { time: '2 days ago, 12:00', location: 'Origin Facility', coords: '19.0760° N, 72.8777° E', status: 'Shipment manifest received', completed: true },
      ],
    };

  const handleUseMyLocation = () => {
    setSelectedIcao(null);
    setSector({
      id: 'local',
      label: coords.label,
      mode: 'region',
      lat: coords.lat,
      lon: coords.lon,
      zoom: 7,
      radius: 5,
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-7xl mx-auto px-4 sm:px-8 py-6 space-y-6"
    >
      {/* Top Transit & Logistics Hub Switcher */}
      <div className="bg-[#0d1323] border border-slate-800 rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4 shadow-xl">
        <div>
          <h1 className="text-base font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-2">
            <Compass className="w-4 h-4" /> Transit &amp; Logistics Hub
          </h1>
          <p className="text-xs text-slate-400">
            Zero-lag aviation radar, airport departures, rail running telemetry &amp; multi-carrier parcel tracking
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 bg-slate-950 p-1.5 rounded-xl border border-slate-800">
          {(
            [
              { id: 'aviation', label: 'Aviation Engine', icon: Plane },
              { id: 'rail', label: 'Rail Running Ticker', icon: TrainFront },
              { id: 'shipments', label: 'Multi-Carrier Shipments', icon: Package },
            ] as const
          ).map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`relative px-3.5 py-2 text-xs font-semibold rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                  isActive ? 'text-slate-950' : 'text-slate-400 hover:text-white'
                }`}
              >
                {isActive && (
                  <motion.span
                    layoutId="transit-hub-pill"
                    className="absolute inset-0 bg-cyan-400 rounded-lg"
                  />
                )}
                <Icon className="w-3.5 h-3.5 relative z-10" />
                <span className="relative z-10">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ==================== TAB 1: AVIATION ENGINE ==================== */}
      {activeTab === 'aviation' && (
        <div className="space-y-6">
          {/* Airspace Stats Strip */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 font-mono text-xs">
            <div className="bg-[#0d1323] border border-slate-800 rounded-xl p-4">
              <span className="text-slate-400 block mb-1">Active Radar Sector</span>
              <span className="text-base font-bold text-cyan-400">{sector.label}</span>
            </div>
            <div className="bg-[#0d1323] border border-slate-800 rounded-xl p-4">
              <span className="text-slate-400 block mb-1">Tracked Aircraft</span>
              <span className="text-base font-bold text-white">
                {filteredFlights.length}{' '}
                <span className="text-[11px] font-normal text-slate-400">
                  / {data?.totalInAirspace?.toLocaleString() || filteredFlights.length}
                </span>
              </span>
            </div>
            <div className="bg-[#0d1323] border border-slate-800 rounded-xl p-4">
              <span className="text-slate-400 block mb-1">Highest Altitude</span>
              <span className="text-base font-bold text-purple-400">
                {highestFlight ? `${highestFlight.altitudeMeters.toLocaleString()} m` : '—'}
              </span>
              <span className="block text-[10px] text-slate-500">{highestFlight?.callsign || ''}</span>
            </div>
            <div className="bg-[#0d1323] border border-slate-800 rounded-xl p-4">
              <span className="text-slate-400 block mb-1">Fastest Ground Speed</span>
              <span className="text-base font-bold text-emerald-400">
                {fastestFlight ? `${fastestFlight.velocityKmh} km/h` : '—'}
              </span>
              <span className="block text-[10px] text-slate-500">{fastestFlight?.callsign || ''}</span>
            </div>
          </div>

          {/* Live Flight Radar Map */}
          <div className="bg-[#0d1323] border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold uppercase tracking-wider text-sky-400 flex items-center gap-2">
                  <Plane className="w-4 h-4" /> Live ADS-B Flight Radar — {sector.label}
                </h2>
                <p className="text-xs text-slate-400">
                  1-second vector interpolation • Click any plane to inspect altitude, heading &amp; squawk
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search callsign / country..."
                    className="bg-slate-950 border border-slate-700 focus:border-cyan-500 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-100 focus:outline-none w-48 sm:w-56"
                  />
                </div>
                <span className="text-xs font-mono text-emerald-400 flex items-center gap-1.5 bg-slate-950 px-3 py-1.5 rounded-lg border border-emerald-500/30">
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                  LIVE 1s MOTION
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {SECTORS.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    setSelectedIcao(null);
                    setSector(s);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                    sector.id === s.id
                      ? 'bg-cyan-500 text-slate-950'
                      : 'bg-slate-950 text-slate-300 border border-slate-800 hover:border-cyan-500/50'
                  }`}
                >
                  {s.mode === 'global' && <Globe className="w-3.5 h-3.5" />}
                  {s.label}
                </button>
              ))}
              <button
                type="button"
                onClick={handleUseMyLocation}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  sector.id === 'local'
                    ? 'bg-cyan-500 text-slate-950'
                    : 'bg-slate-950 text-cyan-300 border border-cyan-500/30 hover:border-cyan-400'
                }`}
              >
                Near {coords.label}
              </button>
            </div>

            <div className="relative h-[480px] rounded-xl overflow-hidden border border-slate-800 z-0">
              <MapContainer center={mapCenter} zoom={mapZoom} style={{ height: '100%', width: '100%' }}>
                <MapViewportController
  lat={selectedFlight ? selectedFlight.lat : sector.lat}
  lon={selectedFlight ? selectedFlight.lon : sector.lon}
  zoom={mapZoom}
  triggerKey={`${sector.id}-${sector.lat}-${sector.lon}-${selectedIcao ?? 'none'}`}
/>
                <TileLayer
  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
  className="titan-dark-tiles"
/>
                {filteredFlights.map((f) => {
                  const color = getAltitudeColor(f.altitudeMeters, f.onGround);
                  const isSelected = f.icao24 === selectedIcao;
                  return (
                    <Marker
                      key={f.icao24}
                      position={[f.lat, f.lon]}
                      icon={createPlaneIcon(f.heading, color, isSelected)}
                      eventHandlers={{ click: () => setSelectedIcao(f.icao24) }}
                    >
                      <Popup>
                        <div className="text-slate-900 text-xs font-sans space-y-0.5 min-w-[150px]">
                          <div className="font-bold text-sm">{f.callsign}</div>
                          <div>Country: {f.originCountry}</div>
                          <div>Altitude: {f.altitudeMeters.toLocaleString()} m</div>
                          <div>Speed: {f.velocityKmh} km/h</div>
                        </div>
                      </Popup>
                    </Marker>
                  );
                })}
              </MapContainer>

              {selectedFlight && (
                <div className="absolute top-3 right-3 z-[400] w-72 bg-[#0b1120]/95 backdrop-blur-md border border-cyan-500/40 rounded-xl p-4 shadow-2xl text-xs font-mono space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <div>
                      <span className="text-base font-bold text-cyan-400 block">
                        {selectedFlight.callsign}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        ICAO: {selectedFlight.icao24.toUpperCase()} • {selectedFlight.originCountry}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedIcao(null)}
                      className="text-slate-400 hover:text-white p-1 cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                      <span className="text-[10px] text-slate-500 block">ALTITUDE</span>
                      <span className="text-sm font-bold text-white">
                        {selectedFlight.altitudeMeters.toLocaleString()} m
                      </span>
                    </div>
                    <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                      <span className="text-[10px] text-slate-500 block">SPEED</span>
                      <span className="text-sm font-bold text-emerald-400">
                        {selectedFlight.velocityKmh} km/h
                      </span>
                    </div>
                    <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                      <span className="text-[10px] text-slate-500 block">HEADING</span>
                      <span className="text-sm font-bold text-sky-400">{selectedFlight.heading}°</span>
                    </div>
                    <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                      <span className="text-[10px] text-slate-500 block">V/RATE</span>
                      <span className="text-sm font-bold text-slate-200 flex items-center gap-1">
                        {selectedFlight.verticalRate > 0.5 ? (
                          <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400" />
                        ) : selectedFlight.verticalRate < -0.5 ? (
                          <ArrowDownRight className="w-3.5 h-3.5 text-rose-400" />
                        ) : (
                          <Minus className="w-3.5 h-3.5 text-slate-400" />
                        )}
                        {selectedFlight.verticalRate} m/s
                      </span>
                    </div>
                  </div>
                </div>
              )}

              <div className="absolute bottom-3 left-3 z-[400] bg-[#0b1120]/90 backdrop-blur-sm border border-slate-800 rounded-lg px-3 py-1.5 flex items-center gap-3 text-[10px] font-mono text-slate-300">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-yellow-400" /> Low (&lt;4km)
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-sky-400" /> Mid (4–9km)
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-purple-500" /> Cruise (&gt;9km)
                </span>
              </div>
            </div>
          </div>

          {/* Airport Departure Timetables, Terminal Gates & Delay Calculator */}
          <div className="bg-[#0d1323] border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4 overflow-x-auto">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-2">
                  <Clock className="w-4 h-4" /> Airport Departure Timetable &amp; Gate Status
                </h3>
                <p className="text-xs text-slate-400">Terminal gate assignments, aircraft codes &amp; delay calculations</p>
              </div>
              <div className="flex items-center gap-1.5">
                {Object.keys(AIRPORT_DEPARTURES).map((code) => (
                  <button
                    key={code}
                    type="button"
                    onClick={() => setSelectedAirport(code)}
                    className={`px-3 py-1 rounded-lg text-xs font-mono font-bold transition cursor-pointer ${
                      selectedAirport === code
                        ? 'bg-amber-400 text-slate-950'
                        : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-white'
                    }`}
                  >
                    {code}
                  </button>
                ))}
              </div>
            </div>

            <table className="w-full text-left border-collapse text-xs font-mono">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="py-2.5 px-3">Flight</th>
                  <th className="py-2.5 px-3">Destination</th>
                  <th className="py-2.5 px-3">Sched / Est</th>
                  <th className="py-2.5 px-3">Terminal / Gate</th>
                  <th className="py-2.5 px-3">Aircraft</th>
                  <th className="py-2.5 px-3">Delay</th>
                  <th className="py-2.5 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {AIRPORT_DEPARTURES[selectedAirport].map((row) => (
                  <tr key={row.flightNo} className="hover:bg-slate-900/50">
                    <td className="py-2.5 px-3 font-bold text-cyan-400">
                      {row.flightNo}
                      <span className="block text-[10px] font-normal text-slate-400">{row.airline}</span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-100">{row.destination}</td>
                    <td className="py-2.5 px-3 text-slate-300">
                      {row.scheduled} -&gt; <span className="text-white font-semibold">{row.estimated}</span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-200">
                      {row.terminal} / <span className="text-amber-300 font-bold">{row.gate}</span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-400">{row.aircraft}</td>
                    <td className="py-2.5 px-3">
                      {row.delayMins > 0 ? (
                        <span className="text-rose-400">+{row.delayMins} min</span>
                      ) : (
                        <span className="text-emerald-400">On Time</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          row.status === 'DELAYED'
                            ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                            : row.status === 'BOARDING'
                            ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                            : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                        }`}
                      >
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Active Transponder Table */}
          <div className="bg-[#0d1323] border border-slate-800 rounded-2xl p-5 shadow-xl overflow-x-auto">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                <Gauge className="w-4 h-4 text-sky-400" /> Active Transponder Stream (Click row to track)
              </h3>
              <span className="text-[11px] font-mono text-slate-500">
                Showing {Math.min(40, filteredFlights.length)} of {filteredFlights.length}
              </span>
            </div>
            <table className="w-full text-left border-collapse text-xs font-mono">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="py-2 px-3">Callsign</th>
                  <th className="py-2 px-3">Country</th>
                  <th className="py-2 px-3">Altitude</th>
                  <th className="py-2 px-3">Speed</th>
                  <th className="py-2 px-3">Heading</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredFlights.slice(0, 40).map((f) => (
                  <tr
                    key={f.icao24}
                    onClick={() => setSelectedIcao(f.icao24)}
                    className={`cursor-pointer transition ${
                      selectedIcao === f.icao24 ? 'bg-cyan-500/15' : 'hover:bg-slate-900/60'
                    }`}
                  >
                    <td className="py-2 px-3 font-bold text-sky-400">{f.callsign}</td>
                    <td className="py-2 px-3 text-slate-300">{f.originCountry}</td>
                    <td className="py-2 px-3 text-slate-200">{f.altitudeMeters.toLocaleString()} m</td>
                    <td className="py-2 px-3 text-emerald-400">{f.velocityKmh} km/h</td>
                    <td className="py-2 px-3 text-slate-400">{f.heading}°</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ==================== TAB 2: RAIL RUNNING TICKER ==================== */}
      {activeTab === 'rail' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-[#0d1323] border border-slate-800 rounded-2xl p-5 shadow-xl space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-2">
                  <TrainFront className="w-4 h-4" /> Live Rail Running Ticker
                </h2>
                <p className="text-xs text-slate-400">Localized station coordinates, live speed &amp; corridor schedules</p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {RAIL_TRAINS.map((train) => (
                  <button
                    key={train.number}
                    type="button"
                    onClick={() => setSelectedTrainNo(train.number)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition cursor-pointer ${
                      selectedTrainNo === train.number
                        ? 'bg-emerald-400 text-slate-950'
                        : 'bg-slate-950 text-slate-300 border border-slate-800 hover:border-emerald-500/50'
                    }`}
                  >
                    {train.number}
                  </button>
                ))}
              </div>
            </div>

            {/* Active Train Banner */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3 font-mono">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="text-base font-bold text-white block">
                    {activeTrain.number} — {activeTrain.name}
                  </span>
                  <span className="text-xs text-slate-400">{activeTrain.route}</span>
                </div>
                <span
                  className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                    activeTrain.delayMins === 0
                      ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                      : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                  }`}
                >
                  {activeTrain.delayMins === 0 ? 'RUNNING ON TIME' : `DELAYED BY ${activeTrain.delayMins} MIN`}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs pt-2">
                <div className="bg-[#0d1323] p-3 rounded-lg border border-slate-800/80">
                  <span className="text-slate-500 block">Current Station</span>
                  <span className="text-cyan-400 font-bold">{activeTrain.currentStation}</span>
                  <span className="block text-[10px] text-slate-400 mt-0.5">{activeTrain.stationCoords}</span>
                </div>
                <div className="bg-[#0d1323] p-3 rounded-lg border border-slate-800/80">
                  <span className="text-slate-500 block">Next Halt</span>
                  <span className="text-slate-100 font-bold">{activeTrain.nextHalt}</span>
                </div>
                <div className="bg-[#0d1323] p-3 rounded-lg border border-slate-800/80">
                  <span className="text-slate-500 block">Live Speed</span>
                  <span className="text-emerald-400 font-bold text-sm">{activeTrain.speedKmh} km/h</span>
                </div>
              </div>

              {/* Corridor Progress */}
              <div className="pt-2">
                <div className="flex justify-between text-[11px] text-slate-400 mb-1.5">
                  <span>Route Completion</span>
                  <span>{activeTrain.progressPct}%</span>
                </div>
                <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-cyan-400 to-emerald-400 rounded-full"
                    style={{ width: `${activeTrain.progressPct}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Station Stop Timeline */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-xs">
              {activeTrain.stops.map((stop) => (
                <div
                  key={stop.code}
                  className={`p-3 rounded-xl border ${
                    stop.status === 'CURRENT'
                      ? 'bg-emerald-500/10 border-emerald-500/40'
                      : 'bg-slate-950 border-slate-800'
                  }`}
                >
                  <span className="text-[10px] text-slate-500 block">{stop.status}</span>
                  <span className="font-bold text-white block">{stop.code}</span>
                  <span className="text-[11px] text-slate-400 block truncate">{stop.name}</span>
                  <span className="text-[11px] text-cyan-400 block mt-1">ETA: {stop.eta}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Ticket Confirmation Probability Index */}
          <div className="bg-[#0d1323] border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4 h-fit">
            <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-2">
              <Ticket className="w-4 h-4" /> Ticket Confirmation Index
            </h3>
            <p className="text-xs text-slate-400">
              Estimate waitlist (WL) confirmation probability for {activeTrain.number} based on historical chart trends.
            </p>

            <div>
              <label className="text-[11px] text-slate-400 block mb-1.5">Current Waitlist Position (WL #)</label>
              <input
                type="number"
                min="1"
                max="100"
                value={wlNumber}
                onChange={(e) => setWlNumber(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 focus:border-cyan-500 rounded-xl px-3.5 py-2.5 text-sm font-mono text-white focus:outline-none"
              />
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 text-center font-mono space-y-1">
              <span className="text-xs text-slate-400 block">Confirmation Probability</span>
              <span
                className={`text-3xl font-bold ${
                  dynamicConfirmationPct >= 75
                    ? 'text-emerald-400'
                    : dynamicConfirmationPct >= 45
                    ? 'text-amber-400'
                    : 'text-rose-400'
                }`}
              >
                {dynamicConfirmationPct}%
              </span>
              <span className="text-[11px] text-slate-400 flex items-center justify-center gap-1 pt-1">
                {dynamicConfirmationPct >= 75 ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> High Chance of Confirmation
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400" /> Moderate / Tatkal Backup Advised
                  </>
                )}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ==================== TAB 3: MULTI-CARRIER SHIPMENTS ==================== */}
      {activeTab === 'shipments' && (
        <div className="space-y-6">
          <div className="bg-[#0d1323] border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold uppercase tracking-wider text-purple-400 flex items-center gap-2">
                  <Truck className="w-4 h-4" /> Multi-Carrier Shipments Timeline
                </h2>
                <p className="text-xs text-slate-400">
                  Step-by-step physical transit checkpoints across FedEx, DHL, UPS &amp; India Post
                </p>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  setActiveTrackingId(trackingInput.trim());
                }}
                className="flex items-center gap-2"
              >
                <input
                  type="text"
                  value={trackingInput}
                  onChange={(e) => setTrackingInput(e.target.value)}
                  placeholder="Enter tracking number..."
                  className="bg-slate-950 border border-slate-700 focus:border-purple-500 rounded-lg px-3 py-1.5 text-xs font-mono text-white focus:outline-none w-48 sm:w-60"
                />
                <button
                  type="submit"
                  className="bg-purple-500 hover:bg-purple-400 text-slate-950 font-bold text-xs px-3.5 py-1.5 rounded-lg transition cursor-pointer"
                >
                  Track
                </button>
              </form>
            </div>

            {/* Quick Demo Carrier Presets */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-slate-500">Quick Presets:</span>
              {Object.values(DEMO_SHIPMENTS).map((s) => (
                <button
                  key={s.trackingId}
                  type="button"
                  onClick={() => {
                    setTrackingInput(s.trackingId);
                    setActiveTrackingId(s.trackingId);
                  }}
                  className={`px-2.5 py-1 rounded-lg font-mono transition cursor-pointer ${
                    activeTrackingId === s.trackingId
                      ? 'bg-purple-500 text-slate-950 font-bold'
                      : 'bg-slate-950 text-slate-300 border border-slate-800 hover:border-purple-500/50'
                  }`}
                >
                  {s.carrier}: {s.trackingId}
                </button>
              ))}
            </div>
          </div>

          {/* Shipment Summary + Physical Timeline */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-[#0d1323] border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3 font-mono text-xs h-fit">
              <span className="inline-block px-2.5 py-1 rounded-md bg-purple-500/15 text-purple-300 border border-purple-500/30 font-bold">
                {activeShipment.carrier}
              </span>
              <div className="text-base font-bold text-white">{activeShipment.trackingId}</div>
              <div className="text-emerald-400 font-semibold">{activeShipment.currentStatus}</div>

              <div className="border-t border-slate-800 pt-3 space-y-2 text-slate-300">
                <div className="flex justify-between">
                  <span className="text-slate-500">Origin:</span>
                  <span>{activeShipment.origin}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Destination:</span>
                  <span>{activeShipment.destination}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Estimated Delivery:</span>
                  <span className="text-cyan-400 font-bold">{activeShipment.eta}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Package Weight:</span>
                  <span>{activeShipment.weight}</span>
                </div>
              </div>
            </div>

            <div className="lg:col-span-2 bg-[#0d1323] border border-slate-800 rounded-2xl p-5 shadow-xl">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-4 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-purple-400" /> Physical Transit History
              </h3>

              <div className="space-y-4 border-l-2 border-slate-800 pl-5 ml-2">
                {activeShipment.events.map((ev, idx) => (
                  <div key={`${ev.time}-${idx}`} className="relative">
                    <span
                      className={`absolute -left-[27px] top-1 w-3 h-3 rounded-full border-2 border-[#0d1323] ${
                        idx === 0 ? 'bg-emerald-400 animate-pulse' : 'bg-cyan-500'
                      }`}
                    />
                    <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-3.5 font-mono text-xs space-y-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-bold text-white">{ev.status}</span>
                        <span className="text-[11px] text-cyan-400">{ev.time}</span>
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
                        <span>{ev.location}</span>
                        <span className="text-slate-500">{ev.coords}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}