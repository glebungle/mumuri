// app/(tabs)/index.tsx — GalleryTab (로그인 시 저장된 coupleId 사용)
/* eslint-disable react-hooks/exhaustive-deps */
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
const BASE_URL = 'https://870dce98a8c7.ngrok-free.app';

type Photo = { id: string; url: string; uploadedBy?: string };

function normalizePhoto(raw: any): Photo | null {
  if (!raw || typeof raw !== 'object') return null;
  const id = raw.id ?? raw.photo_id ?? raw.photoId ?? raw.uuid;
  const url = raw.presignedUrl ?? raw.url; // presignedUrl 우선
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
  const coupleIdRef = useRef<string | null>(null);

  // 공통 fetch
  const authedFetch = useCallback(async (path: string, init?: RequestInit) => {
    if (!tokenRef.current) tokenRef.current = await AsyncStorage.getItem('token');
    if (!coupleIdRef.current) coupleIdRef.current = await AsyncStorage.getItem('coupleId');

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
  }, []);

  // 전체 목록 로드: GET /photo/{couple_id}/all
  // ===== loadAll 수정 =====
    const loadAll = useCallback(async () => {
    setInitialLoading(true);
    try {
        // 1) coupleId 확보 (없으면 임시 1로)
        let coupleId = (await AsyncStorage.getItem('coupleId')) ?? '';
        if (!coupleId || coupleId === 'null' || coupleId === 'undefined') {
        console.warn('[Gallery] coupleId not set; using fallback 1 for test');
        coupleId = '1';
        }

        // 2) GET /photo/{couple_id}/all
        const path = `/photo/${encodeURIComponent(coupleId)}/all`;
        const data = await authedFetch(path, { method: 'GET' });

        // 3) 배열/컨테이너 대응 + null 필터
        const arr: any[] = Array.isArray(data)
        ? data
        : (data?.items || data?.data || data?.content || data?.list || data?.records || []);
        const normalized = arr.map(normalizePhoto).filter(Boolean) as Photo[];

        console.log('[Gallery] normalized length=', normalized.length);
        setPhotos(normalized);
    } catch (e: any) {
        console.warn('loadAll error:', e?.message);
        Alert.alert('로드 실패', e?.message || '사진 목록을 불러오지 못했어요.');
        setPhotos([]);
    } finally {
        setInitialLoading(false);
    }
    }, [authedFetch]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // 당겨서 새로고침
  const onRefreshFn = useCallback(async () => {
    setRefreshing(true);
    try { await loadAll(); } finally { setRefreshing(false); }
  }, [loadAll]);

  // 저장(다운로드)
  const savePhoto = useCallback(async (p: Photo) => {
    if (!p?.url) return;

    try {
        // // 0) 웹이면 바로 종료
        // if (Platform.OS === 'web') {
        // Alert.alert('안내', '웹 환경에서는 앨범 저장이 지원되지 않아요. iOS/Android에서 시도해 주세요.');
        // return;
        // }

        setSaving(true);

        // 1) 권한
        const perm = await MediaLibrary.requestPermissionsAsync();
        if (!perm.granted) {
        Alert.alert('권한 필요', '사진을 앨범에 저장하려면 권한이 필요합니다.');
        return;
        }

        // 2) 저장할 임시 경로: cache → document 순서로 폴백
        const base =
        FileSystem.cacheDirectory ??
        (FileSystem as any).documentDirectory ?? // 타입 경고 피하기 위함
        null;

        if (!base) {
        Alert.alert(
            '저장 불가',
            '임시 폴더를 찾을 수 없어요. expo-file-system 설치/빌드 상태를 확인해 주세요.',
        );
        return;
        }

        const filename = `photo_${p.id || Date.now()}.jpg`;
        const target = base + filename;

        // 3) 다운로드 후 앨범 저장
        const { uri: localUri } = await FileSystem.downloadAsync(p.url, target);
        await MediaLibrary.saveToLibraryAsync(localUri);

        Alert.alert('저장 완료', '사진이 앨범에 저장되었어요.');
    } catch (e: any) {
        console.error(e);
        Alert.alert('저장 실패', e?.message || '사진을 저장하지 못했어요.');
    } finally {
        setSaving(false);
    }
    }, []);

  // 삭제: DELETE /delete/{couple_id}/{photo_id}
  const deletePhoto = useCallback((p: Photo) => {
    if (!p?.id) return;
    Alert.alert('삭제', '정말 삭제할까요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: async () => {
          try {
            setDeleting(true);
            const coupleId = (await AsyncStorage.getItem('coupleId')) ?? '';
            if (coupleId) throw new Error('커플 ID가 없습니다.');

            await authedFetch(`/delete/1/${encodeURIComponent(p.id)}`, {
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
  }, [authedFetch]);

  // 렌더러
  const numColumns = 3;
  const renderItem = useCallback(({ item }: { item: Photo }) => (
    <Pressable style={styles.cell} onPress={() => setPreview(item)}>
      <Image source={{ uri: item.url }} style={styles.thumb} />
    </Pressable>
  ), []);
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
            <View style={styles.modalTopBar}>
              <Pressable onPress={() => setPreview(null)} style={styles.iconBtn}>
                <Ionicons name="close" size={22} color="#333" />
              </Pressable>
            </View>

            {preview && (
              <Image source={{ uri: preview.url }} style={styles.previewImage} resizeMode="contain" />
            )}

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
