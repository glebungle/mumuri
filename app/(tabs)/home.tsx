import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { differenceInCalendarDays, parseISO } from 'date-fns';
import { LinearGradient } from 'expo-linear-gradient'; // ✅ 그라데이션 추가
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
import AppText from '../../components/AppText';

const BASE_URL = 'https://mumuri.shop';
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

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
  
  // 배경 이미지
  const bgImage = null; 

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      const fetchData = async () => {
        try {
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
      {/* 1. 배경 이미지 & 그라데이션 (Position Absolute로 뒤에 깔림) */}
      <View style={styles.backgroundLayer}>
        <ImageBackground
          source={bgImage ? { uri: bgImage } : require('../../assets/images/default_bg.jpeg')} 
          style={styles.backgroundImage}
          resizeMode="cover"
        >
          {/* 이미지 위 어두운 필터 */}
          <View style={styles.dimOverlay} />
          
          {/* ✅ 하단 그라데이션: 이미지가 끝나면서 배경색과 자연스럽게 연결 */}
          <LinearGradient
            colors={['transparent', '#FFFCF5']}
            style={styles.gradientOverlay}
            locations={[0.2, 1]} // 투명에서 시작해 맨 끝에서 배경색이 됨
          />
        </ImageBackground>
      </View>

      {/* 2. 메인 컨텐츠 (z-index 상위) */}
      <View style={styles.contentContainer}>
        
        {/* 상단 영역 (헤더 + 정보) */}
        <View>
          <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
            <View style={styles.tabSwitch}>
              <Pressable style={styles.activeTab}>
                <AppText style={styles.activeTabText}>   홈   </AppText>
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

          <View style={styles.infoSection}>
            <View style={styles.dDayBadge}>
              <Ionicons name="heart-outline" size={16} color="#FFF" style={{ marginRight: 4 }} />
              <AppText type='bold' style={styles.dDayText}>{coupleId ? `${dDay}일째` : '연결 대기중'}</AppText>
            </View>
            <View style={styles.nameDateContainer}>
              <AppText style={styles.userName}>{userName}</AppText>
              <AppText style={styles.dateText}>
                {coupleId && startDate ? `📅 ${startDate.replace(/-/g, '. ')}.` : '📅 시작일을 설정해주세요'}
              </AppText>
            </View>
          </View>
        </View>

        {/* 하단 대시보드 (카드 영역) */}
        <View style={[styles.dashboard, { paddingBottom: insets.bottom + 20 }]}>
          
          {/* 카메라 (오늘의 미션) 카드 */}
          <Pressable 
            style={({ pressed }) => [
              styles.missionCard, 
              pressed && styles.pressedCard,
              // ✅ 3. 디자인상 비활성화 처리 (반투명 + 회색조)
              !coupleId && styles.disabledMissionCard 
            ]} 
            onPress={handlePressCamera}
          >
            <View style={styles.missionHeader}>
              <AppText type='semibold' style={styles.cardTitle}>오늘의 미션</AppText>
            </View>
            <AppText 
              type='regular' style={[
                styles.missionContent, 
                !coupleId && { color: '#FF6B6B', fontSize: 13 }
              ]} 
              numberOfLines={2}
            >
              {coupleId 
                ? (todayMissionTitle || '오늘의 미션을 불러오는 중...') 
                : '커플을 연결해주세요.'}
            </AppText>
            <View style={styles.cameraLabelBox}>
              <AppText style={styles.cameraLabel}>카메라</AppText>
            </View>
          </Pressable>

          {/* 하단 2분할 버튼 (캘린더 / 채팅) */}
          <View style={styles.bottomRow}>
            {/* 캘린더 버튼 */}
            <Pressable 
              style={({ pressed }) => [
                styles.squareCard, 
                styles.calendarCard, 
                pressed && styles.pressedCard,
                !coupleId && styles.disabledCard // 비활성화 스타일
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
                !coupleId && styles.disabledCard // 비활성화 스타일
              ]}
              onPress={handlePressChat}
            >
              <AppText style={styles.cardLabelBlack}>채팅</AppText>
              <Ionicons name="chatbubble-ellipses" size={32} color="#4A4A4A" style={styles.cardIcon} />
            </Pressable>
          </View>

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
    backgroundColor: '#FFFCF5', // 메인 배경색
  },
  
  // 1. 배경 레이어 (화면 뒤에 고정)
  backgroundLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '75%', // 화면의 75%까지만 이미지가 옴
    zIndex: 0,
  },
  backgroundImage: {
    width: '100%',
    height: '100%',
  },
  dimOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.2)', // 전체적으로 살짝 어둡게
  },
  gradientOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '30%', // 이미지 하단 30% 영역에 그라데이션 적용
  },

  // 2. 컨텐츠 컨테이너 (위로 쌓임)
  contentContainer: {
    flex: 1,
    zIndex: 1,
    justifyContent: 'space-between', // 상단 정보 <-> 하단 카드 분리
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
    fontSize: 14,
    fontWeight: '700',
  },
  activeIndicator: {
    width: '100%',
    height: 2,
    backgroundColor: '#FFF',
    marginTop: 4,
  },
  inactiveTab: {
    paddingBottom: 10,
  },
  inactiveTabText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
  },
  profileButton: {
    padding: 4,
  },

  // 상단 정보
  infoSection: {
    paddingHorizontal: 24,
    marginTop: 14,
  },
  dDayBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  dDayText: {
    color: '#FFF',
    fontSize: 13,
  },
  nameDateContainer: {
    gap: 2,
  },
  userName: {
    color: '#FFF',
    fontSize: 26,
    fontWeight: '800',
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  dateText: {
    color: '#EEE',
    fontSize: 13,
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
  // ✅ 3. 디자인상 비활성화 스타일
  disabledCard: {
    opacity: 0.5, // 전체적으로 흐리게
    backgroundColor: '#DDD', // 배경색을 회색으로 덮음 (선택 사항)
  },
  disabledMissionCard: {
    opacity: 0.7,
    backgroundColor: '#EEE',
  },

  // 카메라(미션) 카드
  missionCard: {
    backgroundColor: 'rgba(255,255,255,0.92)', // 거의 불투명
    borderRadius: 24,
    padding: 20,
    minHeight: 140,
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
  },
  missionHeader: {
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 14,
    color: '#333',
  },
  missionContent: {
    fontSize: 14,
    color: '#444',
    marginBottom: 30, // 텍스트와 라벨 사이 간격 확보
  },
  cameraLabelBox: {
    position: 'absolute',
    bottom: 20,
    left: 20,
  },
  cameraLabel: {
    fontSize: 22,
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
    borderRadius: 24,
    padding: 20,
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  
  // ✅ 2. 캘린더가 채팅보다 더 넓게 (flex 비율 조정)
  calendarCard: {
    flex: 1.3, // 채팅보다 1.3배 넓음
    backgroundColor: '#3E3C3C',
  },
  chatCard: {
    flex: 1,
    backgroundColor: '#EAE8E3',
  },

  cardLabelWhite: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFF',
  },
  cardLabelBlack: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111',
  },
  cardIcon: {
    alignSelf: 'flex-end',
  },
});