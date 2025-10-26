// lib/photoApi.ts
import * as ImageManipulator from 'expo-image-manipulator';

const API_BASE = 'https://5fbe91913f6e.ngrok-free.app'; //수정

export type Photo = {
  id: string;
  url: string;
  width: number;
  height: number;
  createdAt: string;
};

// 파일 업로드
export async function uploadPhoto(localUri: string, token: string): Promise<Photo> {
  // 1) 리사이즈 + 압축
  const resized = await ImageManipulator.manipulateAsync(
    localUri,
    [{ resize: { width: 1440 } }],
    { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
  );

  // 2) FormData 구성
  const form = new FormData();
  form.append('file', {
    uri: resized.uri,
    name: 'photo.jpg',
    type: 'image/jpeg',
  } as any);

  // 3) 업로드
  const res = await fetch(`${API_BASE}/api/photos`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`, 
    },
    body: form,
  });

  const text = await res.text();
  let data: any = {};
  try { data = JSON.parse(text); } catch { data = { message: text }; }

  if (!res.ok) throw new Error(`HTTP ${res.status}: ${data.message || 'upload failed'}`);
  return data as Photo;
}

export async function getPhoto(id: string, token: string): Promise<Photo> {
  const res = await fetch(`${API_BASE}/api/photos/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function listPhotos(params: { cursor?: string; limit?: number }, token: string)
: Promise<{ items: Photo[]; nextCursor?: string }> {
  const q = new URLSearchParams();
  if (params.cursor) q.set('cursor', params.cursor);
  if (params.limit) q.set('limit', String(params.limit));
  const res = await fetch(`${API_BASE}/api/photos?${q.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function deletePhoto(id: string, token: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/photos/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}
