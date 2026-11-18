import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface LocalIncident {
  id: string;
  type: 'Traffic' | 'Event' | 'Hazard' | 'Utility';
  title: string;
  lat: number;
  lon: number;
  upvotes: number;
  timestamp: string;
}

interface TitanState {
  coords: { lat: number; lon: number; label: string };
  currency: string;
  incidents: LocalIncident[];
  setCoords: (lat: number, lon: number, label: string) => void;
  setCurrency: (currency: string) => void;
  addIncident: (incident: Omit<LocalIncident, 'id' | 'upvotes' | 'timestamp'>) => void;
  upvoteIncident: (id: string) => void;
}

export const useTitanStore = create<TitanState>()(
  persist(
    (set) => ({
      coords: { lat: 25.3176, lon: 82.9739, label: 'Varanasi / Ghazipur Sector' },
      currency: 'INR',
      incidents: [
        {
          id: 'inc-101',
          type: 'Event',
          title: 'Evening Tech & Maker Meetup — Live Crowd Check',
          lat: 25.321,
          lon: 82.981,
          upvotes: 14,
          timestamp: '8 mins ago',
        },
        {
          id: 'inc-102',
          type: 'Traffic',
          title: 'Highway Junction Diversion — 10 min slow-down',
          lat: 25.312,
          lon: 82.965,
          upvotes: 9,
          timestamp: '21 mins ago',
        },
      ],
      setCoords: (lat, lon, label) => set({ coords: { lat, lon, label } }),
      setCurrency: (currency) => set({ currency: currency.toUpperCase() }),
      addIncident: (inc) =>
        set((state) => ({
          incidents: [
            {
              ...inc,
              id: `inc-${Date.now()}`,
              upvotes: 1,
              timestamp: 'Just now',
            },
            ...state.incidents,
          ],
        })),
      upvoteIncident: (id) =>
        set((state) => ({
          incidents: state.incidents.map((item) =>
            item.id === id ? { ...item, upvotes: item.upvotes + 1 } : item
          ),
        })),
    }),
    { name: 'project-titan-storage' }
  )
);