import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import React, { useState } from "react";
import { Alert, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AppText from "../components/AppText";
import { authFetch } from "./utils/apiClient"; // [추가] 공통 API 클라이언트 임포트

export default function WithdrawScreen() {
  const insets = useSafeAreaInsets();
  const [checked, setChecked] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleBack = () => router.back();

  const handleWithdraw = async () => {
    if (!checked) return;

    Alert.alert(
      "회원 탈퇴",
      "정말 탈퇴하시겠습니까? 모든 데이터가 삭제되며 복구할 수 없습니다.",
      [
        { text: "취소", style: "cancel" },
        { text: "탈퇴하기", style: "destructive", onPress: performWithdraw },
      ],
    );
  };

  // 탈퇴 로직
  const performWithdraw = async () => {
    try {
      setLoading(true);

      const res = await authFetch("/api/auth/withdraw", {
        method: "DELETE",
      });

      if (res.ok) {
        // 탈퇴 성공 시 온보딩 기록을 제외한 모든 데이터 삭제
        const allKeys = await AsyncStorage.getAllKeys();
        const keysToRemove = allKeys.filter(
          (key) => key !== "hasSeenOnboarding",
        );
        await AsyncStorage.multiRemove(keysToRemove);

        Alert.alert("탈퇴 완료", "회원 탈퇴가 정상적으로 처리되었습니다.", [
          {
            text: "확인",
            onPress: () => {
              if (router.canDismiss()) router.dismissAll();
              router.replace("/");
            },
          },
        ]);
      } else {
        const errorText = await res.text();
        console.error(`Withdraw failed (${res.status}):`, errorText);
        Alert.alert(
          "오류",
          "회원 탈퇴 처리에 실패했습니다. 잠시 후 다시 시도해주세요.",
        );
      }
    } catch (e) {
      console.error("Withdraw error:", e);
      Alert.alert("오류", "네트워크 연결 상태를 확인해주세요.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={handleBack} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color="#1E1E1E" />
        </Pressable>
        <AppText style={styles.headerTitle}>무무리 탈퇴</AppText>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.content}>
        <AppText type="medium" style={styles.warningText}>
          무무리를 탈퇴하면,
        </AppText>
        <View style={{ height: 20 }} />
        <AppText
          type="medium"
          style={[styles.warningText, { color: "#FF6B6B" }]}
        >
          • 모든 커플 데이터 및 미션 기록이 삭제됩니다.
        </AppText>
        <AppText
          type="medium"
          style={[styles.warningText, { color: "#FF6B6B" }]}
        >
          • 삭제된 데이터는 다시 복구할 수 없습니다.
        </AppText>
        <View style={{ height: 20 }} />
        <AppText type="medium" style={styles.warningText}>
          중요한 정보는 탈퇴 전 미리 저장해주세요.
        </AppText>
      </View>

      <View
        style={[styles.bottomContainer, { paddingBottom: insets.bottom + 20 }]}
      >
        <View style={styles.checkboxRow}>
          <AppText type="medium" style={styles.checkLabel}>
            위 유의사항을 모두 확인하였고, 탈퇴를 진행합니다.
          </AppText>
          <Pressable onPress={() => setChecked(!checked)}>
            <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
              {checked && <Ionicons name="checkmark" size={18} color="#FFF" />}
            </View>
          </Pressable>
        </View>

        <Pressable
          style={[
            styles.withdrawButton,
            (!checked || loading) && styles.withdrawButtonDisabled,
          ]}
          onPress={handleWithdraw}
          disabled={!checked || loading}
        >
          <AppText type="bold" style={styles.withdrawButtonText}>
            {loading ? "처리 중..." : "무무리 탈퇴"}
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
  },
  backButton: { padding: 4 },
  headerTitle: { fontSize: 18, color: "#444" },
  content: { flex: 1, paddingHorizontal: 30, paddingTop: 50 },
  warningText: { fontSize: 15, color: "#333", lineHeight: 24 },
  bottomContainer: { paddingHorizontal: 24 },
  checkboxRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    marginBottom: 20,
    gap: 10,
  },
  checkLabel: { fontSize: 12, color: "#666" },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    backgroundColor: "#F0F0F0",
    borderColor: "#DDD",
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxChecked: { backgroundColor: "#6198FF", borderColor: "#6198FF" },
  withdrawButton: {
    backgroundColor: "#FF6B6B",
    borderRadius: 12,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
  },
  withdrawButtonDisabled: { backgroundColor: "#FFCACA" },
  withdrawButtonText: { color: "#FFF", fontSize: 16 },
});
