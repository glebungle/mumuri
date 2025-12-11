import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { addMonths, format, parseISO, subMonths } from 'date-fns';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Image,
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
function normalizePhoto(raw: any): Photo | null {
  if (!raw || typeof raw !== 'object') return null;
  const id = raw.id ?? raw.photo_id ?? raw.photoId;
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
  
  // 현재 보고 있는 달 (YYYY-MM-DD 형식, 일자는 01로 고정)
  const [currentMonth, setCurrentMonth] = useState<string>(format(new Date(), 'yyyy-MM-01'));
  
  // 선택된 날짜
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
      const list = Array.isArray(data) ? data : (data.items || []);
      
      const parsed = list.map(normalizePhoto).filter(Boolean) as Photo[];
      const grouped = groupPhotosByDate(parsed);
      
      setPhotosByDate(grouped);
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

  // 달 변경 핸들러
  const changeMonth = (direction: 'prev' | 'next') => {
    const newDate = direction === 'prev' 
      ? subMonths(parseISO(currentMonth), 1) 
      : addMonths(parseISO(currentMonth), 1);
    setCurrentMonth(format(newDate, 'yyyy-MM-01'));
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
      {/* 1. 상단 헤더 (미션 캘린더 + 일정 캘린더 버튼) */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={28} color="#111" />
          </Pressable>
          <AppText style={styles.headerTitle}>미션 캘린더</AppText>
        </View>
        
        <Pressable style={styles.switchBtn} onPress={() => Alert.alert('알림', '준비 중인 기능입니다.')}>
          <AppText style={styles.switchBtnText}>일정 캘린더</AppText>
        </Pressable>
      </View>

      {/* 2. 커스텀 달력 헤더 ( < 2025년 10월 > ) */}
      <View style={styles.monthNav}>
        <Pressable onPress={() => changeMonth('prev')} style={styles.monthNavBtn}>
          <Ionicons name="chevron-back" size={20} color="#333" />
        </Pressable>
        <AppText type='semibold' style={styles.monthTitle}>
          {format(parseISO(currentMonth), 'yyyy년 M월')}
        </AppText>
        <Pressable onPress={() => changeMonth('next')} style={styles.monthNavBtn}>
          <Ionicons name="chevron-forward" size={20} color="#333" />
        </Pressable>
      </View>

      {/* 3. 캘린더 */}
      <View style={styles.CalendarContainer}>
        <Calendar
          // 현재 보여지는 달 (currentMonth 기준)
          key={currentMonth} 
          current={currentMonth}
          onDayPress={onDayPress}
          // 기본 헤더 숨김 (커스텀 헤더 사용)
          renderHeader={() => null} 
          hideArrows={true}
          
          theme={{
            backgroundColor: '#FFFCF5',
            calendarBackground: '#FFFCF5',
            textSectionTitleColor: '#B0B0B0', // 요일 색상
            selectedDayBackgroundColor: 'transparent',
            todayTextColor: '#333',
            dayTextColor: '#111',
            textDisabledColor: '#E0E0E0',
          }}
          
          // 커스텀 날짜 셀 렌더링
          dayComponent={({ date, state }) => {
            if (!date) return <View style={styles.dayCellEmpty} />;

            const dateStr = date.dateString;
            const photos = photosByDate[dateStr] || [];
            const hasPhoto = photos.length > 0;
            const isSelected = dateStr === selectedDate;
            const dayNum = date.day;

            // 일요일 체크 (date.timestamp는 UTC 기준이라 정확한 요일 계산 필요)
            // new Date(date.dateString).getDay() 사용이 더 안전
            const dayOfWeek = new Date(date.dateString).getDay(); 
            const isSunday = dayOfWeek === 0;
            const isDisabled = state === 'disabled';

            return (
              <Pressable 
                style={[
                  styles.dayCellContainer,
                  // 선택된 날짜 테두리 (사진 없을 때만)
                  isSelected && !hasPhoto && styles.dayCellSelectedBorder, 
                ]}
                onPress={() => onDayPress(date)}
                disabled={isDisabled}
              >
                {hasPhoto ? (
                  // 사진이 있으면 썸네일 표시
                  <View style={styles.photoCell}>
                    <Image source={{ uri: photos[0].url }} style={styles.photoCellImage} resizeMode="cover" />
                    {/* 날짜 숫자를 사진 위에 오버레이 */}
                    <View style={styles.photoDateOverlay}>
                      <AppText style={styles.photoDateText}>{dayNum}</AppText>
                    </View>
                  </View>
                ) : (
                  // 사진 없으면 숫자만 표시
                  <AppText type='pretendard-r'
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
          }}
        />
      </View>

      {/* 4. 선택된 날짜의 사진 리스트 (하단) */}
      <View style={styles.listContainer}>
        {/* 리스트 헤더 (프로필 + 날짜) */}
        {selectedPhotos.length > 0 && (
          <View style={styles.listProfileHeader}>
            <View style={styles.avatar}>
               {/* 썸네일 대신 기본 이미지나 첫번째 사진 */}
               <Image source={{ uri: selectedPhotos[0].url }} style={styles.avatarImage} />
            </View>
            <View>
              <AppText style={styles.profileName}>애인</AppText>
              <AppText style={styles.profileDate}>📅 {selectedDate.replace(/-/g, '. ')}.</AppText>
            </View>
          </View>
        )}

        {selectedPhotos.length === 0 ? (
          <View style={styles.emptyBox}>
            <AppText style={styles.emptyText}>이 날의 미션 기록이 없어요.</AppText>
          </View>
        ) : (
          <FlatList
            data={selectedPhotos}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <View style={styles.largePhotoCard}>
                <Image source={{ uri: item.url }} style={styles.largePhoto} resizeMode="cover" />
                {item.missionTitle && (
                  <View style={styles.largeMissionBadge}>
                    <AppText style={styles.largeMissionText}>
                      {item.missionTitle}
                    </AppText>
                  </View>
                )}
              </View>
            )}
            contentContainerStyle={{ paddingBottom: 40 }}
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
    paddingTop: 60, // SafeArea 고려
    paddingBottom: 10,
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
    fontSize: 18,
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

  // 달 변경 네비게이션 (< 2025년 10월 >)
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 10,
    marginTop: 10,
  },
  monthNavBtn: {
    padding: 4,
  },
  monthTitle: {
    fontSize: 14,
    color: '#444444',
    marginHorizontal: 4,
  },

  CalendarContainer:{
    marginHorizontal: 10,
  },

  // 캘린더 날짜 셀
  dayCellEmpty: {
    flex:  0,
  },
  dayCellContainer: {
    width: 44,
    height: 56, // 세로로 긴 직사각형 비율
    alignItems: 'center',
    justifyContent: 'flex-start', // 위쪽 정렬
    marginVertical: 0,
  },
  dayCellSelectedBorder: {
    borderWidth: 2,
    borderColor: '#6198FF',
    borderRadius: 8,
  },
  dayText: {
    fontSize: 12,
    color: '#111',
    marginTop: 4,
  },
  dayTextDisabled: {
    color: '#D1D1D6',
  },
  dayTextSunday: {
    color: '#FF3B30',
  },
  dayTextSelected: {
    color: '#3279FF',
    fontWeight: '700',
  },

  // 사진 셀 스타일
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
    opacity: 0.9,
  },
  photoDateOverlay: {
    position: 'absolute',
    top: 4,
    left: 0,
    width: '100%',
    alignItems: 'center',
  },
  photoDateText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111', // 사진 위 날짜 색상 (검정)
    // textShadowColor: 'rgba(255, 255, 255, 0.8)',
    // textShadowOffset: { width: 0, height: 0 },
    // textShadowRadius: 4,
  },

  // 하단 리스트 영역
  listContainer: {
    flex: 1,
    // backgroundColor: '#FFF', // 배경색 투명하게 해서 위쪽 배경과 이어지게 하거나 흰색
    paddingHorizontal: 20,
    marginTop: 10,
  },
  listProfileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 10,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#DDD',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  profileName: {
    fontSize: 14,
    color: '#FFF', 
  },
  profileDate: {
    fontSize: 12,
    color: '#666',
  },

  // 큰 사진 카드
  largePhotoCard: {
    width: '100%',
    height: 400, // 세로로 긴 카드
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 20,
    backgroundColor: '#F0F0F0',
  },
  largePhoto: {
    width: '100%',
    height: '100%',
  },
  largeMissionBadge: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    alignItems: 'center',
  },
  largeMissionText: {
    color: '#FFF',
    fontSize: 14,
    textAlign: 'center',
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
});