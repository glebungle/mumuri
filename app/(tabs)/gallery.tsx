// app/(tabs)/gallery.tsx
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { format, parseISO } from 'date-fns';
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Image,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Calendar, DateData } from 'react-native-calendars';
import AppText from '../../components/AppText';

const BASE_URL = 'https://mumuri.shop';
const { width: SCREEN_WIDTH } = Dimensions.get('window');

/** ========= FileSystem 타입 불일치 안전 우회 ========= */
const FS: {
  documentDirectory?: string;
  cacheDirectory?: string;
  temporaryDirectory?: string;
} = FileSystem as any;

function getWritableDir(): string {
  const base =
    FS.documentDirectory ??
    FS.cacheDirectory ??
    FS.temporaryDirectory ??
    '';
  if (!base) throw new Error('저장 가능한 디렉토리를 찾을 수 없어요.');
  return base.endsWith('/') ? base : base + '/';
}
/** ================================================== */

/** 서버에서 내려주는 사진 + (옵션) 미션 메타 확장 타입 */
export type Photo = {
  id: string;
  url: string;
  uploadedBy?: string;
  createdAt: string;
  missionId?: number | null;
  missionTitle?: string | null;
  missionDate?: string | null;
};

type PhotosByDate = Record<string, Photo[]>;

/** ✅ [수정됨] 서버 응답 → 클라이언트 표준화 (photoUrl 추가 및 로그 강화) */
function normalizePhoto(raw: any): Photo | null {
  if (!raw || typeof raw !== 'object') return null;

  // ID 필드명 호환성 강화
  const id = raw.id ?? raw.photo_id ?? raw.photoId ?? raw.uuid ?? raw.missionId;
  
  // ✅ [핵심 수정] photoUrl 추가 (미션 API와 동일하게 맞춤)
  const url = raw.presignedUrl ?? raw.url ?? raw.photoUrl ?? raw.photo_url;
  
  const createdAt = raw.createdAt ?? raw.created_at ?? raw.date;

  // 🔍 [디버깅] 데이터가 있는데 버려지는지 확인하기 위한 로그
  if (id == null || !url || !createdAt) {
    console.log('[gallery skip] 필수 데이터 누락되어 제외됨:', 
      { id, hasUrl: !!url, createdAt }, 
      JSON.stringify(raw)
    );
    return null;
  }

  return {
    id: String(id),
    url: String(url),
    uploadedBy: raw.uploadedBy != null ? String(raw.uploadedBy) : undefined,
    createdAt: String(createdAt),
    missionId: raw.missionId != null ? Number(raw.missionId) : null,
    missionTitle: raw.missionTitle ?? null,
    missionDate: raw.missionDate ?? null,
  };
}

/** 날짜별 그룹핑(로컬 표시 기준) */
const groupPhotosByDate = (photos: Photo[]): PhotosByDate => {
  const grouped: PhotosByDate = {};
  photos.forEach((photo) => {
    try {
      const date = format(parseISO(photo.createdAt), 'yyyy-MM-dd');
      if (!grouped[date]) grouped[date] = [];
      grouped[date].push(photo);
    } catch (e) {
      console.warn('날짜 파싱 실패:', photo.createdAt, e);
    }
  });
  return grouped;
};

/** ===== 미리보기 카드 ===== */
type PreviewProps = {
  preview: Photo | null;
  selectedPhotos: Photo[];
  saving: boolean;
  deleting: boolean;
  onSave: (p: Photo) => void;
  onDelete: (p: Photo) => void;
  onPick: (p: Photo) => void;
};

