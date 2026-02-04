import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Clipboard from "expo-clipboard";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AppText from "../components/AppText";
import { useUser } from "./context/UserContext";
import { authFetch } from "./utils/apiClient";

export default function CoupleConnectScreen() {
  const insets = useSafeAreaInsets();
  const { refreshUserData } = useUser();

  const [myCode, setMyCode] = useState<string>("");
  const [partnerCode, setPartnerCode] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const [modalVisible, setModalVisible] = useState(false);
  const [testModalVisible, setTestModalVisible] = useState(false);
  const [testCode, setTestCode] = useState("");

  useEffect(() => {
    fetchMyCode();
  }, []);

  // 내 코드 가져오기
  const fetchMyCode = async () => {
    try {
      // 1. 마이페이지 정보 조회
      try {
        const userRes = await authFetch("/api/mypage");
        if (userRes.ok) {
          const userData = await userRes.json();
        }
      } catch (err) {
        console.warn("마이페이지 정보 조회 실패", err);
      }

      // 2. 커플 코드 발급/조회
      const res = await authFetch("/user/couple/code");

      if (res.ok) {
        const code = await res.text();
        setMyCode(code);
      } else {
        console.warn("커플 코드 발급 실패:", res.status);
      }
    } catch (e) {
      console.error("내 코드 가져오기 에러:", e);
    }
  };

  const copyToClipboard = async () => {
    if (!myCode) return;
    await Clipboard.setStringAsync(myCode);
    Alert.alert("복사 완료", "커플 코드가 복사되었습니다!");
  };

  // 가상 상대방 생성
  const handleTestGo = async () => {
    try {
      const res = await authFetch("/test/go", { method: "POST" });
      const text = await res.text();

      if (res.ok) {
        setTestCode(text);
        setTestModalVisible(true);
      } else {
        Alert.alert("테스트 실패", text);
      }
    } catch (e) {
      Alert.alert("에러", "테스트 호출 중 에러 발생");
    }
  };

  const handleTestConfirm = () => {
    setPartnerCode(testCode);
    setTestModalVisible(false);
  };

  // 커플 연결
  const handleConnect = async () => {
    if (!partnerCode.trim()) {
      Alert.alert("알림", "상대방의 코드를 입력해주세요.");
      return;
    }

    try {
      setLoading(true);

      const res = await authFetch(
        `/user/couple?coupleCode=${encodeURIComponent(partnerCode)}`,
        {
          method: "POST",
        },
      );

      const text = await res.text();

      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        Alert.alert("오류", "서버 응답 형식이 올바르지 않습니다.");
        return;
      }

      if (res.ok) {
        const cid = data.memberName;
        if (cid !== undefined && cid !== null) {
          await AsyncStorage.setItem("coupleId", String(cid));
          await refreshUserData();
          setModalVisible(true);
        } else {
          Alert.alert("오류", "커플 연결은 되었으나 ID를 받아오지 못했습니다.");
        }
      } else {
        const errorMsg = data?.message || "코드를 다시 확인해주세요.";
        Alert.alert("연결 실패", errorMsg);
      }
    } catch (e) {
      console.error("커플 연결 에러:", e);
      Alert.alert("오류", "연결 중 문제가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handleSuccessConfirm = async () => {
    setModalVisible(false);
    await refreshUserData();
    router.replace("/(tabs)/home");
  };

  // --- UI 렌더링 ---
  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color="#1E1E1E" />
        </Pressable>
        <AppText style={styles.headerTitle}>커플 연결</AppText>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <AppText type="medium" style={styles.cardTitle}>
            나의 커플 코드
          </AppText>
          <AppText type="medium" style={styles.cardDesc}>
            이 코드를 상대방에게 공유하여 연결을 요청하세요.
          </AppText>

          <View style={styles.codeContainer}>
            {myCode ? (
              <AppText type="bold" style={styles.codeText}>
                {myCode}
              </AppText>
            ) : (
              <ActivityIndicator size="small" color="#6198FF" />
            )}
            <Pressable onPress={copyToClipboard} style={styles.copyButton}>
              <Ionicons name="copy-outline" size={20} color="#6198FF" />
              <AppText style={styles.copyText}>복사</AppText>
            </Pressable>
          </View>
        </View>

        <View style={[styles.card, { marginTop: 24 }]}>
          <AppText type="medium" style={styles.cardTitle}>
            상대방 코드 입력
          </AppText>
          <AppText type="medium" style={styles.cardDesc}>
            전달받은 상대방의 코드를 여기에 입력해주세요.
          </AppText>

          <TextInput
            placeholder="코드를 입력하세요"
            placeholderTextColor="#AAA"
            value={partnerCode}
            onChangeText={setPartnerCode}
            autoCapitalize="characters"
            style={[
              styles.input,
              { fontFamily: "Paperlogy-7Bold", fontSize: 12, color: "#4D5053" },
            ]}
          />

          <Pressable
            style={({ pressed }) => [
              styles.connectButton,
              pressed && { opacity: 0.8 },
            ]}
            onPress={handleConnect}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <AppText type="bold" style={styles.connectButtonText}>
                연결하기
              </AppText>
            )}
          </Pressable>
        </View>

        <View style={{ marginTop: 40, alignItems: "center" }}>
          <Pressable onPress={handleTestGo} style={styles.testButton}>
            <AppText style={{ color: "#FF6B6B", fontSize: 13 }}>
              가상 상대방 생성하기
            </AppText>
          </Pressable>
        </View>
      </ScrollView>

      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={handleSuccessConfirm}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalIconCircle}>
              <Ionicons name="heart" size={32} color="#FF6B6B" />
            </View>
            <AppText type="bold" style={styles.modalTitle}>
              연결 성공!
            </AppText>
            <AppText type="medium" style={styles.modalMessage}>
              이제 두 분만의 소중한 기록을{"\n"}시작해보세요.
            </AppText>
            <Pressable
              style={styles.modalButton}
              onPress={handleSuccessConfirm}
            >
              <AppText type="bold" style={styles.modalButtonText}>
                홈으로 가기
              </AppText>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal
        visible={testModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setTestModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View
              style={[styles.modalIconCircle, { backgroundColor: "#F0F8FF" }]}
            >
              <Ionicons name="people" size={32} color="#6198FF" />
            </View>
            <AppText type="bold" style={styles.modalTitle}>
              가상의 상대 생성 완료
            </AppText>
            <AppText type="medium" style={styles.modalMessage}>
              코드: {testCode}
              {"\n"}입력창에 넣을까요?
            </AppText>
            <View style={{ flexDirection: "row", gap: 10, marginTop: 10 }}>
              <Pressable
                style={[styles.modalButton, { backgroundColor: "#E0E0E0" }]}
                onPress={() => setTestModalVisible(false)}
              >
                <AppText
                  type="bold"
                  style={[styles.modalButtonText, { color: "#666" }]}
                >
                  취소
                </AppText>
              </Pressable>
              <Pressable style={styles.modalButton} onPress={handleTestConfirm}>
                <AppText type="bold" style={styles.modalButtonText}>
                  확인
                </AppText>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
  content: { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 40 },
  card: { backgroundColor: "#FFF" },
  cardTitle: { fontSize: 18, color: "#333", marginBottom: 8 },
  cardDesc: { fontSize: 12, color: "#888", marginBottom: 20, lineHeight: 20 },
  codeContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F7F7F7",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  codeText: { fontSize: 12, color: "#4D5053" },
  copyButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    padding: 4,
  },
  copyText: { color: "#6198FF", fontSize: 14 },
  input: {
    backgroundColor: "#F7F7F7",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: "#333",
    marginBottom: 20,
    fontFamily: "Paperlogy-7Bold",
  },
  connectButton: {
    backgroundColor: "#6198FF",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
  },
  connectButtonText: { color: "#FFF", fontSize: 16 },
  testButton: {
    padding: 10,
    borderWidth: 1,
    borderColor: "#FF6B6B",
    borderRadius: 8,
    backgroundColor: "#FFF0F0",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    width: "80%",
    backgroundColor: "#FFF",
    borderRadius: 20,
    padding: 30,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 5,
  },
  modalIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#FFF0F0",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  modalTitle: { fontSize: 16, color: "#333", marginBottom: 10 },
  modalMessage: {
    fontSize: 13,
    color: "#666",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 24,
  },
  modalButton: {
    backgroundColor: "#6198FF",
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 999,
  },
  modalButtonText: { color: "#FFF", fontSize: 15 },
});
