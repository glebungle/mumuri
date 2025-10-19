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
    View
} from 'react-native';
import AppText from '../../components/AppText';

// ========= 설정 =========
const BASE_URL = 'https://40b57014557d.ngrok-free.app/swagger-ui/index.html'; // ← 백엔드 베이스 URL로 교체 (ngrok/prod)
const PAGE_SIZE = 30;

// API 응답 타입 (백엔드와 합의)
type Photo = {
  id: string;
  url: string;
  thumbUrl?: string;
  createdAt?: string; // ISO string 권장
  mission?: string;
};
type PhotosResp = {
  items: Photo[];
  nextCursor?: string;
};

export default function GalleryTab() {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [preview, setPreview] = useState<Photo | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const tokenRef = useRef<string | null>(null);

  // ====== 공통 fetch 유틸 (tokenRef를 사용하므로 useCallback의 종속성 제거) ======
  const authedFetch = useCallback(async (path: string, init?: RequestInit) => {
    const token = tokenRef.current || (await AsyncStorage.getItem('token'));
    tokenRef.current = token;

    const res = await fetch(`${BASE_URL}${path}`, {
      ...init,
      headers: {
        ...(init?.headers || {}),
        // 🚨 토큰이 없어도 요청을 보낼 수 있도록 처리 (백엔드에서 401 처리)
        ...(token ? { Authorization: `Bearer ${token}` } : {}), 
      },
    });

    const raw = await res.text();
    let data: any;
    try {
      data = JSON.parse(raw);
    } catch {
      data = { message: raw };
    }

    if (!res.ok) {
      const msg = data?.message || `HTTP ${res.status}`;
      // 401 에러는 로그인 화면으로 리다이렉트하는 등의 추가 로직이 필요할 수 있습니다.
      throw new Error(msg); 
    }
    return data;
  }, []); // 🚨 종속성에서 authedFetch를 제거하여 List 로직이 깔끔하게 재활용되도록 합니다.

  // ====== 목록 로드 ======
  const loadInitial = useCallback(async () => {
    setInitialLoading(true);
    try {
      // 💡 요청 시 URL 인코딩 필요 없음 (fetch가 자동 처리)
      const data = (await authedFetch(
        `/api/photos?limit=${PAGE_SIZE}`
      )) as PhotosResp;
      setPhotos(data.items || []);
      setCursor(data.nextCursor);
    } catch (e: any) {
      Alert.alert('로드 실패', e?.message || '사진 목록을 불러오지 못했어요.');
    } finally {
      setInitialLoading(false);
    }
  }, [authedFetch]);

  const loadMore = useCallback(async () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      // 🚨 cursor를 URL에 포함하기 위해 인코딩 적용
      const data = (await authedFetch(
        `/api/photos?limit=${PAGE_SIZE}&cursor=${encodeURIComponent(cursor)}`
      )) as PhotosResp;
      setPhotos((prev) => [...prev, ...(data.items || [])]);
      setCursor(data.nextCursor);
    } catch (e: any) {
      Alert.alert('추가 로드 실패', e?.message || '더 불러오지 못했어요.');
    } finally {
      setLoadingMore(false);
    }
  }, [authedFetch, cursor, loadingMore]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const data = (await authedFetch(
        `/api/photos?limit=${PAGE_SIZE}`
      )) as PhotosResp;
      setPhotos(data.items || []);
      setCursor(data.nextCursor);
    } catch (e: any) {
      Alert.alert('새로고침 실패', e?.message || '다시 시도해주세요.');
    } finally {
      setRefreshing(false);
    }
  }, [authedFetch]);

  // 🚨 useEffect의 종속성을 loadInitial만 남겨 함수가 한 번만 실행되도록 합니다.
  useEffect(() => {
    loadInitial();
  }, [loadInitial]);

  // ====== 저장(다운로드) ======
  const savePhoto = useCallback(async (p: Photo) => {
  if (!p?.url) return;
  try {
    setSaving(true);

    // 1) 앱 문서 디렉토리 하위에 다운로드 폴더 생성
    // 🚨 수정: FileSystem의 타입 오류를 해결하기 위해 documentDirectory를 명시적 캐스팅
    const baseDir = FileSystem.documentDirectory as string; 
    const downloadDir = `${baseDir}downloads/`;
    try {
      await FileSystem.makeDirectoryAsync(downloadDir, { intermediates: true });
    } catch {
      // 이미 있으면 에러 무시
    }

    // 2) 원격 파일을 로컬로 다운로드
    const filename = `photo_${p.id || Date.now()}.jpg`;
    const target = `${downloadDir}${filename}`;
    // 🚨 fetch의 보안 토큰을 사용하지 않고 FileSystem을 통해 다운로드
    const { uri } = await FileSystem.downloadAsync(p.url, target); 

    // 3) 앨범에 저장
    await MediaLibrary.requestPermissionsAsync(); 
    await MediaLibrary.saveToLibraryAsync(uri);

    Alert.alert('저장 완료', '사진이 앨범에 저장되었어요.');
  } catch (e: any) {
    Alert.alert('저장 실패', e?.message || '사진을 저장하지 못했어요.');
  } finally {
    setSaving(false);
  }
}, []);

  // ====== 삭제 ======
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
            // 🚨 DELETE 요청 시 ID 인코딩
            await authedFetch(`/api/photos/${encodeURIComponent(p.id)}`, { 
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

  // ====== 그리드(3열) ======
  const numColumns = 3;
  const renderItem = useCallback(({ item }: { item: Photo }) => {
    const src = item.thumbUrl || item.url;
    return (
      // 🚨 AppText 적용
      <Pressable style={styles.cell} onPress={() => setPreview(item)}>
        <Image source={{ uri: src }} style={styles.thumb} />
      </Pressable>
    );
  }, []);

  const keyExtractor = useCallback((item: Photo) => item.id, []);

  // ====== 푸터 로딩 ======
  const ListFooter = useMemo(() => {
    if (!loadingMore) return null;
    return (
      <View style={styles.footer}>
        <ActivityIndicator color="#6198FF" /> 
      </View>
    );
  }, [loadingMore]);

  // ====== 최초 로딩 ======
  if (initialLoading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator color="#6198FF" size="large" /> 
        <AppText style={styles.loadingText}>사진을 불러오는 중…</AppText> 
      </View>
    );
  }

  // ====== 본문 ======
  return (
    <View style={styles.wrap}>
      <FlatList
        data={photos}
        keyExtractor={keyExtractor}
        numColumns={numColumns}
        renderItem={renderItem}
        contentContainerStyle={photos.length === 0 ? styles.emptyWrap : undefined}
        ListEmptyComponent={
          // 🚨 AppText 적용
          <AppText style={styles.emptyText}>아직 업로드된 사진이 없어요.</AppText> 
        }
        onEndReachedThreshold={0.3}
        onEndReached={loadMore}
        ListFooterComponent={ListFooter}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6198FF" /> 
        }
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
            {preview && (
              <Image source={{ uri: preview.url }} style={styles.previewImage} resizeMode="contain" />
            )}

            {/* 하단 액션 */}
            <View style={styles.actions}>
              <Pressable style={styles.actionBtn} onPress={() => preview && savePhoto(preview)} disabled={saving}>
                <Ionicons name="download-outline" size={22} color="#3279FF" />
                {/* 🚨 AppText 적용 및 스타일 수정 */}
                <AppText type="semibold" style={styles.actionText}>{saving ? '저장 중…' : '저장'}</AppText>
              </Pressable>

              <Pressable style={styles.actionBtn} onPress={() => preview && deletePhoto(preview)} disabled={deleting}>
                <Ionicons name="trash-outline" size={22} color="#FF4D4F" />
                {/* 🚨 AppText 적용 및 스타일 수정 */}
                <AppText type="semibold" style={[styles.actionText, { color: '#FF4D4F' }]}>{deleting ? '삭제 중…' : '삭제'}</AppText>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ========= 스타일 =========
const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#FFF' },
  loadingWrap: { 
    flex: 1, 
    alignItems: 'center', 
    justifyContent: 'center', 
    backgroundColor: '#FFF' 
},
  loadingText: { marginTop: 8, color: '#666' },

  emptyWrap: { flexGrow: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: '#777' },

  cell: { width: '33.333%', aspectRatio: 1, padding: 1.5 },
  thumb: { flex: 1, borderRadius: 6, backgroundColor: '#eee' },

  footer: { paddingVertical: 16 },

  modalBackdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center', justifyContent: 'center',
  },
  modalCard: {
    width: '90%', maxHeight: '85%', backgroundColor: '#FFF',
    borderRadius: 16, overflow: 'hidden',
  },
  modalTopBar: { padding: 8, alignItems: 'flex-end' },
  iconBtn: {
    width: 36, height: 36, alignItems: 'center', justifyContent: 'center',
    borderRadius: 18, backgroundColor: '#f2f2f2'
  },
  previewImage: { width: '100%', height: 300, backgroundColor: '#000' },

  actions: {
    flexDirection: 'row', justifyContent: 'space-evenly', alignItems: 'center',
    paddingVertical: 14, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#eee',
  },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 10 },
  actionText: { color: '#3279FF', fontWeight: '600' }, // 🚨 fontWeight는 AppText type으로 대체됨
});
