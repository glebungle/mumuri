import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { addMonths, format, parseISO, subMonths } from 'date-fns';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Image,
  ImageBackground,
  Pressable,
  StyleSheet,
  View
} from 'react-native';
import { Calendar, DateData } from 'react-native-calendars';
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
function normalizeMission(raw: any): Photo | null {
  if (!raw || typeof raw !== 'object') return null;
  if (!raw.photoUrl || !raw.completedAt) return null;

  return {
    id: String(raw.missionId),
    url: raw.photoUrl,
    createdAt: raw.completedAt,
    missionId: raw.missionId,
    missionTitle: raw.title || null,
  };
}

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

// ✅ [최적화] 날짜 셀 컴포넌트 분리 (React.memo 사용으로 깜빡임 방지)
const MemoizedDay = React.memo(
  ({ date, state, photos, isSelected, onPress }: any) => {
    if (!date) return <View style={styles.dayCellEmpty} />;

    const dateStr = date.dateString;
    const hasPhoto = photos && photos.length > 0;
    const dayNum = date.day;
    const dayOfWeek = new Date(dateStr).getDay();
    const isSunday = dayOfWeek === 0;
    const isDisabled = state === 'disabled';

    return (
      <Pressable
        style={[
          styles.dayCellContainer,
          isSelected && !hasPhoto && styles.dayCellSelectedBorder,
        ]}
        onPress={() => onPress(date)}
        disabled={isDisabled}
      >
        {hasPhoto ? (
          <View style={styles.photoCell}>
            <Image
              source={{ uri: photos[0].url }}
              style={styles.photoCellImage}
              resizeMode="cover"
            />
            <View style={styles.photoDateOverlay}>
              <AppText type='pretendard-r' style={styles.photoDateText}>{dayNum}</AppText>
            </View>
          </View>
        ) : (
          <AppText
            type="pretendard-r"
            style={[
              styles.dayText,
              isDisabled && styles.dayTextDisabled,
              isSunday && !isDisabled && styles.dayTextSunday,
              isSelected && styles.dayTextSelected,
            ]}
          >
            {dayNum}
          </AppText>
        )}
      </Pressable>
    );
  },
  (prev, next) => {
    // 변경사항이 있을 때만 리렌더링 (날짜 선택 시 전체 깜빡임 방지 핵심 로직)
    return (
      prev.isSelected === next.isSelected &&
      prev.date?.dateString === next.date?.dateString &&
      prev.state === next.state &&
      prev.photos === next.photos
    );
  }
);

