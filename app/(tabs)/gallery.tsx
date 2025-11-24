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
  url: string;                // presigned 또는 직접 접근 가능한 URL
  uploadedBy?: string;
  createdAt: string;          // ISO8601(UTC 권장: Z 포함)
  missionId?: number | null;  // 없으면 일반 사진
  missionTitle?: string | null;
  missionDate?: string | null; // 'YYYY-MM-DD' 권장
};

type PhotosByDate = Record<string, Photo[]>;

/** 서버 응답 → 클라이언트 표준화 */
function normalizePhoto(raw: any): Photo | null {
  if (!raw || typeof raw !== 'object') return null;
  const id = raw.id ?? raw.photo_id ?? raw.photoId ?? raw.uuid;
  const url = raw.presignedUrl ?? raw.url;
  const createdAt = raw.createdAt ?? raw.created_at;
  if (id == null || !url || !createdAt) return null;
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

/** ===== 캘린더 Day 셀(모듈 스코프, 훅 사용 금지) ===== */
type DayCellProps = {
  date?: DateData;
  state?: string;
  selectedDate: string | null;
  photosByDate: PhotosByDate;
  onDayPress: (day: DateData) => void;
};

function DayCell({ date, state, selectedDate, photosByDate, onDayPress }: DayCellProps) {
  if (!date) return <View style={styles.emptyDayCell} />;

  const dayText = String(date.day);
  const dateString = date.dateString;
  const photos = photosByDate[dateString] || [];
  const hasPhoto = photos.length > 0;
  const isSelected = dateString === selectedDate;
  const thumbUri = hasPhoto ? photos[0].url : undefined;

  const dayOfWeek = new Date(date.timestamp).getDay(); // 0=일
  const isSunday = dayOfWeek === 0;

  return (
    <Pressable
      style={styles.dayPressable}
      onPress={() => onDayPress(date)}
      disabled={state === 'disabled'}
    >
      {thumbUri ? (
        <>
          <Image
            source={{ uri: thumbUri }}
            style={[styles.thumbInCalendar, isSelected && { opacity: 0.85 }]}
          />
          <View style={[styles.dayTextOverlay, isSelected && { backgroundColor: 'rgba(0,0,0,0.3)' }]}>
            <AppText
              style={[
                styles.dayText,
                styles.dayTextOverlayText,
                isSunday && { color: '#FFF' },
              ]}
            >
              {dayText}
            </AppText>
          </View>
        </>
      ) : (
        <View style={styles.emptyDayCellPlaceholder}>
          <AppText
            style={[
              styles.dayText,
              state === 'disabled' && styles.dayTextDisabled,
              isSunday && styles.dayTextWeekend,
              isSelected && styles.dayTextSelected,
            ]}
          >
            {dayText}
          </AppText>
        </View>
      )}
    </Pressable>
  );
}

/** ===== 미리보기 카드(모듈 스코프, 훅 사용 금지) ===== */
type PreviewProps = {
  preview: Photo | null;
  selectedPhotos: Photo[];
  saving: boolean;
  deleting: boolean;
  onSave: (p: Photo) => void;
  onDelete: (p: Photo) => void;
  onPick: (p: Photo) => void;
};

function PreviewCard({ preview, selectedPhotos, saving, deleting, onSave, onDelete, onPick }: PreviewProps) {
  if (!preview) {
    return (
      <View style={styles.emptyPreview}>
        <AppText style={styles.emptyText}>선택된 날짜에 사진이 없어요.</AppText>
      </View>
    );
  }
  const uploadedDate = format(parseISO(preview.createdAt), 'yyyy. MM. dd.');

  return (
    <View style={styles.previewContainer}>
      <View style={styles.previewHeader}>
        <View style={styles.profileContainer}>
          <Ionicons name="person-circle" size={30} color="#666" style={styles.profileIcon} />
          <View>
            <AppText style={styles.uploaderText}>애인</AppText>
            <AppText style={styles.dateText}>📅 {uploadedDate}</AppText>
          </View>
        </View>

        <View style={styles.actions}>
          <Pressable style={styles.actionBtn} onPress={() => onSave(preview)} disabled={saving}>
            <Ionicons name="download-outline" size={22} color="#3279FF" />
            <AppText style={styles.actionText}>{saving ? '저장 중' : '저장'}</AppText>
          </Pressable>

          <Pressable style={styles.actionBtn} onPress={() => onDelete(preview)} disabled={deleting}>
            <Ionicons name="trash-outline" size={22} color="#FF4D4F" />
            <AppText style={[styles.actionText, { color: '#FF4D4F' }]}>{deleting ? '삭제 중' : '삭제'}</AppText>
          </Pressable>
        </View>
      </View>

      <Image source={{ uri: preview.url }} style={styles.previewImage} resizeMode="cover" />

      {preview.missionId ? (
        <View style={styles.missionBox}>
          <Ionicons name="checkmark-circle" size={20} color="#6198FF" />
          <AppText style={styles.missionText}>
            {preview.missionTitle || '미션 사진'}
            {preview.missionDate ? ` · ${preview.missionDate}` : ''}
          </AppText>
        </View>
      ) : null}

      {selectedPhotos.length > 1 && (
        <View style={styles.thumbnailsListContainer}>
          <FlatList
            data={selectedPhotos}
            renderItem={({ item }) => (
              <Pressable
                style={[styles.thumbCell, preview?.id === item.id && styles.thumbCellSelected]}
                onPress={() => onPick(item)}
              >
                <Image source={{ uri: item.url }} style={styles.thumbImage} />
              </Pressable>
            )}
            keyExtractor={(item) => item.id}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.thumbnailsList}
          />
        </View>
      )}
    </View>
  );
}

