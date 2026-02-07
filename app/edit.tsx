import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import AppText from "../components/AppText";
import { useUser } from "./context/UserContext";
import { authFetch } from "./utils/apiClient";

const defaultProfileImg = require("../assets/images/userprofile.png");

export default function EditProfileScreen() {
  const { userData, refreshUserData } = useUser();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(false);

  const [name, setName] = useState("");
  const [birthday, setBirthday] = useState("");
  const [anniversary, setAnniversary] = useState("");

  const [initialValues, setInitialValues] = useState({
    name: "",
    birthday: "",
    anniversary: "",
  });

  // 날짜 포맷팅 로직
  const formatToDisplay = (dateStr: string | null) => {
    if (!dateStr) return "";
    return dateStr.replace(/-/g, ". ");
  };

  const isValidDate = (dateStr: string) => {
    if (!dateStr.trim()) return true;

    const numbers = dateStr.replace(/[^0-9]/g, "");
    if (numbers.length !== 8) return false;

    const year = parseInt(numbers.slice(0, 4), 10);
    const month = parseInt(numbers.slice(4, 6), 10);
    const day = parseInt(numbers.slice(6, 8), 10);

    if (month < 1 || month > 12) return false;
    if (day < 1 || day > 31) return false;

    const date = new Date(year, month - 1, day);
    return (
      date.getFullYear() === year &&
      date.getMonth() === month - 1 &&
      date.getDate() === day
    );
  };

  const formatToApi = (displayStr: string) => {
    const numbers = displayStr.replace(/[^0-9]/g, "");
    if (numbers.length !== 8) return null;
    return `${numbers.slice(0, 4)}-${numbers.slice(4, 6)}-${numbers.slice(6, 8)}`;
  };

  const handleDateChange = (text: string, setter: (val: string) => void) => {
    const numbers = text.replace(/[^0-9]/g, "");
    let formatted = numbers;
    if (numbers.length > 4)
      formatted = `${numbers.slice(0, 4)}. ${numbers.slice(4)}`;
    if (numbers.length > 6)
      formatted = `${numbers.slice(0, 4)}. ${numbers.slice(4, 6)}. ${numbers.slice(6, 8)}`;
    if (formatted.length > 14) return;
    setter(formatted);
  };

  useEffect(() => {
    if (userData) {
      const loadedName = userData.myName || "";
      const loadedBirth = userData.birthday
        ? formatToDisplay(userData.birthday)
        : "";
      const loadedAnni = userData.anniversary
        ? formatToDisplay(userData.anniversary)
        : "";

      setName(loadedName);
      setBirthday(loadedBirth);
      setAnniversary(loadedAnni);

      setInitialValues({
        name: loadedName,
        birthday: loadedBirth,
        anniversary: loadedAnni,
      });
    }
  }, [userData]);

  const currentImage = userData?.myProfileImageUrl
    ? { uri: userData.myProfileImageUrl }
    : defaultProfileImg;

  // --- 이미지 업로드/삭제 로직  ---
  const pickAndUploadImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("권한 필요", "사진 라이브러리 접근 권한이 필요합니다.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled) {
      await uploadProfileImage(result.assets[0].uri);
    }
  };

  const uploadProfileImage = async (uri: string) => {
    try {
      setLoading(true);

      const formData = new FormData();
      const fileToUpload = {
        uri: Platform.OS === "android" ? uri : uri.replace("file://", ""),
        name: "profile.jpg",
        type: "image/jpeg",
      };
      // @ts-ignore
      formData.append("file", fileToUpload);

      const res = await authFetch("/api/setting/profile-photo", {
        method: "POST",
        headers: {
          "Content-Type": "multipart/form-data",
        },
        body: formData,
      });

      if (res.ok) {
        await refreshUserData();
        Alert.alert("완료", "프로필 사진이 변경되었습니다.");
      } else {
        Alert.alert("실패", "사진 업로드에 실패했습니다.");
      }
    } catch (e) {
      Alert.alert("오류", "서버 통신 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const deleteProfileImage = async () => {
    if (!userData?.myProfileImageUrl) {
      Alert.alert("알림", "삭제할 프로필 사진이 없습니다.");
      return;
    }
    Alert.alert("사진 삭제", "기본 이미지로 되돌리시겠습니까?", [
      { text: "취소", style: "cancel" },
      {
        text: "삭제",
        style: "destructive",
        onPress: async () => {
          try {
            setLoading(true);
            const res = await authFetch("/api/setting/profile-photo", {
              method: "DELETE",
            });
            if (res.ok) {
              await refreshUserData();
              Alert.alert("완료", "프로필 사진이 삭제되었습니다.");
            } else {
              Alert.alert("실패", "사진 삭제에 실패했습니다.");
            }
          } catch (e) {
            console.error(e);
          } finally {
            setLoading(false);
          }
        },
      },
    ]);
  };

  // --- 저장 로직 ---
  const handleSaveAll = async () => {
    if (!name.trim()) {
      Alert.alert("알림", "이름을 입력해주세요.");
      return;
    }

    // 1. 생년월일 유효성 검사
    if (!isValidDate(birthday)) {
      Alert.alert(
        "알림",
        "생년월일이 올바르지 않습니다.\n존재하는 날짜를 입력해주세요.",
      );
      return;
    }

    // 2. 기념일 유효성 검사
    if (anniversary && !isValidDate(anniversary)) {
      Alert.alert(
        "알림",
        "기념일이 올바르지 않습니다.\n존재하는 날짜를 입력해주세요.",
      );
      return;
    }

    const apiBirth = formatToApi(birthday);
    const apiAnni = formatToApi(anniversary);

    setLoading(true);
    try {
      const promises = [];

      if (name !== initialValues.name) {
        promises.push(
          authFetch(`/api/setting/name?name=${encodeURIComponent(name)}`, {
            method: "POST",
          }),
        );
      }

      if (birthday !== initialValues.birthday) {
        promises.push(
          authFetch(`/api/setting/birthday?birthday=${apiBirth || ""}`, {
            method: "POST",
          }),
        );
      }

      if (apiAnni && anniversary !== initialValues.anniversary) {
        promises.push(
          authFetch(`/api/setting/anniversary?anniversary=${apiAnni}`, {
            method: "POST",
          }),
        );
      }

      if (promises.length === 0) {
        Alert.alert("알림", "변경된 내용이 없습니다.");
        setLoading(false);
        return;
      }

      await Promise.all(promises);
      await refreshUserData();

      Alert.alert("성공", "정보가 수정되었습니다.", [
        { text: "확인", onPress: () => router.back() },
      ]);
    } catch (e) {
      console.error(e);
      Alert.alert("오류", "정보 수정 중 문제가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <ScrollView contentContainerStyle={styles.scrollContent}>
            <View style={styles.header}>
              <Pressable onPress={() => router.back()} style={{ padding: 10 }}>
                <Ionicons name="chevron-back" size={28} color="#444" />
              </Pressable>
              <AppText type="pretendard-b" style={styles.headerTitle}>
                프로필 수정
              </AppText>
              <View style={{ width: 48 }} />
            </View>

            <View style={styles.imageSection}>
              <View style={styles.imageWrapper}>
                <Image
                  source={currentImage}
                  style={styles.profileImage}
                  resizeMode="cover"
                />
                {loading && (
                  <View style={styles.loadingOverlay}>
                    <ActivityIndicator size="small" color="#FFF" />
                  </View>
                )}
                <Pressable
                  style={styles.cameraButton}
                  onPress={pickAndUploadImage}
                  disabled={loading}
                >
                  <Ionicons name="camera" size={20} color="#FFF" />
                </Pressable>
              </View>

              <View style={styles.photoActions}>
                <Pressable onPress={pickAndUploadImage} disabled={loading}>
                  <AppText style={styles.photoActionText}>사진 변경</AppText>
                </Pressable>
                <View style={styles.verticalDivider} />
                <Pressable onPress={deleteProfileImage} disabled={loading}>
                  <AppText
                    style={[styles.photoActionText, { color: "#FF6B6B" }]}
                  >
                    삭제
                  </AppText>
                </Pressable>
              </View>
            </View>

            <View style={styles.formContainer}>
              <View style={styles.inputRow}>
                <AppText type="semibold" style={styles.label}>
                  이름
                </AppText>
                <TextInput
                  style={styles.inputBox}
                  value={name}
                  onChangeText={setName}
                  placeholder="이름을 입력하세요"
                  placeholderTextColor="#999"
                />
              </View>

              <View style={styles.inputRow}>
                <AppText type="semibold" style={styles.label}>
                  생년월일 (선택)
                </AppText>
                <TextInput
                  style={styles.inputBox}
                  value={birthday}
                  onChangeText={(t) => handleDateChange(t, setBirthday)}
                  placeholder="YYYY. MM. DD."
                  placeholderTextColor="#999"
                  keyboardType="number-pad"
                  maxLength={14}
                />
              </View>

              <View style={styles.inputRow}>
                <AppText type="semibold" style={styles.label}>
                  기념일
                </AppText>
                <TextInput
                  style={styles.inputBox}
                  value={anniversary}
                  onChangeText={(t) => handleDateChange(t, setAnniversary)}
                  placeholder="YYYY. MM. DD."
                  placeholderTextColor="#999"
                  keyboardType="number-pad"
                  maxLength={14}
                />
              </View>
            </View>

            <Pressable
              style={styles.saveButton}
              onPress={handleSaveAll}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <AppText type="medium" style={styles.saveButtonText}>
                  변경사항 저장
                </AppText>
              )}
            </Pressable>
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFF" },
  scrollContent: { flexGrow: 1, paddingBottom: 40 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  headerTitle: { fontSize: 18, color: "#333" },
  imageSection: { alignItems: "center", marginTop: 30, marginBottom: 40 },
  imageWrapper: { width: 100, height: 100, marginBottom: 16 },
  profileImage: {
    width: "100%",
    height: "100%",
    borderRadius: 50,
    borderWidth: 1,
    borderColor: "#EEE",
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.3)",
    borderRadius: 50,
    justifyContent: "center",
    alignItems: "center",
  },
  cameraButton: {
    position: "absolute",
    bottom: 0,
    right: 0,
    backgroundColor: "#444",
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#FFFCF5",
  },
  photoActions: { flexDirection: "row", alignItems: "center", gap: 12 },
  photoActionText: {
    fontSize: 14,
    color: "#666",
    fontFamily: "Pretendard-Medium",
  },
  verticalDivider: { width: 1, height: 12, backgroundColor: "#DDD" },
  formContainer: { paddingHorizontal: 30, gap: 24 },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  label: { fontSize: 15, color: "#333", width: 80 },
  inputBox: {
    flex: 1,
    height: 50,
    backgroundColor: "#F3F3F3",
    borderRadius: 8,
    paddingHorizontal: 16,
    justifyContent: "center",
    alignItems: "center",
    fontSize: 15,
    fontFamily: "Pretendard-Regular",
    textAlign: "center",
    color: "#333",
  },
  saveButton: {
    marginHorizontal: 20,
    backgroundColor: "#6198FF",
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 60,
    marginBottom: 20,
  },
  saveButtonText: { color: "#FFF", fontSize: 16 },
});
