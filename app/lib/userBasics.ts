// app/lib/userBasics.ts
import AsyncStorage from '@react-native-async-storage/async-storage';

const BASE = 'https://mumuri.shop';

export async function hydrateUserBasicsFromGetuser() {
  const token = await AsyncStorage.getItem('token');
  if (!token) return;

  const res = await fetch(`${BASE}/user/getuser`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      'ngrok-skip-browser-warning': 'true',
    },
  });
  const text = await res.text();
  let data: any;
  try { data = JSON.parse(text); } catch { data = text; }

  if (typeof data === 'number' || /^[0-9]+$/.test(String(data))) {
    const uid = Number(data);
    if (!Number.isNaN(uid)) await AsyncStorage.setItem('userId', String(uid));
    return;
  }

}