function PreviewCard({
  preview,
  selectedPhotos,
  saving,
  deleting,
  onSave,
  onDelete,
  onPick,
}: PreviewProps) {
  if (!preview) {
    return (
      <View style={styles.emptyPreview}>
        <AppText type='medium' style={styles.emptyText}>선택된 날짜에 사진이 없어요.</AppText>
      </View>
    );
  }

  const uploadedDate = format(parseISO(preview.createdAt), 'yyyy. MM. dd.');

  return (
    <View style={styles.card}>
      {/* 상단 헤더 */}
      <View style={styles.cardHeader}>
        <View style={styles.userInfo}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={24} color="#FFB74D" />
          </View>
          <View>
            <AppText style={styles.userName}>애인</AppText>
            <AppText style={styles.dateLabel}>📅 {uploadedDate}</AppText>
          </View>
        </View>
        <Pressable
          style={styles.menuButton}
          onPress={() => {
            Alert.alert('메뉴', '', [
              { text: '취소', style: 'cancel' },
              { text: '저장', onPress: () => onSave(preview) },
              {
                text: '삭제',
                style: 'destructive',
                onPress: () => onDelete(preview),
              },
            ]);
          }}
        >
          <Ionicons name="ellipsis-horizontal" size={24} color="#fff" />
        </Pressable>
      </View>

      {/* 이미지 영역 */}
      <View style={styles.imageContainer}>
        <Image
          source={{ uri: preview.url }}
          style={styles.mainImage}
          resizeMode="cover"
        />

        {/* 미션 텍스트 오버레이 */}
        {preview.missionId && preview.missionTitle && (
          <View style={styles.missionOverlay}>
            <AppText style={styles.missionText}>{preview.missionTitle}</AppText>
          </View>
        )}
      </View>

      {/* 하단 썸네일 (여러 장 있을 때만) */}
      {selectedPhotos.length > 1 && (
        <View style={styles.thumbnailContainer}>
          <FlatList
            data={selectedPhotos}
            renderItem={({ item }) => (
              <Pressable
                style={[
                  styles.thumbnail,
                  preview?.id === item.id && styles.thumbnailActive,
                ]}
                onPress={() => onPick(item)}
              >
                <Image source={{ uri: item.url }} style={styles.thumbnailImage} />
              </Pressable>
            )}
            keyExtractor={(item) => item.id}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.thumbnailList}
          />
        </View>
      )}
    </View>
  );
}

