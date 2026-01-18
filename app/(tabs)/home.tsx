import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { format, parseISO } from "date-fns";
import { LinearGradient } from "expo-linear-gradient";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
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
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AppText from "../../components/AppText";
import GalleryView from "../components/GalleryView";
import { useUser } from "../context/UserContext";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const heartImg = require("../../assets/images/Heart.png");
const defaultBgImg = require("../../assets/images/default_bg.png");
const calendarImg = require("../../assets/images/calendar.png");

// --- 알림 모달 컴포넌트 ---
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
          <AppText type="medium" style={styles.modalMessage}>
            {message}
          </AppText>
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
  const [modalMessage, setModalMessage] = useState("");
  const [activeTab, setActiveTab] = useState<0 | 1>(0);

  const tabAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;

  // 데이터 정리 및 가공
  const isCoupled = !!(userData && userData.coupleId && userData.coupleId > 0);
  const dDay = userData?.date ?? 1;
  const totalMissionCount = userData?.missionCompletedCount ?? 0;
  const todayMissionTitle =
    todayMissions && todayMissions.length > 0 ? todayMissions[0].title : null;

  const mainPhoto = userData?.mainPhoto;
  const backgroundSource = mainPhoto?.imageUrl
    ? { uri: mainPhoto.imageUrl }
    : defaultBgImg;
  const displayTitle = mainPhoto?.uploaderNickname
    ? mainPhoto.uploaderNickname
    : userData?.myName || "사용자";

  let displayDateText = "";
  if (mainPhoto?.createdAt) {
    displayDateText = `${format(parseISO(mainPhoto.createdAt), "yyyy. MM. dd.")}`;
  }

  // 좀비 데이터 정리 로직
  useEffect(() => {
    const cleanUpStaleData = async () => {
      if (userData && (!userData.coupleId || userData.coupleId === 0)) {
        const zombieId = await AsyncStorage.getItem("coupleId");
        if (zombieId) await AsyncStorage.multiRemove(["coupleId", "roomId"]);
      }
    };
    cleanUpStaleData();
  }, [userData]);

  // 화면 포커스 시 데이터 새로고침
  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      const load = async () => {
        try {
          await refreshUserData();
        } catch (error) {
          console.error("Home Data Refresh Fail:", error);
        } finally {
          if (isActive) setLoading(false);
        }
      };
      load();
      return () => {
        isActive = false;
      };
    }, [refreshUserData]),
  );

  const showModal = (msg: string) => {
    setModalMessage(msg);
    setModalVisible(true);
  };

  const switchTab = (targetIndex: 0 | 1) => {
    if (activeTab === targetIndex) return;
    Animated.timing(tabAnim, {
      toValue: targetIndex,
      duration: 300,
      useNativeDriver: false,
    }).start();
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

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponderCapture: (_, gestureState) => {
        const { dx, dy } = gestureState;
        return Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.2;
      },
      onPanResponderRelease: (_, gestureState) => {
        const { dx } = gestureState;
        if (dx < -30 && activeTab === 0) switchTab(1);
        else if (dx > 30 && activeTab === 1) switchTab(0);
      },
    }),
  ).current;

  const handlePressCamera = () => {
    if (!isCoupled) {
      showModal("커플 연결 후 미션을 수행할 수 있어요!");
      return;
    }
    router.push("/camera");
  };
  const handlePressCalendar = () => {
    if (!isCoupled) {
      showModal("커플 연결 후 캘린더를 사용할 수 있어요!");
      return;
    }
    router.push("/calendar");
  };
  const handlePressChat = () => {
    if (!isCoupled) {
      showModal("커플 연결 후 채팅을 할 수 있어요!");
      return;
    }
    router.push("/chat");
  };

  if (loading)
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#333" />
      </View>
    );

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
    outputRange: ["#FFF", "#000"],
  });
  const homeTextColor = tabAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["rgba(255,255,255,1)", "rgba(0,0,0,0.3)"],
  });
  const galleryTextColor = tabAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["rgba(255,255,255,0.5)", "rgba(0,0,0,1)"],
  });
  const dDayOpacity = tabAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0],
  });
  const HEADER_HEIGHT = insets.top + 100;

  return (
    <View style={styles.container} {...panResponder.panHandlers}>
      <AlertModal
        visible={modalVisible}
        message={modalMessage}
        onClose={() => setModalVisible(false)}
      />

      {/* 헤더 */}
      <View style={[styles.headerContainer, { paddingTop: insets.top + 30 }]}>
        <View style={styles.headerRow}>
          <View style={styles.tabSwitchContainer}>
            <View style={styles.tabButtons}>
              <Pressable onPress={() => switchTab(0)} style={styles.tabBtn}>
                <Animated.Text
                  style={[
                    styles.tabText,
                    {
                      color: homeTextColor,
                      fontFamily:
                        activeTab === 0
                          ? "Pretendard-Bold"
                          : "Pretendard-Medium",
                    },
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
                      fontFamily:
                        activeTab === 1
                          ? "Pretendard-Bold"
                          : "Pretendard-Medium",
                    },
                  ]}
                >
                  갤러리
                </Animated.Text>
              </Pressable>
            </View>
            <Animated.View
              style={[
                styles.activeIndicator,
                {
                  backgroundColor: headerTintColor,
                  width: indicatorWidth,
                  transform: [{ translateX: indicatorTranslateX }],
                },
              ]}
            />
          </View>
          <Pressable
            onPress={() => router.push("/mypage")}
            style={styles.profileButton}
          >
            <Ionicons
              name="person-circle-outline"
              size={32}
              color={activeTab === 0 ? "#FFF" : "#000"}
            />
          </Pressable>
        </View>

        <Animated.View style={[styles.dDayContainer, { opacity: dDayOpacity }]}>
          <View
            style={[
              styles.divider,
              {
                backgroundColor:
                  activeTab === 0 ? "#EAEAEA" : "rgba(0,0,0,0.1)",
              },
            ]}
          />
          <View style={styles.dDayBadgeRow}>
            <View style={styles.dDayBadge}>
              <Image source={heartImg} style={[styles.heartImage]} />
              <AppText type="bold" style={[styles.dDayText, { color: "#FFF" }]}>
                {isCoupled ? `${dDay - 1}일째` : "연결 대기중"}
              </AppText>
            </View>
            {isCoupled && (
              <View style={styles.missionCountBadge}>
                <AppText type="medium" style={styles.missionCountText}>
                  지금까지 한 미션: {totalMissionCount}개
                </AppText>
              </View>
            )}
          </View>
        </Animated.View>
      </View>

      <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
        {activeTab === 0 ? (
          <View style={{ flex: 1 }}>
            <View style={styles.backgroundLayer}>
              <ImageBackground
                source={backgroundSource}
                style={styles.backgroundImage}
                resizeMode="cover"
              >
                <View style={styles.dimOverlay} />
                <LinearGradient
                  colors={["transparent", "#FFFCF5"]}
                  style={styles.gradientOverlay}
                  locations={[0.2, 1]}
                />
              </ImageBackground>
            </View>

            <View style={styles.homeContentContainer}>
              <View style={{ height: HEADER_HEIGHT }} />

              {backgroundSource !== defaultBgImg ? (
                <View style={styles.infoSection}>
                  <View style={styles.nameDateContainer}>
                    <AppText type="pretendard-b" style={styles.userName}>
                      {displayTitle}
                    </AppText>
                    <View style={styles.datewrap}>
                      <Image
                        source={calendarImg}
                        style={[styles.calendarImage]}
                      />
                      <AppText type="semibold" style={styles.dateText}>
                        {displayDateText}
                      </AppText>
                    </View>
                  </View>
                </View>
              ) : (
                <View style={{ marginBottom: 20 }} />
              )}

              <View
                style={[styles.dashboard, { paddingBottom: insets.bottom }]}
              >
                <Pressable
                  style={({ pressed }) => [
                    styles.missionCard,
                    pressed && styles.pressedCard,
                    !isCoupled && styles.disabledMissionCard,
                  ]}
                  onPress={handlePressCamera}
                >
                  <View style={styles.missionwrap}>
                    <View style={styles.missionHeader}>
                      <AppText type="semibold" style={styles.cardTitle}>
                        오늘의 미션
                      </AppText>
                    </View>
                    <AppText
                      type="regular"
                      style={[
                        styles.missionContent,
                        !isCoupled && { color: "#FF6B6B", fontSize: 13 },
                      ]}
                      numberOfLines={2}
                    >
                      {isCoupled
                        ? todayMissionTitle || "오늘의 미션이 도착했어요!"
                        : "커플을 연결해주세요."}
                    </AppText>
                  </View>
                  <View style={styles.cameraLabelBox}>
                    <AppText type="semibold" style={styles.cameraLabel}>
                      카메라
                    </AppText>
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
                    <Ionicons
                      name="calendar"
                      size={32}
                      color="rgba(255,255,255,0.8)"
                      style={styles.cardIcon}
                    />
                    <AppText type="semibold" style={styles.cardLabelWhite}>
                      캘린더
                    </AppText>
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
                    <Ionicons
                      name="chatbubble-ellipses"
                      size={32}
                      color="#4A4A4A"
                      style={styles.cardIcon}
                    />
                    <AppText type="semibold" style={styles.cardLabelBlack}>
                      채팅
                    </AppText>
                  </Pressable>
                </View>
              </View>
            </View>
          </View>
        ) : (
          <View style={{ flex: 1, backgroundColor: "#FFFCF5" }}>
            <View style={{ flex: 1, paddingTop: HEADER_HEIGHT - 30 }}>
              <GalleryView onBackToHome={() => switchTab(0)} />
            </View>
          </View>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: "#FFFCF5",
    justifyContent: "center",
    alignItems: "center",
  },
  container: { flex: 1, backgroundColor: "#FFFCF5" },
  headerContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    paddingHorizontal: 20,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    height: 40,
  },
  tabSwitchContainer: {},
  tabButtons: { flexDirection: "row", alignItems: "center", gap: 15 },
  tabBtn: {
    paddingBottom: 6,
    alignItems: "center",
    minWidth: 35,
    justifyContent: "center",
  },
  tabText: { fontSize: 16, height: "100%" },
  activeIndicator: { position: "absolute", bottom: 0, left: 0, height: 2 },
  profileButton: { padding: 4 },
  dDayContainer: { marginTop: 10 },
  divider: { width: "100%", height: 0.7, marginBottom: 8 },
  dDayBadgeRow: { flexDirection: "column", alignItems: "flex-start", gap: 4 },
  dDayBadge: { flexDirection: "row", alignItems: "center" },
  heartImage: { width: 20, height: 20, tintColor: "#fff", marginRight: 5 },
  calendarImage: { width: 16, height: 16, tintColor: "#fff", marginRight: 4 },
  dDayText: { fontSize: 14 },
  missionCountBadge: { marginLeft: 2 },
  missionCountText: { fontSize: 12, color: "rgba(255,255,255,0.8)" },
  backgroundLayer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: "70%",
    zIndex: 0,
  },
  backgroundImage: { width: "100%", height: "100%" },
  dimOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.2)",
  },
  gradientOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "30%",
  },
  homeContentContainer: { flex: 1, zIndex: 1, justifyContent: "flex-end" },
  infoSection: { paddingHorizontal: 24, marginBottom: "5%" },
  nameDateContainer: { gap: 2 },
  userName: { color: "#FFF", fontSize: 10, textShadowRadius: 4 },
  dateText: { color: "#fff", fontSize: 10, alignItems: "flex-start" },
  datewrap: { flexDirection: "row", alignItems: "center" },
  dashboard: { paddingHorizontal: 16, gap: 12, height: "55%" },
  pressedCard: { opacity: 0.9, transform: [{ scale: 0.98 }] },
  disabledCard: { opacity: 0.5, backgroundColor: "#DDD" },
  disabledMissionCard: { opacity: 0.7, backgroundColor: "#EEE" },
  missionCard: {
    backgroundColor: "rgba(247,245,241,0.8)",
    borderRadius: 12,
    padding: 20,
    minHeight: "30%",
    justifyContent: "space-between",
  },
  missionwrap: { marginBottom: "30%" },
  missionHeader: {},
  cardTitle: { fontSize: 13, color: "#000" },
  missionContent: { fontSize: 13, color: "#444" },
  cameraLabelBox: { position: "absolute", bottom: 20, left: 20 },
  cameraLabel: { fontSize: 22, color: "#000" },
  bottomRow: { flexDirection: "row", gap: 12, height: "35%" },
  squareCard: {
    borderRadius: 12,
    padding: 20,
    justifyContent: "space-between",
  },
  calendarCard: { flex: 1.7, backgroundColor: "#3E3C3C" },
  chatCard: { flex: 1, backgroundColor: "#EAE8E3" },
  cardLabelWhite: { fontSize: 22, color: "#FFF" },
  cardLabelBlack: { fontSize: 22, color: "#111" },
  cardIcon: { alignSelf: "flex-end" },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.3)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    width: SCREEN_WIDTH * 0.8,
    backgroundColor: "#FFFCF5",
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  modalIconBox: { marginBottom: 0 },
  modalTitle: { fontSize: 18, color: "#666", marginBottom: 8 },
  modalMessage: {
    fontSize: 12,
    color: "#666",
    textAlign: "center",
    marginBottom: 16,
    lineHeight: 20,
  },
  modalButton: {
    backgroundColor: "#6198FF",
    paddingVertical: 12,
    paddingHorizontal: 40,
    borderRadius: 12,
    marginTop: 10,
  },
  modalButtonText: { color: "#FFF", fontSize: 13 },
});
