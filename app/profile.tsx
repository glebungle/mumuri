import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback } from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AppText from "../components/AppText";
import { useUser } from "./context/UserContext";

export default function AccountSettingScreen() {
  const insets = useSafeAreaInsets();
  const { userData, refreshUserData } = useUser();

  useFocusEffect(
    useCallback(() => {
      refreshUserData();
    }, [refreshUserData]),
  );

  const handleBack = () => router.back();
  const handleEdit = () => router.push("/edit");

  // --- 날짜 포맷팅 유틸리티 ---
  const formatDate = (dateString?: string | null) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}. ${month}. ${day}`;
  };

  const formatBirthString = (raw?: string | null): string => {
    if (!raw) return "--. --. --";
    return formatDate(raw);
  };

  const myName = userData?.myName || "사용자";
  const myBirth = formatBirthString(userData?.birthday);
  const anniversaryDate = formatDate(userData?.anniversary);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* 헤더 */}
      <View style={styles.header}>
        <Pressable onPress={handleBack} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color="#1E1E1E" />
        </Pressable>
        <AppText style={styles.headerTitle}>프로필 관리</AppText>
        <View style={{ width: 24 }} />
      </View>

      {/* 메뉴 리스트 */}
      <View style={styles.content}>
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <AppText type="medium" style={styles.sectionTitle}>
              마이 프로필
            </AppText>
          </View>
        </View>

        <View style={styles.menuItem}>
          <AppText type="semibold" style={styles.menuText}>
            이름
          </AppText>
          <AppText type="pretendard-r" style={styles.subText}>
            {myName}
            {Platform.OS === "android" ? "\u200A" : ""}
          </AppText>
        </View>

        <View style={styles.menuItem}>
          <AppText type="semibold" style={styles.menuText}>
            생년월일
          </AppText>
          <AppText type="regular" style={styles.subText}>
            {myBirth}
          </AppText>
        </View>

        <View style={styles.menuItem}>
          <AppText type="semibold" style={styles.menuText}>
            기념일
          </AppText>
          <AppText type="regular" style={styles.subText}>
            {anniversaryDate || "--. --. --"}
          </AppText>
        </View>
      </View>
      <View style={[styles.footer, { paddingBottom: 20 + insets.bottom }]}>
        <Pressable style={styles.Button} onPress={handleEdit}>
          <AppText type="semibold" style={styles.ButtonText}>
            프로필 변경
          </AppText>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFF",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: "#FFF",
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    color: "#444444",
  },
  content: {
    marginTop: 10,
    paddingHorizontal: 24,
  },
  section: {
    marginTop: 32,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#000000",
    paddingBottom: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    color: "#444444",
  },
  menuItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 18,
  },
  menuText: {
    fontSize: 14,
    color: "#747474",
  },
  subText: {
    fontSize: 14,
    color: "#747474",
  },
  footer: {
    marginTop: "auto",
    paddingHorizontal: 24,
  },
  Button: {
    backgroundColor: "#6198FF",
    borderRadius: 12,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
  },
  ButtonText: {
    color: "#FFF",
    fontSize: 16,
  },
});
