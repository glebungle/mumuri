// app/(tabs)/home.tsx
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  ImageBackground,
  Modal,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppText from '../../components/AppText';

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
    coupleId: raw.coupleId ?? raw.couple_id ?? raw.coupleID ?? null,
    startDate: raw.startDate ?? raw.start_date ?? raw.anniversary ?? null,
  };
}

// 모달 컴포넌트
const AlertModal = ({
  visible,
  message,
  onClose,
}: {
  visible: boolean;
  message: string;
  onClose: () => void;
}) => {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalIconBox}>
            <Ionicons name="information-circle" size={32} color="#6198FF" />
          </View>
          <AppText style={styles.modalTitle}>알림</AppText>
          <AppText type='medium' style={styles.modalMessage}>{message}</AppText>
          <Pressable style={styles.modalButton} onPress={onClose}>
            <AppText style={styles.modalButtonText}>확인</AppText>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
};

export default function HomeScreen() {
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [coupleId, setCoupleId] = useState<number | null>(null);
  const [userName, setUserName] = useState('');
  const [startDate, setStartDate] = useState<string | null>(null);
  const [todayMissionTitle, setTodayMissionTitle] = useState<string | null>(null);

  const [dDay, setDDay] = useState<number>(1);

  const [modalVisible, setModalVisible] = useState(false);
  const [modalMessage, setModalMessage] = useState('');

  // 배경 이미지
  const bgImage = null;

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      const fetchData = async () => {
        try {
          // 1. 로컬 스토리지 확인
          const storedCid = await AsyncStorage.getItem('coupleId');
          const storedCidNum = storedCid ? Number(storedCid) : null;

          // 2. 유저 정보 API 호출
          let userData: any = null;
          try {
            userData = await authedFetch('/user/getuser');
          } catch (e) {
            console.warn('[Home] 유저 정보 로드 실패, 로컬 값 사용');
          }

          const normalized = normalizeUser(userData);

          if (isActive) {
            // 서버 응답에 coupleId가 있으면 그것을 신뢰
            const hasServerCoupleId =
              normalized.coupleId !== null && normalized.coupleId !== undefined;

            let finalCoupleId: number | null = null;

            if (hasServerCoupleId) {
              finalCoupleId = Number(normalized.coupleId);
              if (!Number.isNaN(finalCoupleId)) {
                await AsyncStorage.setItem('coupleId', String(finalCoupleId));
              } else {
                finalCoupleId = null;
                await AsyncStorage.removeItem('coupleId');
              }
            } else {
              // 서버가 "커플 없음"이라고 말한 경우: 로컬 캐시도 제거
              await AsyncStorage.removeItem('coupleId');

              // 서버 호출 자체가 실패했을 때만 이전 캐시를 fallback으로 사용
              if (!userData && storedCidNum) {
                finalCoupleId = storedCidNum;
              } else {
                finalCoupleId = null;
              }
            }

            setCoupleId(finalCoupleId);
            setUserName(normalized.name || '사용자');
            setStartDate(normalized.startDate);

            if (finalCoupleId) {
              // 3. 오늘의 미션 가져오기
              try {
                const missions = await authedFetch('/api/couples/missions/today');
                if (Array.isArray(missions) && missions.length > 0) {
                  if (isActive) setTodayMissionTitle(missions[0].title);
                }
              } catch (e) {
                console.warn('[Home] 미션 로드 실패', e);
              }

              // 4. D-Day 동기화
              try {
                const mainData = await authedFetch('/user/main');
                if (mainData && typeof mainData.dday === 'number') {
                  if (isActive) setDDay(mainData.dday);
                }
              } catch (e) {
                console.warn('[Home] 메인 정보(D-Day) 로드 실패', e);
              }
            } else {
              // 커플이 아예 없으면 D-Day는 의미 없으니 초기화 정도만
              setDDay(1);
              setTodayMissionTitle(null);
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

  const showModal = (msg: string) => {
    setModalMessage(msg);
    setModalVisible(true);
  };

  // --- 네비게이션 핸들러 ---
  const handlePressCamera = () => {
    if (!coupleId) {
      showModal('커플 연결 후 미션을 수행할 수 있어요!'); 
      return;
    }
    router.push('/camera');
  };

  const handlePressCalendar = () => {
    if (!coupleId) {
      showModal('커플 연결 후 캘린더를 사용할 수 있어요!');
      return;
    }
    router.push('/calendar');
  };

  const handlePressChat = () => {
    if (!coupleId) {
      showModal('커플 연결 후 채팅을 할 수 있어요!'); 
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
      <AlertModal
        visible={modalVisible}
        message={modalMessage}
        onClose={() => setModalVisible(false)}
      />

      <View style={styles.backgroundLayer}>
        <ImageBackground
          source={
            bgImage
              ? { uri: bgImage }
              : require('../../assets/images/default_bg.jpeg')
          }
          style={styles.backgroundImage}
          resizeMode="cover"
        >
          <View style={styles.dimOverlay} />

          <LinearGradient
            colors={['transparent', '#FFFCF5']}
            style={styles.gradientOverlay}
            locations={[0.2, 1]}
          />
        </ImageBackground>
      </View>

      <View style={styles.contentContainer}>
        <View style={styles.headerContainer}>
          <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
            <View style={styles.tabSwitch}>
              <Pressable style={styles.activeTab}>
                <AppText style={styles.activeTabText}>   홈   </AppText>
                <View style={styles.activeIndicator} />
              </Pressable>
              <Pressable
                onPress={handlePressGalleryTab}
                style={styles.inactiveTab}
              >
                <AppText type="medium" style={styles.inactiveTabText}>
                  갤러리
                </AppText>
              </Pressable>
            </View>

            <Pressable
              onPress={handlePressMyPage}
              style={styles.profileButton}
            >
              <Ionicons
                name="person-circle-outline"
                size={32}
                color="#FFF"
              />
            </Pressable>
          </View>
          <View style={styles.Divider} />
          <View style={styles.dDayBadge}>
            <Ionicons
              name="heart-outline"
              size={16}
              color="#FFF"
              style={{ marginRight: 4 }}
            />
            <AppText type="bold" style={styles.dDayText}>
              {coupleId ? `${dDay}일째` : '연결 대기중'}
            </AppText>
          </View>
        </View>
        <View style={styles.infoSection}>
          <View style={styles.nameDateContainer}>
            <AppText style={styles.userName}>{userName}</AppText>
            <AppText style={styles.dateText}>
              {coupleId && startDate
                ? `📅 ${startDate.replace(/-/g, '. ')}.`
                : '📅 시작일을 설정해주세요'}
            </AppText>
          </View>
        </View>

        <View style={[styles.dashboard, { paddingBottom: insets.bottom + 20 }]}>
          <Pressable
            style={({ pressed }) => [
              styles.missionCard,
              pressed && styles.pressedCard,
              !coupleId && styles.disabledMissionCard,
            ]}
            onPress={handlePressCamera}
          >
            <View style={styles.missionHeader}>
              <AppText type="semibold" style={styles.cardTitle}>
                오늘의 미션
              </AppText>
            </View>
            <AppText
              type="regular"
              style={[
                styles.missionContent,
                !coupleId && { color: '#FF6B6B', fontSize: 13 },
              ]}
              numberOfLines={2}
            >
              {coupleId
                ? todayMissionTitle || '오늘의 미션을 불러오는 중...'
                : '커플을 연결해주세요.'}
            </AppText>
            <View style={styles.cameraLabelBox}>
              <AppText style={styles.cameraLabel}>카메라</AppText>
            </View>
          </Pressable>

          <View style={styles.bottomRow}>
            <Pressable
              style={({ pressed }) => [
                styles.squareCard,
                styles.calendarCard,
                pressed && styles.pressedCard,
                !coupleId && styles.disabledCard,
              ]}
              onPress={handlePressCalendar}
            >
              <AppText style={styles.cardLabelWhite}>캘린더</AppText>
              <Ionicons
                name="calendar"
                size={32}
                color="rgba(255,255,255,0.8)"
                style={styles.cardIcon}
              />
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.squareCard,
                styles.chatCard,
                pressed && styles.pressedCard,
                !coupleId && styles.disabledCard,
              ]}
              onPress={handlePressChat}
            >
              <AppText style={styles.cardLabelBlack}>채팅</AppText>
              <Ionicons
                name="chatbubble-ellipses"
                size={32}
                color="#4A4A4A"
                style={styles.cardIcon}
              />
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
    backgroundColor: '#FFFCF5',
  },

  // ... (기존 배경 관련 스타일) ...
  backgroundLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '60%',
    zIndex: 0,
  },
  backgroundImage: {
    width: '100%',
    height: '100%',
  },
  dimOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  gradientOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '30%',
  },

  contentContainer: {
    flex: 1,
    zIndex: 1,
    justifyContent: 'space-between',
  },

  headerContainer: {
    paddingTop: '7%',
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
    color: '#EAEAEA',
    fontSize: 14,
  },
  profileButton: {
    padding: 4,
  },

  infoSection: {
    paddingHorizontal: 24,
    marginTop: 14,
  },
  Divider: {
    width: '100%',
    height: 0.7,
    backgroundColor: '#E2E2E2',
  },
  dDayBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: 20,
    marginTop: 14,
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
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  dateText: {
    color: '#EEE',
    fontSize: 13,
    fontWeight: '500',
  },

  dashboard: {
    paddingHorizontal: 16,
    gap: 12,
  },

  pressedCard: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  disabledCard: {
    opacity: 0.5,
    backgroundColor: '#DDD',
  },
  disabledMissionCard: {
    opacity: 0.7,
    backgroundColor: '#EEE',
    color: '#353535ff',
  },

  missionCard: {
    backgroundColor: 'rgba(247,245,241,0.8)',
    borderRadius: 12,
    padding: 20,
    minHeight: 220,
    justifyContent: 'space-between',
  },
  missionHeader: {},
  cardTitle: {
    fontSize: 13,
    color: '#000',
  },
  missionContent: {
    fontSize: 13,
    color: '#444',
    marginBottom: 150,
  },
  cameraLabelBox: {
    position: 'absolute',
    bottom: 20,
    left: 20,
  },
  cameraLabel: {
    fontSize: 22,
    color: '#000',
  },

  bottomRow: {
    flexDirection: 'row',
    gap: 12,
    height: 160,
  },
  squareCard: {
    borderRadius: 12,
    padding: 20,
    justifyContent: 'space-between',
  },

  calendarCard: {
    flex: 1.7,
    backgroundColor: '#3E3C3C',
  },
  chatCard: {
    flex: 1,
    backgroundColor: '#EAE8E3',
  },

  cardLabelWhite: {
    fontSize: 17,
    color: '#FFF',
  },
  cardLabelBlack: {
    fontSize: 17,
    color: '#111',
  },
  cardIcon: {
    alignSelf: 'flex-end',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)', // 배경 
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: SCREEN_WIDTH * 0.8,
    backgroundColor: '#FFFCF5', 
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    // 그림자
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  modalIconBox: {
    marginBottom: 0,
  },
  modalTitle: {
    fontSize: 18,
    color: '#666',
    marginBottom: 8,
  },
  modalMessage: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 20,
  },
  modalButton: {
    backgroundColor: '#6198FF', 
    paddingVertical: 12,
    paddingHorizontal: 40,
    borderRadius: 12,
  },
  modalButtonText: {
    color: '#FFF',
    fontSize: 13,
  },
});