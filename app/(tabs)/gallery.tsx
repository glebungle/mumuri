// app/(tabs)/gallery.tsx
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Directory, File, Paths } from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal, Platform, Pressable,
  RefreshControl,
  StyleSheet,
  View
} from 'react-native';
import AppText from '../../components/AppText';

const BASE_URL = 'https://mumuri.shop';

type Photo = { id: string; url: string; uploadedBy?: string };

function normalizePhoto(raw: any): Photo | null {
  if (!raw || typeof raw !== 'object') return null;
  const id = raw.id ?? raw.photo_id ?? raw.photoId ?? raw.uuid;
  const url = raw.presignedUrl ?? raw.url;
  if (id == null || !url) return null;
  return { id: String(id), url: String(url), uploadedBy: raw.uploadedBy != null ? String(raw.uploadedBy) : undefined };
}

export default function GalleryTab() {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [preview, setPreview] = useState<Photo | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const tokenRef = useRef<string | null>(null);
  const coupleIdRef = useRef<number | null>(null);

  /** 토큰/커플ID 확보  */
  const ensureAuthBasics = useCallback(async () => {
    if (!tokenRef.current) tokenRef.current = await AsyncStorage.getItem('token');

    if (!coupleIdRef.current) {
      const cidStr = await AsyncStorage.getItem('coupleId');
      const cidNum = cidStr != null ? Number(cidStr) : null;
      if (cidNum != null && Number.isFinite(cidNum)) {
        coupleIdRef.current = cidNum;
      }
    }

    if (tokenRef.current && !coupleIdRef.current) {
      try {
        const res = await fetch(`${BASE_URL}/user/getuser`, {
          method: 'GET',
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${tokenRef.current}`,
            'ngrok-skip-browser-warning': 'true',
          },
        });
        const raw = await res.text();
        if (!res.ok) throw new Error(raw);

        let data: any; try { data = JSON.parse(raw); } catch { data = {}; }
        const found = data?.coupleId ?? data?.couple_id ?? null;
        if (found != null && Number.isFinite(Number(found))) {
          coupleIdRef.current = Number(found);
          await AsyncStorage.setItem('coupleId', String(coupleIdRef.current));
          console.log('[gallery] getuser → coupleId', coupleIdRef.current);
        }
      } catch (e) {
        console.warn('[gallery] getuser 실패:', (e as Error)?.message);
      }
    }
  }, []);

  /** 공통 fetch (토큰 자동 헤더) */
  const authedFetch = useCallback(async (path: string, init?: RequestInit) => {
    await ensureAuthBasics();

    const url = `${BASE_URL}${path}`;
    const headers: Record<string, string> = {
      Accept: 'application/json',
      ...(init?.headers as any),
      ...(tokenRef.current ? { Authorization: `Bearer ${tokenRef.current}` } : {}),
      'ngrok-skip-browser-warning': 'true',
    };

    const res = await fetch(url, { ...init, headers });
    const raw = await res.text();
    console.log('[REQ]', init?.method || 'GET', url, 'status=', res.status, 'raw=', raw.slice(0, 200));

    if (res.status === 204 || raw.trim() === '') return null;

    let data: any;
    try { data = JSON.parse(raw); } catch { data = raw; }

    if (!res.ok) {
      const msg = (data && (data.message || data.error)) || `HTTP ${res.status}`;
      throw new Error(msg);
    }
    return data;
  }, [ensureAuthBasics]);

  /** 목록 로드: GET /photo/{coupleId}/all */
  const loadAll = useCallback(async () => {
    setInitialLoading(true);
    try {
      await ensureAuthBasics();
      const cid = coupleIdRef.current;

      if (!cid || !Number.isFinite(cid)) {
        throw new Error('커플 ID를 찾을 수 없어요. 회원가입/연결을 먼저 완료해 주세요.');
      }

      const path = `/photo/${encodeURIComponent(String(cid))}/all`;
      const data = await authedFetch(path, { method: 'GET' });

      const arr: any[] = Array.isArray(data)
        ? data
        : (data?.items || data?.data || data?.content || data?.list || data?.records || []);
      const normalized = arr.map(normalizePhoto).filter(Boolean) as Photo[];
      setPhotos(normalized);
      console.log('[Gallery] normalized length=', normalized.length);
    } catch (e: any) {
      console.warn('[gallery] loadAll error:', e?.message);
      Alert.alert('로드 실패', e?.message || '사진 목록을 불러오지 못했어요.');
      setPhotos([]);
    } finally {
      setInitialLoading(false);
    }
  }, [authedFetch, ensureAuthBasics]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  /** 당겨서 새로고침 */
  const onRefreshFn = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadAll();
    } finally {
      setRefreshing(false);
    }
  }, [loadAll]);

  /** 저장(다운로드) */
  const savePhoto = useCallback(async (p: Photo) => {
    if (!p?.url) return;

    try {
      if (Platform.OS === 'web') {
        Alert.alert('안내', '웹 환경에서는 앨범 저장이 지원되지 않아요. iOS/Android에서 시도해 주세요.');
        return;
      }

      setSaving(true);

      const perm = await MediaLibrary.requestPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('권한 필요', '사진을 앨범에 저장하려면 권한이 필요합니다.');
        return;
      }

      const downloadsDir = new Directory(Paths.cache, 'downloads');
      await downloadsDir.create();

      const result = await File.downloadFileAsync(p.url, downloadsDir);
      await MediaLibrary.saveToLibraryAsync(result.uri);

      Alert.alert('저장 완료', '사진이 앨범에 저장되었어요.');
    } catch (e: any) {
      console.error(e);
      Alert.alert('저장 실패', e?.message || '사진을 저장하지 못했어요.');
    } finally {
      setSaving(false);
    }
  }, []);

  /** 삭제: DELETE /delete/{coupleId}/{photoId} */
  const deletePhoto = useCallback(
    (p: Photo) => {
      if (!p?.id) return;
      Alert.alert('삭제', '정말 삭제할까요?', [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: async () => {
            try {
              setDeleting(true);
              await ensureAuthBasics();

              const cid = coupleIdRef.current;
              if (!cid || !Number.isFinite(cid)) {
                throw new Error('커플 ID가 없습니다.');
              }

              await authedFetch(`/delete/${encodeURIComponent(String(cid))}/${encodeURIComponent(p.id)}`, {
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
    [authedFetch, ensureAuthBasics]
  );

  const numColumns = 3;
  const renderItem = useCallback(
    ({ item }: { item: Photo }) => (
      <Pressable style={styles.cell} onPress={() => setPreview(item)}>
        <Image source={{ uri: item.url }} style={styles.thumb} />
      </Pressable>
    ),
    []
  );
  const keyExtractor = useCallback((item: Photo) => item.id, []);
  const ListFooter = useMemo(() => null, []);

  if (initialLoading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator color="#6198FF" size="large" />
        <AppText style={styles.loadingText}>사진을 불러오는 중…</AppText>
      </View>
    );
  }

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
            <View style={styles.modalTopBar}>
              <Pressable onPress={() => setPreview(null)} style={styles.iconBtn}>
                <Ionicons name="close" size={22} color="#333" />
              </Pressable>
            </View>

            {preview && <Image source={{ uri: preview.url }} style={styles.previewImage} resizeMode="contain" />}

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