/** ===================== 메인 탭 ===================== */
export default function GalleryTab() {
  const [allPhotos, setAllPhotos] = useState<Photo[]>([]);
  const [photosByDate, setPhotosByDate] = useState<PhotosByDate>({});
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [preview, setPreview] = useState<Photo | null>(null);

  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const tokenRef = useRef<string | null>(null);
  const coupleIdRef = useRef<number | null>(null);

  const selectedPhotos = useMemo(() => {
    return selectedDate ? photosByDate[selectedDate] || [] : [];
  }, [selectedDate, photosByDate]);

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
        let data: any = {};
        try {
          data = JSON.parse(raw);
        } catch {}
        const found = data?.coupleId ?? data?.couple_id ?? null;
        if (found != null && Number.isFinite(Number(found))) {
          coupleIdRef.current = Number(found);
          await AsyncStorage.setItem('coupleId', String(coupleIdRef.current));
        }
      } catch (e) {
        console.warn('[gallery] getuser 실패:', (e as Error)?.message);
      }
    }
  }, []);

  const authedFetch = useCallback(
    async (path: string, init?: RequestInit) => {
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
    },
    [ensureAuthBasics],
  );

  // ✅ [수정됨] loadAll 함수: 로그 추가
  const loadAll = useCallback(
    async (showSpinner: boolean = true) => {
      if (showSpinner) setInitialLoading(true);
      try {
        await ensureAuthBasics();
        const cid = coupleIdRef.current;
        if (!cid || !Number.isFinite(cid)) {
          throw new Error('커플 ID를 찾을 수 없어요.');
        }
        const path = `/photo/${encodeURIComponent(String(cid))}/all`;
        console.log(`[gallery] requesting: ${path}`);

        const data = await authedFetch(path, { method: 'GET' });
        
        // 🔍 [디버깅] 서버가 실제로 뭘 주는지 원본 로그 출력 (가장 중요!)
        // 데이터가 너무 길 수 있으니 앞부분 1000자만 찍습니다.
        console.log('[gallery raw data]', JSON.stringify(data, null, 2).slice(0, 1000)); 

        const arr: any[] = Array.isArray(data)
          ? data
          : data?.items || data?.data || data?.content || data?.list || data?.records || [];
        
        console.log(`[gallery] items count from server: ${arr.length}`);

        const normalized = arr.map(normalizePhoto).filter(Boolean) as Photo[];
        console.log(`[gallery] normalized count: ${normalized.length}`); 

        const grouped = groupPhotosByDate(normalized);

        setAllPhotos(normalized);
        setPhotosByDate(grouped);

        const dates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));
        if (dates.length > 0) {
          const latest = dates[0];
          setSelectedDate(latest);
          setPreview(grouped[latest][0] || null);
        } else {
          setSelectedDate(null);
          setPreview(null);
        }
      } catch (e: any) {
        console.warn('[gallery] loadAll error:', e?.message);
        Alert.alert('로드 실패', e?.message || '사진 목록을 불러오지 못했어요.');
        setAllPhotos([]);
        setPhotosByDate({});
        setSelectedDate(null);
        setPreview(null);
      } finally {
        if (showSpinner) setInitialLoading(false);
      }
    },
    [authedFetch, ensureAuthBasics],
  );

  useEffect(() => {
    loadAll(true);
  }, [loadAll]);

  const onRefreshFn = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadAll(false);
    } finally {
      setRefreshing(false);
    }
  }, [loadAll]);

  const savePhoto = useCallback(async (p: Photo) => {
    if (!p?.url) return;
    try {
      if (Platform.OS === 'web') {
        Alert.alert('안내', '웹에서는 앨범 저장이 지원되지 않아요.');
        return;
      }
      setSaving(true);
      const perm = await MediaLibrary.requestPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('권한 필요', '사진 저장 권한이 필요합니다.');
        return;
      }
      const baseDir = getWritableDir();
      const filenameRaw = p.url.split('/').pop() || `${p.id}.jpg`;
      const filename = filenameRaw.split('?')[0];
      const downloadDirUri = `${baseDir}downloads/`;
      const fileUri = `${downloadDirUri}${filename}`;

      const dirInfo = await FileSystem.getInfoAsync(downloadDirUri);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(downloadDirUri, { intermediates: true });
      }
      const result = await (FileSystem as any).downloadAsync(p.url, fileUri);
      if (result.status !== 200) throw new Error(`다운로드 실패: HTTP ${result.status}`);
      await MediaLibrary.saveToLibraryAsync(result.uri);
      Alert.alert('저장 완료', '사진이 앨범에 저장되었어요.');
    } catch (e: any) {
      Alert.alert('저장 실패', e?.message || '사진을 저장하지 못했어요.');
    } finally {
      setSaving(false);
    }
  }, []);

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
              if (!cid || !Number.isFinite(cid)) throw new Error('커플 ID가 없습니다.');
              await authedFetch(
                `/delete/${encodeURIComponent(String(cid))}/${encodeURIComponent(p.id)}`,
                {
                  method: 'DELETE',
                },
              );

              setAllPhotos((prevAll) => {
                const nextAll = prevAll.filter((x) => x.id !== p.id);
                const nextGrouped = groupPhotosByDate(nextAll);
                setPhotosByDate(nextGrouped);

                let nextSelected: string | null = selectedDate;
                if (!nextSelected || !nextGrouped[nextSelected]) {
                  const dates = Object.keys(nextGrouped).sort((a, b) => b.localeCompare(a));
                  nextSelected = dates[0] || null;
                }
                setSelectedDate(nextSelected);
                setPreview(
                  nextSelected ? nextGrouped[nextSelected][0] || null : null,
                );
                return nextAll;
              });
            } catch (e: any) {
              Alert.alert('삭제 실패', e?.message || '사진을 삭제하지 못했어요.');
            } finally {
              setDeleting(false);
            }
          },
        },
      ]);
    },
    [authedFetch, ensureAuthBasics, selectedDate],
  );

  const onDayPress = useCallback(
    (day: DateData) => {
      const dateString = day.dateString;
      setSelectedDate(dateString);
      const photos = photosByDate[dateString];
      setPreview(photos && photos.length > 0 ? photos[0] : null);
    },
    [photosByDate],
  );

  if (initialLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color="#007AFF" size="large" />
        <AppText style={styles.loadingText}>사진을 불러오는 중…</AppText>
      </View>
    );
  }

  const initialMonth = selectedDate || format(new Date(), 'yyyy-MM-dd');

  return (
    <View style={styles.container}>
      <AppText style={styles.calendar}>미션 캘린더</AppText>
      <Calendar
        style={styles.calendar}
        renderArrow={(direction) => (
          <Ionicons
            name={direction === 'left' ? 'chevron-back' : 'chevron-forward'}
            size={22}
            color="#111"
          />
        )}
        monthFormat={'yyyy년 M월'}
        headerStyle={styles.calendarHeader}
        initialDate={initialMonth}
        onDayPress={onDayPress}
        enableSwipeMonths
        hideExtraDays={false}
        dayComponent={({ date, state }) => {
          if (!date) return <View style={styles.dayCellEmpty} />;

          const dateStr = date.dateString;
          const photos = photosByDate[dateStr] || [];
          const hasPhoto = photos.length > 0;
          const isSelected = dateStr === selectedDate;
          const dayNum = date.day;

          const dayOfWeek = new Date(date.timestamp).getDay();
          const isSunday = dayOfWeek === 0;
          const isDisabled = state === 'disabled';

          if (hasPhoto && photos[0]?.url) {
            // 사진 있는 날
            return (
              <Pressable
                style={styles.dayCellContainer}
                onPress={() => onDayPress(date)}
                disabled={isDisabled}
              >
                <View
                  style={[
                    styles.photoCell,
                    isSelected && styles.photoCellSelected,
                  ]}
                >
                  <Image
                    source={{ uri: photos[0].url }}
                    style={styles.photoCellImage}
                    resizeMode="cover"
                  />
                  <View style={styles.photoNumberBox}>
                    <Text style={styles.photoNumberText}>{dayNum}</Text>
                  </View>
                </View>
              </Pressable>
            );
          }

          // 사진 없는 날
          return (
            <Pressable
              style={styles.dayCellContainer}
              onPress={() => onDayPress(date)}
              disabled={isDisabled}
            >
              <View style={styles.emptyCell}>
                <Text
                  style={[
                    styles.emptyCellText,
                    isDisabled && styles.emptyCellTextDisabled,
                    isSunday && styles.emptyCellTextSunday,
                    isSelected && styles.emptyCellTextSelected,
                  ]}
                >
                  {dayNum}
                </Text>
              </View>
            </Pressable>
          );
        }}
        theme={{
          backgroundColor: '#FFFCF5',
          calendarBackground: '#FFFCF5',
          textSectionTitleColor: '#A7A7AD',
          selectedDayBackgroundColor: 'transparent',
          selectedDayTextColor: '#3279FF',
          todayTextColor: '#3279FF',
          dayTextColor: '#111',
          textDisabledColor: '#D1D1D6',
          arrowColor: '#111',
          monthTextColor: '#111',
          textMonthFontWeight: '700',
          textDayHeaderFontWeight: '600',
          textDayHeaderFontSize: 13,
          textMonthFontSize: 20,
        }}
      />

      <FlatList
        data={[]}
        renderItem={() => null}
        keyExtractor={() => 'key'}
        ListEmptyComponent={
          <PreviewCard
            preview={preview}
            selectedPhotos={selectedPhotos}
            saving={saving}
            deleting={deleting}
            onSave={savePhoto}
            onDelete={deletePhoto}
            onPick={setPreview}
          />
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefreshFn}
            tintColor="#3279FF"
          />
        }
        contentContainerStyle={styles.scrollContent}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFCF5',
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFCF5',
  },
  loadingText: {
    marginTop: 12,
    color: '#8E8E93',
    fontSize: 15,
  },

  // ===== 캘린더 =====
  calendar: {
    paddingHorizontal: 12,
    paddingBottom: 8,
    backgroundColor: '#FFFCF5',
  },
  calendarHeader: {
    paddingHorizontal: 2,
    paddingTop: 8,
    paddingBottom: 4,
  },

  dayCellEmpty: {
    flex: 1,
  },

  dayCellContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },

  // 사진 있는 셀
  photoCell: {
    width: 40,
    height: 52,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#E5E5EA',
  },
  photoCellSelected: {
    borderWidth: 2,
    borderColor: '#3279FF',
  },
  photoCellImage: {
    width: '100%',
    height: '100%',
  },
  photoNumberBox: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  photoNumberText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFF',
  },

  // 사진 없는 셀
  emptyCell: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCellText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#111',
  },
  emptyCellTextDisabled: {
    color: '#D1D1D6',
  },
  emptyCellTextSunday: {
    color: '#FF3B30',
  },
  emptyCellTextSelected: {
    color: '#3279FF',
    fontWeight: '700',
  },

  // ===== 미리보기 카드 =====
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 24,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: 'rgba(0,0,0,0.25)',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 2,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFE0B2',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  userName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  dateLabel: {
    fontSize: 12,
    color: '#F5F5F5',
    marginTop: 2,
  },
  menuButton: {
    padding: 4,
  },

  imageContainer: {
    position: 'relative',
    width: '100%',
    aspectRatio: SCREEN_WIDTH / (SCREEN_WIDTH * 4) * 3, // 대략 3:4
    backgroundColor: '#F5F5F5',
  },
  mainImage: {
    width: '100%',
    height: '100%',
  },
  missionOverlay: {
    position: 'absolute',
    bottom: 18,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
  },
  missionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
    textAlign: 'center',
  },

  thumbnailContainer: {
    paddingVertical: 14,
    paddingLeft: 16,
    backgroundColor: '#FFFFFF',
  },
  thumbnailList: {
    paddingRight: 16,
  },
  thumbnail: {
    width: 60,
    height: 60,
    borderRadius: 10,
    marginRight: 10,
    borderWidth: 2,
    borderColor: 'transparent',
    overflow: 'hidden',
  },
  thumbnailActive: {
    borderColor: '#3279FF',
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#E5E5EA',
  },

  emptyPreview: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  emptyText: {
    fontSize: 16,
    color: '#8E8E93',
  },
});