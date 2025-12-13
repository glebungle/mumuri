import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Image,
  ImageBackground,
  Modal,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppText from '../../components/AppText';
import { useUser } from '../context/UserContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const heartImg = require('../../assets/images/Heart.png');

// --- 모달 컴포넌트 ---
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
          <AppText type="medium" style={styles.modalMessage}>{message}</AppText>
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
  
  // ✅ Context에서 필요한 데이터 가져오기
  const { userData, todayMissions, refreshUserData } = useUser();
  
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalMessage, setModalMessage] = useState('');

  // ✅ [수정] 스토리지 대신 Context의 coupleId로 커플 여부 판단
  // userData가 있고, coupleId가 0보다 크면 커플임
  const isCoupled = !!(userData && userData.coupleId && userData.coupleId > 0);

  // ✅ [중요] 좀비 데이터 청소기 (Context 기준 솔로면 로컬 스토리지도 정리)
  useEffect(() => {
    const cleanUpStaleData = async () => {
      if (userData) {
        // 서버에서는 솔로라고 하는데(coupleId가 0), 로컬엔 값이 남아있다면 삭제
        if (!userData.coupleId || userData.coupleId === 0) {
          const zombieId = await AsyncStorage.getItem('coupleId');
          if (zombieId) {
            console.log(`🧹 [Cleanup] 유효하지 않은 커플ID(${zombieId}) 정리`);
            await AsyncStorage.multiRemove(['coupleId', 'roomId']);
          }
        }
      }
    };
    cleanUpStaleData();
  }, [userData]);

  // 배경 이미지 (필요시 설정)
  const bgImage = null;

  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      
      const load = async () => {
        try {
          console.log('🔄 [HOME] 데이터 새로고침 시작...');
          await refreshUserData(); // API 호출 (Home + Missions)
        } catch (error) {
          console.error('❌ [HOME] 데이터 로드 실패:', error);
        } finally {
          if (isActive) setLoading(false);
        }
      };
      
      load();
      return () => { isActive = false; };
    }, [])
  );
  
  const userName = userData?.name || '사용자';
  const startDate = userData?.anniversary || null;
  const dDay = userData?.date ?? 1;

  // ✅ 오늘의 미션 제목 가져오기
  const todayMissionTitle = todayMissions && todayMissions.length > 0 
    ? todayMissions[0].title 
    : null;

  const showModal = (msg: string) => {
    setModalMessage(msg);
    setModalVisible(true);
  };

  // --- 네비게이션 ---
  const handlePressCamera = () => {
    if (!isCoupled) {
      showModal('커플 연결 후 미션을 수행할 수 있어요!');
      return;
    }
    router.push('/camera');
  };

  const handlePressCalendar = () => {
    if (!isCoupled) {
      showModal('커플 연결 후 캘린더를 사용할 수 있어요!');
      return;
    }
    router.push('/calendar');
  };

  const handlePressChat = () => {
    if (!isCoupled) {
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
        {/* 상단 헤더 영역 */}
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
            <Image source={heartImg} style={[styles.heartImage]} />
            <AppText type="bold" style={styles.dDayText}>
              {isCoupled ? `${dDay-1}일째` : '연결 대기중'}
            </AppText>
          </View>
        </View>

        {/* 사용자 정보 영역 */}
        <View style={styles.infoSection}>
          <View style={styles.nameDateContainer}>
            <AppText style={styles.userName}>{userName}</AppText>
            <AppText style={styles.dateText}>
              {startDate
                ? `📅 ${startDate.replace(/-/g, '. ')}.`
                : '📅 시작일을 설정해주세요'}
            </AppText>
          </View>
        </View>

        {/* 대시보드 카드 영역 */}
        <View style={[styles.dashboard, { paddingBottom: insets.bottom + 20 }]}>
          <Pressable
            style={({ pressed }) => [
              styles.missionCard,
              pressed && styles.pressedCard,
              !isCoupled && styles.disabledMissionCard,
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
                !isCoupled && { color: '#FF6B6B', fontSize: 13 },
              ]}
              numberOfLines={2}
            >
              {isCoupled
                ? todayMissionTitle || '새로운 미션 준비 중...'
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
                !isCoupled && styles.disabledCard,
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
                !isCoupled && styles.disabledCard,
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
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: SCREEN_WIDTH * 0.8,
    backgroundColor: '#FFFCF5',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
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
  heartImage: {
    width: 20,
    height: 20,
    tintColor: '#ffffffff',
    margin: 5,
  },
});