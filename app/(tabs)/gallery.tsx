// app/(tabs)/index.tsx  — GalleryTab (API 경로 반영판)
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

// 서버에서 내려오는 필드명이 달라도 맞춰주기 위한 노멀라이저
type Photo = { id: string; url: string; thumbUrl?: string; createdAt?: string; mission?: string };
function normalizePhoto(raw: any): Photo | null {
  if (!raw) return null;
  // 백엔드 필드명 후보들에 대응
  const id = raw.id ?? raw.photo_id ?? raw.photoId ?? raw.uuid;
  const url = raw.url ?? raw.imageUrl ?? raw.photo_url ?? raw.path;
  const thumbUrl = raw.thumbUrl ?? raw.thumbnail ?? raw.thumb_url;
  if (!id || !url) return null;
  return { id: String(id), url: String(url), thumbUrl, createdAt: raw.createdAt ?? raw.created_at, mission: raw.mission };
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

  // 공통 fetch (토큰/커플ID 로딩)
  const authedFetch = useCallback(async (path: string, init?: RequestInit) => {
    if (!tokenRef.current) tokenRef.current = await AsyncStorage.getItem('token');
    if (!coupleIdRef.current) coupleIdRef.current = await AsyncStorage.getItem('coupleId');

    const headers: Record<string, string> = {
      Accept: 'application/json',
      ...(init?.headers as any),
      ...(tokenRef.current ? { Authorization: `Bearer ${tokenRef.current}` } : {}),
      'ngrok-skip-browser-warning': 'true',
    };

    const res = await fetch(`${BASE_URL}${path}`, { ...init, headers });
    const raw = await res.text();
    let data: any;
    try { data = JSON.parse(raw); } catch { data = raw; }

    if (!res.ok) {
      const msg = (data && (data.message || data.error)) || `HTTP ${res.status}`;
      throw new Error(msg);
    }
    return data;
  }, []);

  // 전체 목록 로드: GET /photo/{couple_id}/all
  const loadAll = useCallback(async () => {
    setInitialLoading(true);
    try {
      const coupleId = (await AsyncStorage.getItem('coupleId')) || '';
      if (!coupleId) throw new Error('커플 ID가 없습니다.');

      const data = await authedFetch(`/photo/${encodeURIComponent(coupleId)}/all`, { method: 'GET' });

      // 배열/객체 형태 모두 안전 처리
      const arr = Array.isArray(data) ? data : data?.items || [];
      const normalized = arr.map(normalizePhoto).filter(Boolean) as Photo[];
      setPhotos(normalized);
    } catch (e: any) {
      Alert.alert('로드 실패', e?.message || '사진 목록을 불러오지 못했어요.');
      setPhotos([]);
    } finally {
      setInitialLoading(false);
    }
  }, [authedFetch]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await loadAll(); } finally { setRefreshing(false); }
  }, [loadAll]);

  // 저장(다운로드)
  const savePhoto = useCallback(async (p: Photo) => {
    if (!p?.url) return;
    try {
      setSaving(true);
      const baseDir = FileSystem.documentDirectory as string;
      const downloadDir = `${baseDir}downloads/`;
      try { await FileSystem.makeDirectoryAsync(downloadDir, { intermediates: true }); } catch {}

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

  // 삭제: DELETE /delete/{couple_id}/{photo_id}
  const deletePhoto = useCallback(async (p: Photo) => {
    if (!p?.id) return;
    Alert.alert('삭제', '정말 삭제할까요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: async () => {
          try {
            setDeleting(true);
            const coupleId = (await AsyncStorage.getItem('coupleId')) || '';
            if (!coupleId) throw new Error('커플 ID가 없습니다.');

            await authedFetch(`/delete/${encodeURIComponent(coupleId)}/${encodeURIComponent(p.id)}`, {
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

  // 그리드
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

  const ListFooter = useMemo(() => null, []); // (현재 API는 페이지네이션 없음)

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
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6198FF" />}
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
                <AppText type="semibold" style={styles.actionText}>{saving ? '저장 중…' : '저장'}</AppText>
              </Pressable>

              <Pressable style={styles.actionBtn} onPress={() => preview && deletePhoto(preview)} disabled={deleting}>
                <Ionicons name="trash-outline" size={22} color="#FF4D4F" />
                <AppText type="semibold" style={[styles.actionText, { color: '#FF4D4F' }]}>
                  {deleting ? '삭제 중…' : '삭제'}
                </AppText>
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