export default function CalendarScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [photosByDate, setPhotosByDate] = useState<PhotosByDate>({});

  const [currentMonth, setCurrentMonth] = useState<string>(
    format(new Date(), 'yyyy-MM-01')
  );
  const [selectedDate, setSelectedDate] = useState<string>(
    format(new Date(), 'yyyy-MM-dd')
  );
  const [selectedPhotos, setSelectedPhotos] = useState<Photo[]>([]);

  // --- 데이터 로드 (페이지 포커스될 때만 호출) ---
  const loadData = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        Alert.alert('알림', '로그인이 필요합니다.');
        router.replace('/');
        return;
      }

      const res = await fetch(`${BASE_URL}/api/couples/missions/history`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
          'ngrok-skip-browser-warning': 'true',
        },
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const list = Array.isArray(data) ? data : data.content || [];
      const parsed = list.map(normalizeMission).filter(Boolean) as Photo[];
      const grouped = groupPhotosByDate(parsed);

      setPhotosByDate(grouped);
    } catch (e) {
      console.warn('[Calendar] Load failed:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  // 날짜/데이터 변경 시 선택된 날짜의 사진만 별도로 관리
  useEffect(() => {
    setSelectedPhotos(photosByDate[selectedDate] || []);
  }, [photosByDate, selectedDate]);

  const onDayPress = useCallback((day: DateData) => {
    const date = day.dateString;
    setSelectedDate(date);
  }, []);

  const changeMonth = (direction: 'prev' | 'next') => {
    const newDate =
      direction === 'prev'
        ? subMonths(parseISO(currentMonth), 1)
        : addMonths(parseISO(currentMonth), 1);
    setCurrentMonth(format(newDate, 'yyyy-MM-01'));
  };

  // --- UI ---
  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#333" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* 1. 헤더 */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={28} color="#111" />
          </Pressable>
          <AppText style={styles.headerTitle}>미션 캘린더</AppText>
        </View>
        <Pressable
          style={styles.switchBtn}
          onPress={() => Alert.alert('알림', '준비 중인 기능입니다.')}
        >
          <AppText style={styles.switchBtnText}>일정 캘린더</AppText>
        </Pressable>
      </View>

      {/* 2. 월 이동 네비게이션 */}
      <View style={styles.monthNav}>
        <Pressable onPress={() => changeMonth('prev')} style={styles.monthNavBtn}>
          <Ionicons name="chevron-back" size={20} color="#333" />
        </Pressable>
        <AppText type="semibold" style={styles.monthTitle}>
          {format(parseISO(currentMonth), 'yyyy년 M월')}
        </AppText>
        <Pressable onPress={() => changeMonth('next')} style={styles.monthNavBtn}>
          <Ionicons name="chevron-forward" size={20} color="#333" />
        </Pressable>
      </View>

      {/* 3. 캘린더 */}
      <View style={styles.CalenderContainer}>
        <Calendar
          key={currentMonth} 
          
          current={currentMonth}
          renderHeader={() => null}
          hideArrows={true}
          theme={{
            backgroundColor: '#FFFCF5',
            calendarBackground: '#FFFCF5',
            textSectionTitleColor: '#B0B0B0',
            selectedDayBackgroundColor: 'transparent',
            todayTextColor: '#333',
            dayTextColor: '#111',
            textDisabledColor: '#E0E0E0',
          }}
          dayComponent={({ date, state }) => {
            const photos = date ? photosByDate[date.dateString] : [];
            const hasPhoto = photos && photos.length > 0;

            return (
              <MemoizedDay
                date={date}
                state={state}
                photos={photos}
                isSelected={!hasPhoto && date?.dateString === selectedDate}
                onPress={onDayPress}
              />
            );
          }}
        />
      </View>

      {/* 4. 하단 프리뷰 */}
      <View style={styles.bottomContainer}>
        {selectedPhotos.length === 0 ? (
          <View style={styles.emptyBox}>
            <AppText style={styles.emptyText}>이 날의 미션 기록이 없어요.</AppText>
          </View>
        ) : (
          <FlatList
            data={selectedPhotos}
            keyExtractor={(item) => item.id}
            horizontal
            pagingEnabled // 사진 한 장씩 넘기기
            showsHorizontalScrollIndicator={false}
            renderItem={({ item }) => (
              <View style={styles.previewCard}>
                {/* 배경 이미지 */}
                <ImageBackground
                  source={{ uri: item.url }}
                  style={styles.previewImage}
                  resizeMode="cover"
                >
                  {/* 상단 오버레이 (아바타 + 날짜) */}
                  <View style={styles.previewHeaderOverlay}>
                    <View style={styles.previewAvatar}>
                      {/* 실제 아바타가 있다면 item.userAvatar 등을 사용 */}
                      <Image
                        source={{ uri: item.url }}
                        style={{ width: '100%', height: '100%' }}
                      />
                    </View>
                    <View>
                      <AppText style={styles.previewNameText}>애인</AppText>
                      <View
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        <Ionicons
                          name="calendar-outline"
                          size={12}
                          color="#EEE"
                        />
                        <AppText style={styles.previewDateText}>
                          {format(parseISO(item.createdAt), 'yyyy. MM. dd.')}
                        </AppText>
                      </View>
                    </View>
                  </View>

                  {/* 하단 오버레이 (미션 제목) */}
                  {item.missionTitle && (
                    <View style={styles.previewMissionBadge}>
                      <AppText style={styles.previewMissionText}>
                        {item.missionTitle}
                      </AppText>
                    </View>
                  )}
                </ImageBackground>
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

  // 헤더
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 40,
    paddingBottom: 4,
    backgroundColor: '#FFFCF5',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  backBtn: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 22,
    color: '#111',
  },
  switchBtn: {
    backgroundColor: '#111',
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderRadius: 24,
  },
  switchBtnText: {
    color: '#C7C7C7',
    fontSize: 13,
  },

  // 달 변경 네비게이션
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginTop: 8,
  },
  monthNavBtn: {
    padding: 4,
  },
  monthTitle: {
    fontSize: 13,
    color: '#444444',
    marginHorizontal: 4,
  },

  CalenderContainer: {
    
  },

  // 캘린더 날짜 셀
  dayCellEmpty: {
    flex: 1,
  },
  dayCellContainer: {
    width: 44,
    height: 56,
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginVertical: 0,
    paddingVertical: 0,
  },
  dayCellSelectedBorder: {
    borderWidth: 2,
    borderColor: '#6198FF',
    borderRadius: 8,
  },
  dayText: {
    fontSize: 12,
    color: '#111',
  },
  dayTextDisabled: {
    color: '#D1D1D6',
  },
  dayTextSunday: {
    color: '#FF3B30',
  },
  dayTextSelected: {
    color: '#3279FF',
  },

  // 사진 셀 스타일 (작은 썸네일)
  photoCell: {
    width: '100%',
    height: '100%',
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#E5E5EA',
  },
  photoCellImage: {
    width: '100%',
    height: '100%',
    opacity: 0.8,
  },
  photoDateOverlay: {
    position: 'absolute',
    left: 0,
    width: '100%',
    alignItems: 'center',
  },
  photoDateText: {
    fontSize: 12,
    color: '#111',
  },

  bottomContainer: {
    flex: 1,
    marginTop: 10,
    paddingHorizontal: 16, // 좌우 여백
    paddingBottom: 20,
  },
  emptyBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 40,
  },
  emptyText: {
    color: '#BBB',
    fontSize: 15,
  },

  // 프리뷰 카드
  previewCard: {
    width: SCREEN_WIDTH - 32, // 좌우 패딩 제외한 꽉 찬 너비
    height: '90%',
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  previewImage: {
    width: '100%',
    height: '100%',
    justifyContent: 'space-between', // 상단 헤더와 하단 뱃지 배치용
  },

  // 프리뷰 상단 오버레이 (프로필)
  previewHeaderOverlay: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    paddingTop: 24,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
  previewAvatar: {
    width: 40,
    height: 40,
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: '#DDD',
  },
  previewNameText: {
    color: '#FFF',
    fontSize: 11,
    marginBottom: 2,
  },
  previewDateText: {
    color: '#EEE',
    fontSize: 11,
  },

  previewMissionBadge: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  previewMissionText: {
    color: '#FFF',
    fontSize: 10,
    textAlign: 'center',
  },
});
