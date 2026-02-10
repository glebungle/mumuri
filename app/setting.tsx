// app/setting.tsx
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AppText from "../components/AppText";
import { useUser } from "./context/UserContext";

export default function SettingScreen() {
  const insets = useSafeAreaInsets();
  const { userData } = useUser(); // 유저 데이터 가져오기
  const handleBack = () => router.back();

  const isConnected = !!userData?.coupleId;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* 1. 상단 네비게이션 헤더 */}
      <View style={styles.header}>
        <Pressable onPress={handleBack} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color="#1E1E1E" />
        </Pressable>
        <AppText style={styles.headerTitle}>설정</AppText>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* 섹션 1: 프로필 관리 */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <AppText type="semibold" style={styles.sectionTitle}>
              프로필 관리
            </AppText>
            <Pressable onPress={() => router.push("/profile")}>
              <Ionicons name="chevron-forward" size={20} color="#000" />
            </Pressable>
          </View>
          <View style={styles.itemGroup}>
            <Pressable onPress={() => router.push("/profile")}>
              <AppText type="medium" style={styles.itemText}>
                마이 프로필
              </AppText>
            </Pressable>
          </View>
        </View>

        {/* 섹션 2: 커플 연결 */}
        <View style={styles.section}>
          <View style={[styles.sectionHeader]}>
            <AppText type="semibold" style={[styles.sectionTitle]}>
              커플 연결
            </AppText>
            <Pressable
              onPress={() => router.push("/couple-connect")}
              disabled={isConnected}
            >
              <Ionicons
                name="chevron-forward"
                size={20}
                color={isConnected ? "#CCCCCC" : "#000"}
              />
            </Pressable>
          </View>
          <View style={styles.itemGroup}>
            <Pressable
              onPress={() => router.push("/couple-connect")}
              disabled={isConnected}
            >
              <AppText
                type="medium"
                style={[styles.itemText, isConnected && { color: "#CCCCCC" }]}
              >
                {isConnected ? "커플 연결 완료" : "커플 연결하기"}
              </AppText>
            </Pressable>
          </View>
        </View>

        {/* 섹션 3: 계정 관리 */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <AppText type="semibold" style={styles.sectionTitle}>
              계정 관리
            </AppText>
            <Pressable onPress={() => router.push("./account-setting")}>
              <Ionicons name="chevron-forward" size={20} color="#000" />
            </Pressable>
          </View>
          <View style={styles.itemGroup}>
            <Pressable onPress={() => router.push("/logout")}>
              <AppText type="medium" style={styles.itemText}>
                로그아웃
              </AppText>
            </Pressable>
            <Pressable onPress={() => router.push("/withdraw")}>
              <AppText type="medium" style={styles.itemText}>
                회원 탈퇴
              </AppText>
            </Pressable>
          </View>
        </View>

        {/* 섹션 4: 정보 */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <AppText type="semibold" style={styles.sectionTitle}>
              정보
            </AppText>
            <Pressable onPress={() => router.push("./info")}>
              <Ionicons name="chevron-forward" size={20} color="#000" />
            </Pressable>
          </View>
          <View style={styles.itemGroup}>
            <View style={styles.itemRow}>
              <AppText type="medium" style={styles.itemText}>
                나의 앱 버전
              </AppText>
            </View>
            <Pressable style={styles.itemRow}>
              <AppText type="medium" style={styles.itemText}>
                이용약관
              </AppText>
            </Pressable>
            <Pressable style={styles.itemRow}>
              <AppText type="medium" style={styles.itemText}>
                개인정보 처리방침
              </AppText>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFF",
  },

  // 헤더 스타일
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

  // 컨텐츠 영역
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },

  // 공통 섹션 스타일
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
    paddingLeft: 8,
  },

  // 섹션 하위 아이템 (우측 정렬 텍스트)
  itemGroup: {
    gap: 4,
  },
  itemRow: {},
  itemText: {
    fontSize: 15,
    color: "#666",
    textAlign: "right",
  },

  storageSection: {
    marginTop: 32,
  },
  storageTitle: {
    paddingLeft: 8,
    fontSize: 16,
    color: "#444444",
    borderBottomWidth: 1,
    borderBottomColor: "#000000",
    paddingBottom: 8,
    marginBottom: 12,
  },
  storageContent: {
    gap: 8,
  },
  storageUsageText: {
    paddingLeft: 8,
    fontSize: 14,
    color: "#747474",
  },
  progressBarBg: {
    height: 16,
    backgroundColor: "#E0E0E0",
    borderRadius: 6,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: "#363636",
    borderRadius: 6,
  },
  text: {
    color: "#b3b3b3ff",
  },
});
