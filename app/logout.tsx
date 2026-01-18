import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import React, { useState } from "react";
import { Alert, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AppText from "../components/AppText";
import { useUser } from "./context/UserContext";

const BASE_URL = "https://mumuri.shop";

export default function LogoutScreen() {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(false);
  const { setUserData, setTodayMissions } = useUser();
  const handleBack = () => router.back();

  const handleLogoutPress = () => {
    Alert.alert("로그아웃", "정말 로그아웃 하시겠습니까?", [
      { text: "취소", style: "cancel" },
      { text: "로그아웃", style: "destructive", onPress: performLogout },
    ]);
  };

  const performLogout = async () => {
    setLoading(true);

    // 1. 서버에 로그아웃 알림
    try {
      const accessToken = await AsyncStorage.getItem("token");
      const refreshToken = await AsyncStorage.getItem("refreshToken");

      if (accessToken) {
        await fetch(`${BASE_URL}/auth/logout`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ refreshToken: refreshToken || "" }),
        });
      }
    } catch (e) {
      console.log("Server logout failed, proceeding with local cleanup...");
    }

    // 2. 로컬 저장소 데이터 삭제
    try {
      const keysToRemove = [
        "token",
        "refreshToken",
        "coupleId",
        "roomId",
        "userData",
      ];
      await AsyncStorage.multiRemove(keysToRemove);
      await AsyncStorage.setItem("isLoggingOut", "true");

      // 3. 전역 상태 초기화
      setUserData(null);
      setTodayMissions([]);

      console.log("✅ Local data cleared");
    } catch (e) {
      console.error("Cleanup error:", e);
    }

    // 4. 무조건 페이지 이동 (최우선 실행)
    setLoading(false);
    if (router.canDismiss()) {
      router.dismissAll();
    }

    router.replace("/(auth)");
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={handleBack} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color="#1E1E1E" />
        </Pressable>
        <AppText style={styles.headerTitle}>로그아웃</AppText>
        <View style={{ width: 24 }} />
      </View>
      <View style={styles.content} />
      <View
        style={[styles.bottomContainer, { paddingBottom: insets.bottom + 20 }]}
      >
        <Pressable
          style={[styles.logoutButton, loading && { opacity: 0.7 }]}
          onPress={handleLogoutPress}
          disabled={loading}
        >
          <AppText type="medium" style={styles.logoutButtonText}>
            {loading ? "로그아웃 중..." : "무무리 로그아웃"}
          </AppText>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFF" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: "#FFF",
  },
  backButton: { padding: 4 },
  headerTitle: { fontSize: 18, color: "#444444" },
  content: { flex: 1 },
  bottomContainer: { paddingHorizontal: 24 },
  logoutButton: {
    backgroundColor: "#6198FF",
    borderRadius: 12,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
  },
  logoutButtonText: { color: "#FFF", fontSize: 16 },
});
