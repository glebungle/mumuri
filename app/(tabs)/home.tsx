import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Image,
  ImageBackground,
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppText from '../../components/AppText';
import GalleryView from '../components/GalleryView';
import { useUser } from '../context/UserContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const heartImg = require('../../assets/images/Heart.png');

// 🟢 [알림 모달]
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
  const { userData, todayMissions, refreshUserData } = useUser();
  
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalMessage, setModalMessage] = useState('');

  // 🟢 탭 상태 (0: 홈, 1: 갤러리)
  const [activeTab, setActiveTab] = useState<0 | 1>(0);

  // 🟢 애니메이션 값
  const tabAnim = useRef(new Animated.Value(0)).current;  // 헤더 바 이동용
  const fadeAnim = useRef(new Animated.Value(1)).current; // 컨텐츠 투명도용

  // 데이터 정리
  const isCoupled = !!(userData && userData.coupleId && userData.coupleId > 0);
  const userName = userData?.name || '사용자';
  const startDate = userData?.anniversary || null;
  const dDay = userData?.date ?? 1;
  const todayMissionTitle = todayMissions && todayMissions.length > 0 ? todayMissions[0].title : null;

  // 좀비 데이터 정리
  useEffect(() => {
    const cleanUpStaleData = async () => {
      if (userData && (!userData.coupleId || userData.coupleId === 0)) {
        const zombieId = await AsyncStorage.getItem('coupleId');
        if (zombieId) await AsyncStorage.multiRemove(['coupleId', 'roomId']);
      }
    };
    cleanUpStaleData();
  }, [userData]);

  // 포커스 시 데이터 리로드
  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      const load = async () => {
        try { await refreshUserData(); } 
        catch (error) { console.error('Data Load Fail:', error); } 
        finally { if (isActive) setLoading(false); }
      };
      load();
      return () => { isActive = false; };
    }, [])
  );

  const showModal = (msg: string) => {
    setModalMessage(msg);
    setModalVisible(true);
  };

  // 🟢 [탭 전환 핸들러] 페이드 효과만 사용
  const switchTab = (targetIndex: 0 | 1) => {
    if (activeTab === targetIndex) return;

    // 헤더 인디케이터 이동
    Animated.timing(tabAnim, {
      toValue: targetIndex,
      duration: 300,
      useNativeDriver: false, 
    }).start();

    // 컨텐츠 페이드 아웃 -> 탭 변경 -> 페이드 인
    Animated.timing(fadeAnim, {
      toValue: 0, 
      duration: 150,
      useNativeDriver: true,
    }).start(() => {
      setActiveTab(targetIndex);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    });
  };

  // 🟢 [핵심 수정] PanResponder 강제 가로채기 적용
  const panResponder = useRef(
    PanResponder.create({
      // 터치 시작 시점에는 관여하지 않음 (버튼 클릭 보장)
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => false,

      // 🟢 [중요] 터치가 움직일 때 부모가 이벤트를 '가로챌지' 결정 (Capture)
      // GalleryView의 스크롤보다 먼저 판단하기 위해 Capture를 사용합니다.
      onMoveShouldSetPanResponderCapture: (_, gestureState) => {
        const { dx, dy } = gestureState;
        
        // 1. 가로 이동이 10px 이상이어야 함 (너무 민감하면 클릭이 안됨)
        // 2. 가로 이동(dx)이 세로 이동(dy)보다 확실히 커야 함 (대각선 방지)
        return Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.2;
      },

      // 위 조건이 true가 되면 이 함수가 실행되어 제스처 추적 시작
      onPanResponderGrant: () => {},

      // 터치가 끝났을 때 스와이프 방향 판단
      onPanResponderRelease: (_, gestureState) => {
        const { dx } = gestureState;
        
        // 왼쪽으로 강하게 스와이프 (-30px 이상)
        if (dx < -30) {
          if (activeTab === 0) switchTab(1);
        }
        // 오른쪽으로 강하게 스와이프 (+30px 이상)
        else if (dx > 30) {
          if (activeTab === 1) switchTab(0);
        }
      },
      
      // 혹시 제스처가 취소되었을 때 처리
      onPanResponderTerminate: () => {},
    })
  ).current;

  // 네비게이션 핸들러
  const handlePressCamera = () => { if (!isCoupled) { showModal('커플 연결 후 미션을 수행할 수 있어요!'); return; } router.push('/camera'); };
  const handlePressCalendar = () => { if (!isCoupled) { showModal('커플 연결 후 캘린더를 사용할 수 있어요!'); return; } router.push('/calendar'); };
  const handlePressChat = () => { if (!isCoupled) { showModal('커플 연결 후 채팅을 할 수 있어요!'); return; } router.push('/chat'); };

  if (loading) return <View style={styles.loadingContainer}><ActivityIndicator size="large" color="#333" /></View>;

  // 🟢 [헤더 애니메이션 보간]
  const indicatorTranslateX = tabAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 51], 
  });

  const indicatorWidth = tabAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [36, 48],
  });

  const headerTintColor = tabAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['#FFF', '#000'] 
  });
  
  const homeTextColor = tabAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(255,255,255,1)', 'rgba(0,0,0,0.3)'] 
  });

  const galleryTextColor = tabAnim.interpolate({
     inputRange: [0, 1],
     outputRange: ['rgba(255,255,255,0.5)', 'rgba(0,0,0,1)']
  });

  const dDayOpacity = tabAnim.interpolate({
    inputRange: [0, 1], 
    outputRange: [1, 0],
  });

  const HEADER_HEIGHT = insets.top + 100; 

  return (
    <View 
      style={styles.container}
      // 🟢 PanResponder 부착 (전체 화면 터치 감지)
      {...panResponder.panHandlers}
    >
      <AlertModal visible={modalVisible} message={modalMessage} onClose={() => setModalVisible(false)} />

      {/* 🟢 고정 헤더 */}
      <View style={[styles.headerContainer, { paddingTop: insets.top + 30}]}>
        <View style={styles.headerRow}>
          {/* 탭 버튼들 */}
          <View style={styles.tabSwitchContainer}>
            <View style={styles.tabButtons}>
              <Pressable onPress={() => switchTab(0)} style={styles.tabBtn}>
                <Animated.Text 
                  style={[
                    styles.tabText, 
                    { 
                      color: homeTextColor,
                      fontFamily: activeTab === 0 ? 'Pretendard-Bold' : 'Pretendard-Medium'
                    }
                  ]}
                >
                   홈  
                </Animated.Text>
              </Pressable>
              
              <Pressable onPress={() => switchTab(1)} style={styles.tabBtn}>
                <Animated.Text 
                  style={[
                    styles.tabText, 
                    { 
                      color: galleryTextColor,
                      fontFamily: activeTab === 1 ? 'Pretendard-Bold' : 'Pretendard-Medium'
                    }
                  ]}
                >
                  갤러리
                </Animated.Text>
              </Pressable>
            </View>

            {/* 인디케이터 바 */}
            <Animated.View 
              style={[
                styles.activeIndicator, 
                { 
                  backgroundColor: headerTintColor, 
                  width: indicatorWidth, 
                  transform: [{ translateX: indicatorTranslateX }] 
                }
              ]} 
            />
          </View>

          {/* 마이페이지 아이콘 */}
          <Pressable onPress={() => router.push('/mypage')} style={styles.profileButton}>
             <Ionicons name="person-circle-outline" size={32} color={activeTab === 0 ? "#FFF" : "#000"} />
          </Pressable>
        </View>

        {/* 🟢 디데이 배지 */}
        <Animated.View style={[styles.dDayContainer, { opacity: dDayOpacity }]}>
           <View style={[styles.divider, { backgroundColor: activeTab === 0 ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.1)' }]} />
           <View style={styles.dDayBadge}>
              <Image source={heartImg} style={[styles.heartImage]} />
              <AppText type="bold" style={[styles.dDayText, { color: '#FFF' }]}>
                {isCoupled ? `${dDay-1}일째` : '연결 대기중'}
              </AppText>
           </View>
        </Animated.View>
      </View>

      {/* 컨텐츠 영역 */}
      <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
        {activeTab === 0 ? (
          // --- PAGE 1: HOME ---
          <View style={{ flex: 1 }}>
            <View style={styles.backgroundLayer}>
              <ImageBackground
                source={require('../../assets/images/default_bg.jpeg')}
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

            <View style={styles.homeContentContainer}>
              <View style={{ height: HEADER_HEIGHT }} /> 

              <View style={styles.infoSection}>
                <View style={styles.nameDateContainer}>
                  <AppText style={styles.userName}>{userName}</AppText>
                  <AppText style={styles.dateText}>
                    {startDate ? `📅 ${startDate.replace(/-/g, '. ')}.` : '📅 시작일을 설정해주세요'}
                  </AppText>
                </View>
              </View>

              <View style={[styles.dashboard, { paddingBottom: insets.bottom + 10 }]}>
                <Pressable
                  style={({ pressed }) => [styles.missionCard, pressed && styles.pressedCard, !isCoupled && styles.disabledMissionCard]}
                  onPress={handlePressCamera}
                >
                  <View style={styles.missionHeader}>
                    <AppText type="semibold" style={styles.cardTitle}>오늘의 미션</AppText>
                  </View>
                  <AppText type="regular" style={[styles.missionContent, !isCoupled && { color: '#FF6B6B', fontSize: 13 }]} numberOfLines={2}>
                    {isCoupled ? todayMissionTitle || '새로운 미션 준비 중...' : '커플을 연결해주세요.'}
                  </AppText>
                  <View style={styles.cameraLabelBox}>
                    <AppText type='semibold' style={styles.cameraLabel}>카메라</AppText>
                  </View>
                </Pressable>

                <View style={styles.bottomRow}>
                  <Pressable
                    style={({ pressed }) => [styles.squareCard, styles.calendarCard, pressed && styles.pressedCard, !isCoupled && styles.disabledCard]}
                    onPress={handlePressCalendar}
                  >
                    <Ionicons name="calendar" size={32} color="rgba(255,255,255,0.8)" style={styles.cardIcon} />
                    <AppText type='semibold' style={styles.cardLabelWhite}>캘린더</AppText>
                  </Pressable>

                  <Pressable
                    style={({ pressed }) => [styles.squareCard, styles.chatCard, pressed && styles.pressedCard, !isCoupled && styles.disabledCard]}
                    onPress={handlePressChat}
                  >
                    <Ionicons name="chatbubble-ellipses" size={32} color="#4A4A4A" style={styles.cardIcon} />
                    <AppText type='semibold' style={styles.cardLabelBlack}>채팅</AppText>
                  </Pressable>
                </View>
              </View>
            </View>
          </View>
        ) : (
          // --- PAGE 2: GALLERY ---
          <View style={{ flex: 1, backgroundColor: '#FFF' }}>
            <View style={{ flex: 1, paddingTop: HEADER_HEIGHT - 30 }}> 
               <GalleryView />
            </View>
          </View>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  loadingContainer: { flex: 1, backgroundColor: '#FFF', justifyContent: 'center', alignItems: 'center' },
  container: { flex: 1, backgroundColor: '#FFFCF5' },
  headerContainer: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100, paddingHorizontal: 20 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', height: 40 },
  tabSwitchContainer: {},
  tabButtons: { flexDirection: 'row', alignItems: 'center', gap: 15 },
  tabBtn: { paddingBottom: 6, alignItems: 'center', minWidth: 35, justifyContent: 'center' },
  tabText: { fontSize: 16, height:'100%' },
  activeIndicator: { position: 'absolute', bottom: 0, left: 0, height: 2 },
  profileButton: { padding: 4 },
  dDayContainer: { marginTop: 10, height: 40 }, 
  divider: { width: '100%', height: 0.5, marginBottom: 10 },
  dDayBadge: { flexDirection: 'row', alignItems: 'center' },
  heartImage: { width: 20, height: 20, tintColor: '#fff', marginRight: 5 },
  dDayText: { fontSize: 13 },
  backgroundLayer: { position: 'absolute', top: 0, left: 0, right: 0, height: '60%', zIndex: 0 },
  backgroundImage: { width: '100%', height: '100%' },
  dimOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.2)' },
  gradientOverlay: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '30%' },
  homeContentContainer: { flex: 1, zIndex: 1, justifyContent: 'space-between', paddingBottom: 20, },
  infoSection: { paddingHorizontal: 24, marginBottom: 0 ,},
  nameDateContainer: { gap: 2 },
  userName: { color: '#FFF', fontSize: 26, textShadowColor: 'rgba(0,0,0,0.3)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },
  dateText: { color: '#EEE', fontSize: 13 },
  dashboard: { paddingHorizontal: 16, gap: 12,  },
  pressedCard: { opacity: 0.9, transform: [{ scale: 0.98 }] },
  disabledCard: { opacity: 0.5, backgroundColor: '#DDD' },
  disabledMissionCard: { opacity: 0.7, backgroundColor: '#EEE' },
  missionCard: { backgroundColor: 'rgba(247,245,241,0.8)', borderRadius: 12, padding: 20, minHeight: 220, justifyContent: 'space-between' },
  missionHeader: {},
  cardTitle: { fontSize: 13, color: '#000' },
  missionContent: { fontSize: 13, color: '#444', marginBottom: 150 },
  cameraLabelBox: { position: 'absolute', bottom: 20, left: 20 },
  cameraLabel: { fontSize: 22, color: '#000' },
  bottomRow: { flexDirection: 'row', gap: 12, height: 160 },
  squareCard: { borderRadius: 12, padding: 20, justifyContent: 'space-between' },
  calendarCard: { flex: 1.7, backgroundColor: '#3E3C3C' },
  chatCard: { flex: 1, backgroundColor: '#EAE8E3' },
  cardLabelWhite: { fontSize: 22, color: '#FFF' },
  cardLabelBlack: { fontSize: 22, color: '#111' },
  cardIcon: { alignSelf: 'flex-end' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: SCREEN_WIDTH * 0.8, backgroundColor: '#FFFCF5', borderRadius: 20, padding: 24, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 5 },
  modalIconBox: { marginBottom: 0 },
  modalTitle: { fontSize: 18, color: '#666', marginBottom: 8 },
  modalMessage: { fontSize: 12, color: '#666', textAlign: 'center', marginBottom: 16, lineHeight: 20 },
  modalButton: { backgroundColor: '#6198FF', paddingVertical: 12, paddingHorizontal: 40, borderRadius: 12, marginTop: 10 },
  modalButtonText: { color: '#FFF', fontSize: 13 },
});