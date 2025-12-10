import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { format, parseISO } from 'date-fns';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  View
} from 'react-native';
import { Calendar, DateData } from 'react-native-calendars';
// ✅ [수정] 파일이 'app/calendar.tsx'에 있다면 ../ 로 접근해야 합니다.
import AppText from '../components/AppText';

const BASE_URL = 'https://mumuri.shop';
const { width: SCREEN_WIDTH } = Dimensions.get('window');

// --- 타입 정의 ---
type Photo = {
  id: string;
  url: string;
  createdAt: string;
  missionId?: number | null;
  missionTitle?: string | null;
};

type PhotosByDate = Record<string, Photo[]>;

// --- 데이터 정규화 ---
function normalizePhoto(raw: any): Photo | null {
  if (!raw || typeof raw !== 'object') return null;
  const id = raw.id ?? raw.photo_id ?? raw.photoId;
  // ✅ 갤러리/미션 API 필드명 호환 (photoUrl 추가)
  const url = raw.photoUrl ?? raw.url ?? raw.presignedUrl ?? raw.photo_url;
  const createdAt = raw.createdAt ?? raw.created_at ?? raw.date;

  if (!id || !url || !createdAt) return null;

  return {
    id: String(id),
    url: String(url),
    createdAt: String(createdAt),
    missionId: raw.missionId,
    missionTitle: raw.missionTitle,
  };
}

// --- 날짜별 그룹핑 ---
const groupPhotosByDate = (photos: Photo[]): PhotosByDate => {
  const grouped: PhotosByDate = {};
  photos.forEach((photo) => {
    try {
      const date = format(parseISO(photo.createdAt), 'yyyy-MM-dd');
      if (!grouped[date]) grouped[date] = [];
      grouped[date].push(photo);
    } catch (e) {
      console.warn('Date parse error:', photo.createdAt);
    }
  });
  return grouped;
};

export default function CalendarScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [photosByDate, setPhotosByDate] = useState<PhotosByDate>({});
  const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [selectedPhotos, setSelectedPhotos] = useState<Photo[]>([]);

  // --- 데이터 로드 ---
  const loadData = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      const coupleId = await AsyncStorage.getItem('coupleId');

      if (!token || !coupleId) {
        Alert.alert('알림', '로그인이 필요합니다.');
        router.replace('/');
        return;
      }

      // 사진 전체 로드
      const res = await fetch(`${BASE_URL}/photo/${coupleId}/all`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
          'ngrok-skip-browser-warning': 'true',
        },
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      
      const data = await res.json();
      // 배열 호환성 체크
      const list = Array.isArray(data) ? data : (data.items || []);
      
      const parsed = list.map(normalizePhoto).filter(Boolean) as Photo[];
      const grouped = groupPhotosByDate(parsed);
      
      setPhotosByDate(grouped);
      // 현재 선택된 날짜 데이터 갱신
      setSelectedPhotos(grouped[selectedDate] || []);

    } catch (e) {
      console.warn('[Calendar] Load failed:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedDate]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const onDayPress = (day: DateData) => {
    const date = day.dateString;
    setSelectedDate(date);
    setSelectedPhotos(photosByDate[date] || []);
  };

  // --- UI 렌더링 ---
  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#333" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* 1. 상단 헤더 */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color="#333" />
        </Pressable>
        <AppText style={styles.headerTitle}>캘린더</AppText>
        <View style={{ width: 24 }} />
      </View>

      {/* 2. 캘린더 */}
      <Calendar
        current={selectedDate}
        onDayPress={onDayPress}
        monthFormat={'yyyy년 M월'}
        theme={{
          backgroundColor: '#FFFCF5',
          calendarBackground: '#FFFCF5',
          todayTextColor: '#3279FF',
          arrowColor: '#333',
          textMonthFontWeight: 'bold',
          textDayHeaderFontWeight: '600',
        }}
        // 사진이 있는 날짜 마킹 (작은 점 표시)
        markedDates={{
          ...Object.keys(photosByDate).reduce((acc, date) => {
            acc[date] = { marked: true, dotColor: '#FFB74D' };
            return acc;
          }, {} as any),
          [selectedDate]: {
            selected: true,
            selectedColor: '#3279FF',
            marked: !!photosByDate[selectedDate],
            dotColor: '#FFF',
          },
        }}
      />

      {/* 3. 선택된 날짜의 사진 리스트 */}
      <View style={styles.listContainer}>
        <View style={styles.listHeader}>
          <AppText style={styles.dateTitle}>{selectedDate.replace(/-/g, '. ')}</AppText>
          <AppText style={styles.countText}>{selectedPhotos.length}장의 사진</AppText>
        </View>

        {selectedPhotos.length === 0 ? (
          <View style={styles.emptyBox}>
            <AppText style={styles.emptyText}>이 날의 기록이 없어요.</AppText>
          </View>
        ) : (
          <FlatList
            data={selectedPhotos}
            keyExtractor={(item) => item.id}
            numColumns={2}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            columnWrapperStyle={styles.columnWrapper}
            renderItem={({ item }) => (
              <View style={styles.photoCard}>
                <Image source={{ uri: item.url }} style={styles.photo} resizeMode="cover" />
                {item.missionTitle && (
                  <View style={styles.missionBadge}>
                    <AppText style={styles.missionText} numberOfLines={1}>
                      {item.missionTitle}
                    </AppText>
                  </View>
                )}
              </View>
            )}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFCF5',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFCF5',
  },
  backBtn: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
  },
  listContainer: {
    flex: 1,
    backgroundColor: '#FFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: 10,
    paddingHorizontal: 20,
    paddingTop: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 5,
  },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  dateTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111',
  },
  countText: {
    fontSize: 14,
    color: '#888',
  },
  emptyBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 40,
  },
  emptyText: {
    color: '#BBB',
    fontSize: 15,
  },
  columnWrapper: {
    justifyContent: 'space-between',
    gap: 12,
  },
  photoCard: {
    width: (SCREEN_WIDTH - 40 - 12) / 2, // (화면 - 패딩 - 갭) / 2
    height: (SCREEN_WIDTH - 40 - 12) / 2,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 12,
    backgroundColor: '#F0F0F0',
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  missionBadge: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  missionText: {
    color: '#FFF',
    fontSize: 11,
    textAlign: 'center',
  },
});