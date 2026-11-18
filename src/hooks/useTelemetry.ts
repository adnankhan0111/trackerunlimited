import useSWR from 'swr';
import axios from 'axios';
import { useTitanStore } from '../store/useTitanStore';

const fetcher = (url: string) => axios.get(url).then((res) => res.data);

export function useTelemetry() {
  const { coords } = useTitanStore();
  const { data, error, isLoading } = useSWR(
    `/api/summary?lat=${coords.lat}&lon=${coords.lon}`,
    fetcher,
    {
      refreshInterval: 15000,
      dedupingInterval: 10000,
      revalidateOnFocus: false,
    }
  );

  return { data, error, isLoading };
}