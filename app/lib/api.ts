// app/lib/api.ts
import AsyncStorage from '@react-native-async-storage/async-storage';

export const API_BASE = 'https://5fbe91913f6e.ngrok-free.app';

export async function authedFetch(path: string, init: RequestInit = {}) {
  const token = await AsyncStorage.getItem('token');
  const headers = {
    Accept: 'application/json',
    'ngrok-skip-browser-warning': 'true',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(init.body ? { 'Content-Type': 'application/json' } : {}),
    ...(init.headers || {}),
  };
  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });
  const text = await res.text();
  if (!res.ok) throw new Error(`${path} ${res.status}: ${text.slice(0,160)}`);
  try { return JSON.parse(text); } catch { return text; }
}

export type MeShape = {
  userId?: number; id?: number; memberId?: number;
  coupleId?: number; couple_id?: number;
  coupleCode?: string; couple_code?: string;
  nickname?: string; name?: string;
  status?: string;
};

export function normalizeMe(raw: any) {
  const me = raw as MeShape;
  return {
    userId: me.userId ?? me.id ?? me.memberId ?? null,
    coupleId: me.coupleId ?? me.couple_id ?? null,
    coupleCode: me.coupleCode ?? me.couple_code ?? null,
    name: me.nickname ?? me.name ?? null,
    status: me.status ?? null,
  };
}