/** ===================== 메인 탭 ===================== */
export default function GalleryTab() {
  // ── 훅 선언(항상 같은 순서/개수) ────────────────────
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
    return selectedDate ? (photosByDate[selectedDate] || []) : [];
  }, [selectedDate, photosByDate]);

  // ── 인증 기초 확보 ─────────────────────────────────
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
        try { data = JSON.parse(raw); } catch {}
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

  // ── 공통 fetch ────────────────────────────────────
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
      console.log('[REQ]', init?.method || 'GET', url, 'status=', res.status, 'raw=', raw.slice(0, 200));
      if (res.status === 204 || raw.trim() === '') return null;
      let data: any;
      try { data = JSON.parse(raw); } catch { data = raw; }
      if (!res.ok) {
        const msg = (data && (data.message || data.error)) || `HTTP ${res.status}`;
        throw new Error(msg);
      }
      return data;
    },
    [ensureAuthBasics]
  );

  // ── 목록 로드 ─────────────────────────────────────
  const loadAll = useCallback(
    async (showSpinner: boolean = true) => {
      if (showSpinner) setInitialLoading(true);
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
    [authedFetch, ensureAuthBasics]
  );

  useEffect(() => { loadAll(true); }, [loadAll]);

  // ── 당겨서 새로고침 ───────────────────────────────
  const onRefreshFn = useCallback(async () => {
    setRefreshing(true);
    try { await loadAll(false); } finally { setRefreshing(false); }
  }, [loadAll]);

  // ── 저장(다운로드) ────────────────────────────────
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
      console.error('Save error:', e);
      Alert.alert('저장 실패', e?.message || '사진을 저장하지 못했어요.');
    } finally {
      setSaving(false);
    }
  }, []);

  // ── 삭제 ─────────────────────────────────────────
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
            await ensureAuthBasics();
            const cid = coupleIdRef.current;
            if (!cid || !Number.isFinite(cid)) throw new Error('커플 ID가 없습니다.');
            await authedFetch(`/delete/${encodeURIComponent(String(cid))}/${encodeURIComponent(p.id)}`, {
              method: 'DELETE',
            });

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
              setPreview(nextSelected ? (nextGrouped[nextSelected][0] || null) : null);
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
  }, [authedFetch, ensureAuthBasics, selectedDate]);

  // ── 날짜 클릭 ────────────────────────────────────
  const onDayPress = useCallback((day: DateData) => {
    const dateString = day.dateString;
    setSelectedDate(dateString);
    const photos = photosByDate[dateString];
    setPreview(photos && photos.length > 0 ? photos[0] : null);
  }, [photosByDate]);

  // ── 로딩 화면 ────────────────────────────────────
  if (initialLoading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator color="#6198FF" size="large" />
        <AppText style={styles.loadingText}>사진을 불러오는 중…</AppText>
      </View>
    );
  }

  const initialMonth = selectedDate || format(new Date(), 'yyyy-MM-dd');

  // ── 렌더 ─────────────────────────────────────────
  return (
    <View style={styles.wrap}>
      <Calendar
        style={{ minHeight: 340 }}
        renderArrow={(direction) => (
          <Ionicons
            name={direction === 'left' ? 'chevron-back-outline' : 'chevron-forward-outline'}
            size={24}
            color="#333"
          />
        )}
        monthFormat={'yyyy년 M월'}
        headerStyle={styles.calendarHeader}
        initialDate={initialMonth}
        dayComponent={(p: any) => (
          <DayCell
            {...p}
            selectedDate={selectedDate}
            photosByDate={photosByDate}
            onDayPress={onDayPress}
          />
        )}
        enableSwipeMonths
        hideExtraDays={false}
        theme={{
          backgroundColor: '#ffffff',
          calendarBackground: '#ffffff',
          textSectionTitleColor: '#666',
          selectedDayBackgroundColor: '#6198FF',
          selectedDayTextColor: '#ffffff',
          todayTextColor: '#6198FF',
          dayTextColor: '#333',
          textDisabledColor: '#ccc',
          dotColor: '#6198FF',
          selectedDotColor: '#ffffff',
          arrowColor: '#333',
          monthTextColor: '#333',
          textMonthFontWeight: 'bold',
          textDayHeaderFontWeight: 'bold',
          textDayHeaderFontSize: 14,
          textMonthFontSize: 20,
        }}
      />

      <View style={styles.separator} />

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
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefreshFn} tintColor="#6198FF" />}
        contentContainerStyle={styles.previewScrollContainer}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#FFF' },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF' },
  loadingText: { marginTop: 8, color: '#666' },

  emptyPreview: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  emptyText: { color: '#777', fontSize: 16 },
  separator: { height: 1, backgroundColor: '#eee', marginVertical: 8 },

  // --- 캘린더 스타일 ---
  calendarHeader: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 6 },

  // 날짜 셀: 부모 셀 영역 100% 사용
  dayPressable: { flex: 1, width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' },
  emptyDayCell: { flex: 1, width: '100%', height: '100%' },
  emptyDayCellPlaceholder: { flex: 1, justifyContent: 'center', alignItems: 'center', width: '100%' },

  dayText: { fontSize: 13, textAlign: 'center' },
  dayTextDisabled: { color: '#ccc' },
  dayTextWeekend: { color: 'red' },
  dayTextSelected: { color: '#FFF' },

  thumbInCalendar: {
    position: 'absolute',
    top: 2, bottom: 2, left: 2, right: 2,
    borderRadius: 8,
    backgroundColor: '#eee',
  },
  dayTextOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
    padding: 4,
    borderRadius: 8,
  },
  dayTextOverlayText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 14,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },

  // --- 미리보기/상세 ---
  previewScrollContainer: { flexGrow: 1, padding: 10, backgroundColor: '#f9f9f9' },
  previewContainer: {
    padding: 8,
    backgroundColor: '#fff',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },

  previewHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 12 },
  profileContainer: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  profileIcon: { color: '#6198FF' },
  uploaderText: { fontWeight: 'bold', fontSize: 16, color: '#333' },
  dateText: { fontSize: 12, color: '#777' },

  previewImage: { width: '100%', height: SCREEN_WIDTH * 0.7, borderRadius: 10, backgroundColor: '#ccc', marginVertical: 8 },

  missionBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#e7f0ff',
    borderRadius: 8,
    gap: 8,
    marginBottom: 10,
  },
  missionText: { fontSize: 14, color: '#333' },

  actions: { flexDirection: 'row', gap: 10 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  actionText: { color: '#3279FF', fontWeight: '600', fontSize: 14 },

  thumbnailsListContainer: { paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#eee' },
  thumbnailsList: { paddingRight: 16 },
  thumbCell: {
    width: 60,
    height: 60,
    marginRight: 8,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: 'transparent',
    overflow: 'hidden',
  },
  thumbCellSelected: { borderColor: '#6198FF' },
  thumbImage: { flex: 1, backgroundColor: '#eee' },
});
