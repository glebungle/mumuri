// app/(tabs)/index.tsx — GalleryTab (테스트용 couple_id=0, 로딩/새로고침/저장/삭제 포함)
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Image,
    Modal,
    Pressable,
    RefreshControl,
    StyleSheet,
    View,
} from 'react-native';
import AppText from '../../components/AppText';

// ===== 서버 베이스 URL =====
const BASE_URL = 'https://40b57014557d.ngrok-free.app';

// ===== 타입/노멀라이저 =====
type Photo = {
  id: string;
  url: string;
  thumbUrl?: string;
  createdAt?: string;
  mission?: string;
};

function normalizePhoto(raw: any): Photo | null {
  if (!raw) return null;
  const id = raw.id ?? raw.photo_id ?? raw.photoId ?? raw.uuid;
  const url = raw.url ?? raw.imageUrl ?? raw.photo_url ?? raw.path;
  const thumbUrl = raw.thumbUrl ?? raw.thumbnail ?? raw.thumb_url;
  if (!id || !url) return null;
  return {
    id: String(id),
    url: String(url),
    thumbUrl: thumbUrl ? String(thumbUrl) : undefined,
    createdAt: raw.createdAt ?? raw.created_at,
    mission: raw.mission,
  };
}

export default function GalleryTab() {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [preview, setPreview] = useState<Photo | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const tokenRef = useRef<string | null>(null);

  // 공통 fetch
  const authedFetch = useCallback(async (path: string, init?: RequestInit) => {
    if (!tokenRef.current) tokenRef.current = await AsyncStorage.getItem('token');

    const url = `${BASE_URL}${path}`;
    const headers: Record<string, string> = {
      Accept: 'application/json',
      ...(init?.headers as any),
      ...(tokenRef.current ? { Authorization: `Bearer ${tokenRef.current}` } : {}),
      'ngrok-skip-browser-warning': 'true',
    };

    const res = await fetch(url, { ...init, headers });
    const raw = await res.text();
    console.log('[GET]', url, 'status=', res.status, 'raw=', raw.slice(0, 300));

    if (res.status === 204 || raw.trim() === '') return null;

    let data: any;
    try {
      data = JSON.parse(raw);
    } catch {
      data = raw;
    }

    if (!res.ok) {
      const msg = (data && (data.message || data.error)) || `HTTP ${res.status}`;
      throw new Error(msg);
    }
    return data;
  }, []);

  // 전체 목록 로드: GET /photo/{couple_id}/all  — 테스트로 couple_id=0 고정
  const loadAll = useCallback(async () => {
    setInitialLoading(true);
    try {
      const data = (await authedFetch(`/photo/0/all`, { method: 'GET' })) ?? [];
      const arr =
        (Array.isArray(data) && data) ||
        data.items ||
        data.data ||
        data.content ||
        data.list ||
        data.records ||
        [];
      const normalized = (arr as any[]).map(normalizePhoto).filter(Boolean) as Photo[];
      setPhotos(normalized);
    } catch (e: any) {
      console.warn('loadAll error:', e?.message);
      Alert.alert('로드 실패', e?.message || '사진 목록을 불러오지 못했어요.');
      setPhotos([]);
    } finally {
      setInitialLoading(false);
    }
  }, [authedFetch]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // 당겨서 새로고침
  const onRefreshFn = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadAll();
    } finally {
      setRefreshing(false);
    }
  }, [loadAll]);

  // 저장(다운로드)
  const savePhoto = useCallback(async (p: Photo) => {
    if (!p?.url) return;
    try {
      setSaving(true);

      const baseDir = FileSystem.documentDirectory as string;
      const downloadDir = `${baseDir}downloads/`;
      try {
        await FileSystem.makeDirectoryAsync(downloadDir, { intermediates: true });
      } catch {}

      const filename = `photo_${p.id || Date.now()}.jpg`;
      const target = `${downloadDir}${filename}`;
      const { uri } = await FileSystem.downloadAsync(p.url, target);

      await MediaLibrary.requestPermissionsAsync();
      await MediaLibrary.saveToLibraryAsync(uri);
      Alert.alert('저장 완료', '사진이 앨범에 저장되었어요.');
    } catch (e: any) {
      Alert.alert('저장 실패', e?.message || '사진을 저장하지 못했어요.');
    } finally {
      setSaving(false);
    }
  }, []);

  // 삭제: DELETE /delete/{couple_id}/{photo_id}  — 테스트로 couple_id=0
  const deletePhoto = useCallback(
    async (p: Photo) => {
      if (!p?.id) return;
      Alert.alert('삭제', '정말 삭제할까요?', [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: async () => {
            try {
              setDeleting(true);
              await authedFetch(`/delete/0/${encodeURIComponent(p.id)}`, {
                method: 'DELETE',
              });
              setPhotos((prev) => prev.filter((x) => x.id !== p.id));
              setPreview(null);
            } catch (e: any) {
              Alert.alert('삭제 실패', e?.message || '사진을 삭제하지 못했어요.');
            } finally {
              setDeleting(false);
            }
          },
        },
      ]);
    },
    [authedFetch],
  );

  // 렌더러/키/푸터
  const numColumns = 3;
  const renderItem = useCallback(({ item }: { item: Photo }) => {
    const src = item.thumbUrl || item.url;
    return (
      <Pressable style={styles.cell} onPress={() => setPreview(item)}>
        <Image source={{ uri: src }} style={styles.thumb} />
      </Pressable>
    );
  }, []);
  const keyExtractor = useCallback((item: Photo) => item.id, []);
  const ListFooter = useMemo(() => null, []);

  // 최초 로딩
  if (initialLoading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator color="#6198FF" size="large" />
        <AppText style={styles.loadingText}>사진을 불러오는 중…</AppText>
      </View>
    );
  }

  // 본문
  return (
    <View style={styles.wrap}>
      <FlatList
        data={photos}
        keyExtractor={keyExtractor}
        numColumns={numColumns}
        renderItem={renderItem}
        contentContainerStyle={photos.length === 0 ? styles.emptyWrap : undefined}
        ListEmptyComponent={<AppText style={styles.emptyText}>아직 업로드된 사진이 없어요.</AppText>}
        ListFooterComponent={ListFooter}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefreshFn} tintColor="#6198FF" />}
      />

      {/* 미리보기 모달 */}
      <Modal visible={!!preview} transparent animationType="fade" onRequestClose={() => setPreview(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            {/* 상단 닫기 */}
            <View style={styles.modalTopBar}>
              <Pressable onPress={() => setPreview(null)} style={styles.iconBtn}>
                <Ionicons name="close" size={22} color="#333" />
              </Pressable>
            </View>

            {/* 이미지 */}
            {preview && <Image source={{ uri: preview.url }} style={styles.previewImage} resizeMode="contain" />}

            {/* 하단 액션 */}
            <View style={styles.actions}>
              <Pressable style={styles.actionBtn} onPress={() => preview && savePhoto(preview)} disabled={saving}>
                <Ionicons name="download-outline" size={22} color="#3279FF" />
                <AppText style={styles.actionText}>{saving ? '저장 중…' : '저장'}</AppText>
              </Pressable>

              <Pressable style={styles.actionBtn} onPress={() => preview && deletePhoto(preview)} disabled={deleting}>
                <Ionicons name="trash-outline" size={22} color="#FF4D4F" />
                <AppText style={[styles.actionText, { color: '#FF4D4F' }]}>{deleting ? '삭제 중…' : '삭제'}</AppText>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#FFF' },

  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF' },
  loadingText: { marginTop: 8, color: '#666' },

  emptyWrap: { flexGrow: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: '#777' },

  cell: { width: '33.333%', aspectRatio: 1, padding: 1.5 },
  thumb: { flex: 1, borderRadius: 6, backgroundColor: '#eee' },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  modalCard: { width: '90%', maxHeight: '85%', backgroundColor: '#FFF', borderRadius: 16, overflow: 'hidden' },
  modalTopBar: { padding: 8, alignItems: 'flex-end' },
  iconBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 18, backgroundColor: '#f2f2f2' },

  previewImage: { width: '100%', height: 300, backgroundColor: '#000' },

  actions: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#eee',
  },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 10 },
  actionText: { color: '#3279FF', fontWeight: '600' },
});
