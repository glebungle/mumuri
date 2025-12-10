import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { differenceInCalendarDays, parseISO } from 'date-fns';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  ImageBackground,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppText from '../../components/AppText'; // 사용중인 커스텀 텍스트 컴포넌트 경로 확인

const BASE_URL = 'https://mumuri.shop';
const { width: SCREEN_WIDTH } = Dimensions.get('window');

// API 호출 유틸
async function authedFetch(path: string, method: string = 'GET') {
  const token = await AsyncStorage.getItem('token');
  const headers: any = {
    Accept: 'application/json',
    'ngrok-skip-browser-warning': 'true',
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  
  const res = await fetch(`${BASE_URL}${path}`, { method, headers });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json();
}

// 유저 데이터 정규화
function normalizeUser(raw: any) {
  if (!raw) return { name: '', coupleId: null, startDate: null };
  return {
    name: raw.name || raw.nickname || '알 수 없음',
    coupleId: raw.coupleId ?? raw.couple_id ?? null,
    // 백엔드에서 startDate 필드가 없을 경우를 대비
    startDate: raw.startDate ?? raw.start_date ?? raw.anniversary ?? null, 
  };
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [coupleId, setCoupleId] = useState<number | null>(null);
  const [userName, setUserName] = useState('');
  const [startDate, setStartDate] = useState<string | null>(null);
  const [todayMissionTitle, setTodayMissionTitle] = useState<string | null>(null);
  
  // 배경 이미지 (필요시 서버에서 받아오거나 로컬 이미지 사용)
  const bgImage = null; 

  // 화면이 포커스 될 때마다 데이터 갱신 (커플 연결 직후 반영 위해)
  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      const fetchData = async () => {
        try {
          // 1. 유저 정보 & 커플 정보 가져오기
          const userData = await authedFetch('/user/getuser');
          const normalized = normalizeUser(userData);
          
          if (isActive) {
            setCoupleId(normalized.coupleId);
            setUserName(normalized.name || '사용자');
            setStartDate(normalized.startDate);
            
            if (normalized.coupleId) {
              await AsyncStorage.setItem('coupleId', String(normalized.coupleId));
            }
          }

          // 2. 커플 연결된 경우에만 오늘의 미션 가져오기
          if (normalized.coupleId) {
            try {
              const missions = await authedFetch('/api/couples/missions/today');
              if (Array.isArray(missions) && missions.length > 0) {
                if (isActive) setTodayMissionTitle(missions[0].title);
              }
            } catch (e) {
              console.warn('[Home] 미션 로드 실패', e);
            }
          }

        } catch (e) {
          console.warn('[Home] 데이터 로드 실패', e);
        } finally {
          if (isActive) setLoading(false);
        }
      };

      fetchData();

      return () => {
        isActive = false;
      };
    }, [])
  );

  // D-Day 계산
  const dDay = startDate 
    ? differenceInCalendarDays(new Date(), parseISO(startDate)) + 1 
    : 1;

  // --- 네비게이션 핸들러 ---
  const handlePressCamera = () => {
    if (!coupleId) {
      Alert.alert('알림', '커플 연결 후 미션을 수행할 수 있어요!');
      return;
    }
    router.push('/camera');
  };

  const handlePressCalendar = () => {
    if (!coupleId) {
      Alert.alert('알림', '커플 연결 후 캘린더를 사용할 수 있어요!');
      return;
    }
    router.push('/calendar');
  };

  const handlePressChat = () => {
    if (!coupleId) {
      Alert.alert('알림', '커플 연결 후 채팅을 할 수 있어요!');
      return;
    }
    router.push('/chat');
  };

  const handlePressGalleryTab = () => {
    // 탭 간 이동
    router.push('/(tabs)/gallery');
  };

  const handlePressMyPage = () => {
    router.push('/mypage');
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#333" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* 배경 이미지 영역 */}
      <View style={styles.backgroundContainer}>
        <ImageBackground
          // assets 폴더에 이미지가 없다면 uri를 사용하거나 이미지를 추가해야 함
          source={bgImage ? { uri: bgImage } : require('../../assets/images/default_bg.jpeg')} 
          style={styles.backgroundImage}
          resizeMode="cover"
        >
          {/* 어두운 오버레이 (텍스트 가독성) */}
          <View style={styles.dimOverlay} />

          {/* 상단 헤더 */}
          <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
            <View style={styles.tabSwitch}>
              <Pressable style={styles.activeTab}>
                <AppText style={styles.activeTabText}>홈</AppText>
                <View style={styles.activeIndicator} />
              </Pressable>
              <Pressable onPress={handlePressGalleryTab} style={styles.inactiveTab}>
                <AppText style={styles.inactiveTabText}>갤러리</AppText>
              </Pressable>
            </View>
            
            <Pressable onPress={handlePressMyPage} style={styles.profileButton}>
              <Ionicons name="person-circle-outline" size={32} color="#FFF" />
            </Pressable>
          </View>

          {/* 메인 정보 (D-Day, 이름) */}
          <View style={styles.infoSection}>
            <View style={styles.dDayBadge}>
              <Ionicons name="heart" size={16} color="#FFF" style={{ marginRight: 4 }} />
              <AppText style={styles.dDayText}>{coupleId ? `${dDay}일째` : '연결 대기중'}</AppText>
            </View>
            
            <View style={styles.nameDateContainer}>
              <AppText style={styles.userName}>{userName}</AppText>
              <AppText style={styles.dateText}>
                {coupleId && startDate ? `📅 ${startDate.replace(/-/g, '. ')}.` : '📅 시작일을 설정해주세요'}
              </AppText>
            </View>
          </View>
        </ImageBackground>
      </View>

      {/* 하단 대시보드 (카드 영역) */}
      <View style={[styles.dashboard, { paddingBottom: insets.bottom + 20 }]}>
        
        {/* 1. 카메라 (오늘의 미션) 카드 */}
        <Pressable 
          style={({ pressed }) => [styles.missionCard, pressed && styles.pressedCard]} 
          onPress={handlePressCamera}
        >
          <View style={styles.missionHeader}>
            <AppText style={styles.cardTitle}>오늘의 미션</AppText>
          </View>
          <AppText 
            style={[
              styles.missionContent, 
              !coupleId && { color: '#FF6B6B', fontWeight: 'bold' }
            ]} 
            numberOfLines={2}
          >
            {coupleId 
              ? (todayMissionTitle || '오늘의 미션을 불러오는 중...') 
              : '커플을 연결해주세요! (터치하여 연결)'}
          </AppText>
          <View style={styles.cameraLabelBox}>
            <AppText style={styles.cameraLabel}>카메라</AppText>
          </View>
        </Pressable>

        {/* 2. 하단 2분할 버튼 (캘린더 / 채팅) */}
        <View style={styles.bottomRow}>
          {/* 캘린더 버튼 */}
          <Pressable 
            style={({ pressed }) => [
              styles.squareCard, 
              styles.calendarCard, 
              pressed && styles.pressedCard,
              !coupleId && styles.disabledCard
            ]}
            onPress={handlePressCalendar}
          >
            <AppText style={styles.cardLabelWhite}>캘린더</AppText>
            <Ionicons name="calendar" size={32} color="rgba(255,255,255,0.8)" style={styles.cardIcon} />
          </Pressable>

          {/* 채팅 버튼 */}
          <Pressable 
            style={({ pressed }) => [
              styles.squareCard, 
              styles.chatCard, 
              pressed && styles.pressedCard,
              !coupleId && styles.disabledCard
            ]}
            onPress={handlePressChat}
          >
            <AppText style={styles.cardLabelBlack}>채팅</AppText>
            <Ionicons name="chatbubble-ellipses" size={32} color="#4A4A4A" style={styles.cardIcon} />
          </Pressable>
        </View>

      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    flex: 1,
    backgroundColor: '#F2F2F2',
  },
  
  // 배경 이미지 영역
  backgroundContainer: {
    flex: 1,
    position: 'relative',
  },
  backgroundImage: {
    width: '100%',
    height: '100%',
    justifyContent: 'space-between', 
  },
  dimOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.25)', 
  },

  // 헤더
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  tabSwitch: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
  },
  activeTab: {
    borderBottomWidth: 0,
    paddingBottom: 4,
    alignItems: 'center',
  },
  activeTabText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '700',
  },
  activeIndicator: {
    width: '100%',
    height: 2,
    backgroundColor: '#FFF',
    marginTop: 4,
  },
  inactiveTab: {
    paddingBottom: 4,
  },
  inactiveTabText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 18,
    fontWeight: '500',
  },
  profileButton: {
    padding: 4,
  },

  // 상단 정보
  infoSection: {
    paddingHorizontal: 24,
    marginTop: 20,
  },
  dDayBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  dDayText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
  nameDateContainer: {
    gap: 4,
  },
  userName: {
    color: '#FFF',
    fontSize: 24,
    fontWeight: '800',
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  dateText: {
    color: '#EEE',
    fontSize: 14,
    fontWeight: '500',
  },

  // 하단 대시보드
  dashboard: {
    paddingHorizontal: 16,
    gap: 12,
  },

  pressedCard: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  disabledCard: {
    opacity: 0.6,
  },

  // 카메라(미션) 카드
  missionCard: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 24,
    padding: 24,
    minHeight: 140,
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  missionHeader: {
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111',
  },
  missionContent: {
    fontSize: 15,
    color: '#444',
    lineHeight: 22,
    marginTop: 4,
    marginBottom: 20,
  },
  cameraLabelBox: {
    position: 'absolute',
    bottom: 24,
    left: 24,
  },
  cameraLabel: {
    fontSize: 24,
    fontWeight: '800',
    color: '#000',
  },

  // 하단 버튼들
  bottomRow: {
    flexDirection: 'row',
    gap: 12,
    height: 120,
  },
  squareCard: {
    flex: 1,
    borderRadius: 24,
    padding: 20,
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  calendarCard: {
    backgroundColor: '#3E3C3C',
  },
  cardLabelWhite: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
  },
  chatCard: {
    backgroundColor: '#EAE8E3',
  },
  cardLabelBlack: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111',
  },
  cardIcon: {
    alignSelf: 'flex-end',
  },
});