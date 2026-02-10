import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Clipboard from "expo-clipboard";
import { router } from "expo-router";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Alert,
  Animated,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  TextInputProps,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AppText from "../components/AppText";

// ===================== API 공통 =====================
const BASE = "https://mumuri.shop";

async function authedFetch(path: string, init: RequestInit = {}) {
  const token = (await AsyncStorage.getItem("token")) || "";
  const headers: Record<string, string> = {
    Accept: "application/json",
    "ngrok-skip-browser-warning": "true",
    ...(init.body ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const url = `${BASE}${path}`;
  const res = await fetch(url, { ...init, headers });
  const text = await res.text();

  if (!res.ok) throw new Error(`${path} 실패 (HTTP ${res.status})`);
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export const postName = (name: string) =>
  authedFetch(`/user/name?name=${encodeURIComponent(name)}`, {
    method: "POST",
  });

export const postBirthday = (iso: string) =>
  authedFetch(`/user/birthday?birthday=${encodeURIComponent(iso)}`, {
    method: "POST",
  });

export const postAnniversary = (iso: string) =>
  authedFetch(`/user/anniversary?anniversary=${encodeURIComponent(iso)}`, {
    method: "POST",
  });

export const getCoupleCode = () =>
  authedFetch(`/user/couple/code`, { method: "GET" });

export async function postCouple(code: string) {
  try {
    return await authedFetch(
      `/user/couple?coupleCode=${encodeURIComponent(code)}`,
      { method: "POST" },
    );
  } catch {
    return await authedFetch(`/user/couple`, {
      method: "POST",
      body: JSON.stringify({ coupleCode: code }),
    });
  }
}

// ===================== 헬퍼 함수 =====================

const formatBirthDate = (text: string) => {
  const cleaned = text.replace(/\D/g, "");
  let formatted = cleaned;
  if (cleaned.length > 4) {
    formatted = `${cleaned.slice(0, 4)}. ${cleaned.slice(4, 6)}`;
  }
  if (cleaned.length > 6) {
    formatted = `${cleaned.slice(0, 4)}. ${cleaned.slice(4, 6)}. ${cleaned.slice(6, 8)}`;
  }
  return formatted.slice(0, 14);
};

const isDateFormat = (s: string) =>
  /^\d{4}\.\s?\d{2}\.\s?\d{2}$/.test(s.trim());

const isValidDateSemantic = (s: string) => {
  const only = s.replace(/\D/g, "");
  if (only.length !== 8) return false;

  const y = parseInt(only.slice(0, 4), 10);
  const m = parseInt(only.slice(4, 6), 10);
  const d = parseInt(only.slice(6, 8), 10);

  const date = new Date(y, m - 1, d);
  return (
    date.getFullYear() === y &&
    date.getMonth() + 1 === m &&
    date.getDate() === d
  );
};

function toIsoDate(s: string): string {
  const only = s.replace(/\D/g, "");
  const y = only.slice(0, 4);
  const m = only.slice(4, 6);
  const d = only.slice(6, 8);
  return `${y}-${m}-${d}`;
}

// ===================== 데이터 =====================

const HOBBIES = [
  "운동/스포츠",
  "예술/창작",
  "문화생활",
  "게임/오락",
  "여행/탐험",
  "맛집/카페",
  "집콕/힐링",
  "학습/자기계발",
];
const DATE_STYLES = [
  "활동적인",
  "문화/감성",
  "미식/카페",
  "휴식/힐링",
  "체험/창작",
  "홈데이트",
  "여행/탐험",
];
const LOVE_LANGUAGES = [
  '"사랑해", "보고싶어" 등 말로 표현해줄 때',
  "안아주고 스킨십 해줄 때",
  "깜짝 선물이나 이벤트 해줄 때",
  "함께 시간 내서 데이트 할 때",
  "집안일, 심부름 등 도움을 줄 때",
  "관심 갖고 내 이야기 들어줄 때",
  "응원하고 칭찬해줄 때",
  "작은 것도 기억하고 챙겨줄 때",
];

type StepKey =
  | "name"
  | "birthday"
  | "anniversary"
  | "preferences"
  | "partnerCode";
const HEART_ICON = require("../assets/images/BlueHeart.png");

// ===================== UI 컴포넌트 =====================

const PastCard = React.memo(
  ({ label, value }: { label: string; value: string }) => (
    <View style={[styles.pastCardBase, { height: 90 }]}>
      <AppText style={styles.pastCardLabel}>{label}</AppText>
      <AppText type="semibold" style={styles.pastCardValue}>
        {value || "-"}
      </AppText>
    </View>
  ),
);

const InputField = React.memo(
  ({
    label,
    value,
    placeholder,
    onChangeText,
    keyboardType = "default",
    accentColor,
  }: {
    label: string;
    value: string;
    placeholder: string;
    onChangeText: (text: string) => void;
    keyboardType?: TextInputProps["keyboardType"];
    accentColor: string;
  }) => {
    const inputColor = value.length > 0 ? "#4D5053" : "#9CA3AF";
    return (
      <View>
        <AppText style={[styles.inputLabel, { color: accentColor }]}>
          {label}
        </AppText>
        <TextInput
          placeholder={placeholder}
          placeholderTextColor="#9CA3AF"
          value={value}
          onChangeText={onChangeText}
          keyboardType={keyboardType}
          autoCapitalize="none"
          style={[
            styles.textInputBase,
            { fontFamily: "Paperlogy-6SemiBold", color: inputColor },
          ]}
        />
      </View>
    );
  },
);

// ===================== 메인 Signup 스크린 =====================
export default function Signup() {
  const [step, setStep] = useState<number>(0);
  const [isPosting, setIsPosting] = useState(false);
  const [dateErrorVisible, setDateErrorVisible] = useState(false);

  const [values, setValues] = useState({
    name: "",
    birthday: "",
    anniversary: "",
    partnerCode: "",
  });

  const [selectedHobbies, setSelectedHobbies] = useState<string[]>([]);
  const [selectedDateStyles, setSelectedDateStyles] = useState<string[]>([]);
  const [selectedLoveLanguages, setSelectedLoveLanguages] = useState<string[]>(
    [],
  );
  const [myCoupleCode, setMyCoupleCode] = useState<string>("");

  useEffect(() => {
    const loadAppleName = async () => {
      try {
        const appleName = await AsyncStorage.getItem("temp_apple_name");
        if (appleName) {
          setValues((prev) => ({ ...prev, name: appleName }));
          await AsyncStorage.removeItem("temp_apple_name");
        }
      } catch (e) {
        console.error("애플 이름 로드 실패:", e);
      }
    };
    loadAppleName();
  }, []);

  const copyToClipboard = async () => {
    if (!myCoupleCode) return;
    await Clipboard.setStringAsync(myCoupleCode);
    Alert.alert("복사 완료", "커플 코드가 복사되었습니다!");
  };

  const steps: {
    key: StepKey;
    title: string;
    hint: string;
    accent: string;
    placeholder: string;
  }[] = useMemo(
    () => [
      {
        key: "name",
        title: "닉네임 입력",
        hint: "연인과 부르는 애칭도 좋아요. 사용자님을 어떻게 부를까요?",
        accent: "#6198FF",
        placeholder: "닉네임을 입력해주세요",
      },
      {
        key: "birthday",
        title: "생일 입력",
        hint: "(선택사항)생년월일을 입력해주세요. 생일은 나중에 변경할 수 있어요!",
        accent: "#49DC95",
        placeholder: "0000. 00. 00.",
      },
      {
        key: "anniversary",
        title: "기념일 입력",
        hint: "우리의 사랑이 시작된 날! 기념일을 입력해주세요.",
        accent: "#FF9191",
        placeholder: "0000. 00. 00.",
      },
      {
        key: "preferences",
        title: "질문에 답해주세요!",
        hint: "더 나은 서비스를 제공하기 위해,\n사용자님의 취향을 파악하는 질문을 몇가지 준비했어요.",
        accent: "#3B82F6",
        placeholder: "",
      },
      {
        key: "partnerCode",
        title: "코드 입력",
        hint: "연인을 초대하고 함께 시작해봐요!",
        accent: "#FF9191",
        placeholder: "상대방의 코드를 입력해주세요",
      },
    ],
    [],
  );

  const current = steps[step];

  const canNext = useMemo(() => {
    switch (current.key) {
      case "name":
        return values.name.trim().length >= 1;
      case "birthday":
        return isDateFormat(values.birthday);
      case "anniversary":
        return isDateFormat(values.anniversary);
      case "preferences":
        return (
          selectedHobbies.length > 0 &&
          selectedDateStyles.length > 0 &&
          selectedLoveLanguages.length > 0
        );
      case "partnerCode":
        return values.partnerCode.trim().length > 0;
      default:
        return false;
    }
  }, [
    current.key,
    values,
    selectedHobbies,
    selectedDateStyles,
    selectedLoveLanguages,
  ]);

  const progressPercent = ((step + 1) / steps.length) * 100;
  const progressAnim = useRef(new Animated.Value(progressPercent)).current;

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: progressPercent,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [progressPercent]);

  const toggleSelection = (
    list: string[],
    setList: React.Dispatch<React.SetStateAction<string[]>>,
    item: string,
  ) => {
    if (list.includes(item)) {
      setList(list.filter((i) => i !== item));
    } else {
      setList([...list, item]);
    }
  };

  const onNext = useCallback(async () => {
    if (!canNext || isPosting) return;

    const isDateStep =
      current.key === "birthday" || current.key === "anniversary";
    if (isDateStep) {
      const dateVal = values[current.key as "birthday" | "anniversary"];
      if (!isValidDateSemantic(dateVal)) {
        setDateErrorVisible(true);
        return;
      }
    }

    try {
      setIsPosting(true);

      if (current.key === "name") {
        await postName(values.name.trim());
      } else if (current.key === "birthday") {
        await postBirthday(toIsoDate(values.birthday));
      } else if (current.key === "anniversary") {
        await postAnniversary(toIsoDate(values.anniversary));
        const codeResponse = await getCoupleCode();
        const code =
          typeof codeResponse === "object" && codeResponse !== null
            ? codeResponse.coupleCode
            : codeResponse;
        if (code) {
          setMyCoupleCode(code);
          await AsyncStorage.setItem("coupleCode", code);
        }
      } else if (current.key === "partnerCode") {
        const code = values.partnerCode.trim();
        const resp: any = await postCouple(code);
        const rawCid = resp?.memberName ?? resp?.coupleId ?? null;
        if (rawCid) await AsyncStorage.setItem("coupleId", String(rawCid));
      }

      if (step < steps.length - 1) {
        setStep(step + 1);
      } else {
        router.replace("/signup-finish");
      }
    } catch (e: any) {
      Alert.alert("오류", e?.message ?? "다시 시도해 주세요.");
    } finally {
      setIsPosting(false);
    }
  }, [canNext, isPosting, current.key, values, step, steps.length]);

  const onBack = useCallback(() => {
    if (step === 0) return router.back();
    setStep(step - 1);
  }, [step]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.headerContainer}>
          <View style={styles.iconRow}>
            <Image
              source={HEART_ICON}
              style={[styles.heartImage, { tintColor: current.accent }]}
            />
            <View style={styles.progressBarBg}>
              <Animated.View
                style={[
                  styles.progressBarFill,
                  {
                    width: progressAnim.interpolate({
                      inputRange: [0, 100],
                      outputRange: ["0%", "100%"],
                    }),
                    backgroundColor: current.accent,
                  },
                ]}
              />
            </View>
          </View>
          <AppText
            type="bold"
            style={[styles.title, { color: current.accent }]}
          >
            {current.title}
          </AppText>
          <AppText type="medium" style={styles.hintText}>
            {current.hint}
          </AppText>
        </View>

        <View>
          {current.key === "preferences" ? (
            <View>
              <AppText type="bold" style={styles.questionTitle}>
                평소 즐기는 활동은?
              </AppText>
              <View style={styles.chipContainer}>
                {HOBBIES.map((hobby) => {
                  const isSelected = selectedHobbies.includes(hobby);
                  return (
                    <TouchableOpacity
                      key={hobby}
                      style={[styles.chip, isSelected && styles.chipSelected]}
                      onPress={() =>
                        toggleSelection(
                          selectedHobbies,
                          setSelectedHobbies,
                          hobby,
                        )
                      }
                    >
                      <AppText
                        style={[
                          styles.chipText,
                          isSelected && styles.chipTextSelected,
                        ]}
                      >
                        {hobby}
                      </AppText>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <AppText
                type="bold"
                style={[styles.questionTitle, { marginTop: 40 }]}
              >
                상대방과 가장 하고 싶은 데이트는?
              </AppText>
              <View style={styles.chipContainer}>
                {DATE_STYLES.map((style) => {
                  const isSelected = selectedDateStyles.includes(style);
                  return (
                    <TouchableOpacity
                      key={style}
                      style={[styles.chip, isSelected && styles.chipSelected]}
                      onPress={() =>
                        toggleSelection(
                          selectedDateStyles,
                          setSelectedDateStyles,
                          style,
                        )
                      }
                    >
                      <AppText
                        style={[
                          styles.chipText,
                          isSelected && styles.chipTextSelected,
                        ]}
                      >
                        {style}
                      </AppText>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <AppText
                type="bold"
                style={[styles.questionTitle, { marginTop: 40 }]}
              >
                가장 사랑받는다고 느껴지는 순간은?
              </AppText>
              <View style={styles.chipContainer}>
                {LOVE_LANGUAGES.map((item) => {
                  const isSelected = selectedLoveLanguages.includes(item);
                  return (
                    <TouchableOpacity
                      key={item}
                      style={[
                        styles.chip,
                        isSelected && styles.chipSelected,
                        { width: "100%" },
                      ]}
                      onPress={() =>
                        toggleSelection(
                          selectedLoveLanguages,
                          setSelectedLoveLanguages,
                          item,
                        )
                      }
                    >
                      <AppText
                        style={[
                          styles.chipText,
                          isSelected && styles.chipTextSelected,
                        ]}
                      >
                        {item}
                      </AppText>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ) : current.key === "partnerCode" ? (
            <View
              style={[
                styles.codeStepContainer,
                { borderColor: current.accent },
              ]}
            >
              <View style={{ marginBottom: 50 }}>
                <AppText type="bold" style={styles.inputLabel}>
                  나의 코드
                </AppText>
                <View style={styles.myCodeRow}>
                  <View
                    style={[styles.grayInputBox, { flex: 1, marginRight: 10 }]}
                  >
                    <AppText
                      type="bold"
                      style={{ fontSize: 12, color: "#4D5053" }}
                    >
                      {myCoupleCode || "발급 중..."}
                    </AppText>
                  </View>
                  <TouchableOpacity
                    onPress={copyToClipboard}
                    style={styles.copyIconButton}
                  >
                    <Ionicons name="copy-outline" size={20} color="#6198FF" />
                  </TouchableOpacity>
                </View>
              </View>

              <View>
                <AppText type="bold" style={styles.inputLabel}>
                  상대방 코드 입력
                </AppText>
                <TextInput
                  placeholder={current.placeholder}
                  placeholderTextColor="#9CA3AF"
                  value={values.partnerCode}
                  onChangeText={(t) =>
                    setValues((s) => ({ ...s, partnerCode: t }))
                  }
                  autoCapitalize="none"
                  style={[
                    styles.grayInputBox,
                    {
                      fontFamily: "Paperlogy-7Bold",
                      fontSize: 12,
                      color: "#4D5053",
                    },
                  ]}
                />
              </View>

              <TouchableOpacity
                onPress={() => router.replace("/signup-finish")}
                style={{ marginTop: 16, alignItems: "center" }}
              >
                <AppText style={{ color: "#9CA3AF", fontSize: 12 }}>
                  나중에 연결할게요.{" "}
                  <AppText
                    style={{
                      textDecorationLine: "underline",
                      color: "#6B7280",
                    }}
                  >
                    건너뛰기
                  </AppText>
                </AppText>
              </TouchableOpacity>
            </View>
          ) : (
            <View
              style={[styles.currentCardBase, { borderColor: current.accent }]}
            >
              <InputField
                label={
                  current.key === "name"
                    ? "닉네임"
                    : current.key === "birthday"
                      ? "생년월일"
                      : "기념일"
                }
                value={
                  values[current.key as "name" | "birthday" | "anniversary"]
                }
                placeholder={current.placeholder}
                onChangeText={(t) => {
                  const isDateStep =
                    current.key === "birthday" || current.key === "anniversary";
                  const nextValue = isDateStep ? formatBirthDate(t) : t;
                  setValues((s) => ({ ...s, [current.key]: nextValue }));
                }}
                keyboardType={current.key === "name" ? "default" : "number-pad"}
                accentColor={current.accent}
              />
              {current.key === "birthday" && (
                <TouchableOpacity
                  onPress={() => setStep(step + 1)}
                  style={{ marginTop: 16, alignItems: "center" }}
                >
                  <AppText style={{ color: "#9CA3AF", fontSize: 12 }}>
                    입력 없이 넘어갈게요.{" "}
                    <AppText
                      style={{
                        textDecorationLine: "underline",
                        color: "#6B7280",
                      }}
                    >
                      건너뛰기
                    </AppText>
                  </AppText>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

        {current.key !== "partnerCode" && current.key !== "preferences" && (
          <View style={{ marginTop: 14 }}>
            {steps
              .slice(0, step)
              .filter((s) => s.key !== "preferences")
              .reverse()
              .map((s) => {
                const val =
                  values[s.key as "name" | "birthday" | "anniversary"];
                return (
                  <PastCard
                    key={s.key}
                    label={s.title.replace(" 입력", "")}
                    value={val}
                  />
                );
              })}
          </View>
        )}
      </ScrollView>

      <View style={styles.buttonContainer}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <AppText type="semibold" style={styles.backButtonText}>
            {step === 0 ? "닫기" : "이전"}
          </AppText>
        </TouchableOpacity>
        <TouchableOpacity
          disabled={!canNext || isPosting}
          onPress={onNext}
          style={[
            styles.nextButton,
            {
              backgroundColor:
                !canNext || isPosting ? "#D1D5DB" : current.accent,
            },
          ]}
        >
          <AppText type="bold" style={styles.nextButtonText}>
            {step < steps.length - 1 ? "다음" : "완료"}
          </AppText>
        </TouchableOpacity>
      </View>

      <Modal
        visible={dateErrorVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDateErrorVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View
              style={[styles.modalIconCircle, { backgroundColor: "#FFF0F0" }]}
            >
              <Ionicons name="alert-circle" size={32} color="#FF6B6B" />
            </View>
            <AppText type="bold" style={styles.modalTitle}>
              날짜 확인 필요
            </AppText>
            <AppText type="medium" style={styles.modalMessage}>
              입력하신 날짜가 올바르지 않습니다.{"\n"}다시 한번 확인해 주세요.
            </AppText>
            <Pressable
              style={[styles.modalButton, { backgroundColor: "#FF6B6B" }]}
              onPress={() => setDateErrorVisible(false)}
            >
              <AppText type="bold" style={styles.modalButtonText}>
                확인
              </AppText>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#FFFCF5" },
  scrollContent: { padding: 20, paddingBottom: 40 },
  headerContainer: { marginTop: 16, marginBottom: 30 },
  iconRow: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  heartImage: { width: 24, height: 24, resizeMode: "contain", marginRight: 10 },
  progressBarBg: {
    flex: 1,
    height: 6,
    backgroundColor: "#DDDDDD",
    borderRadius: 3,
  },
  progressBarFill: { height: "100%", borderRadius: 3 },
  title: { fontSize: 18, marginBottom: 6, marginLeft: 4 },
  hintText: { color: "#4D5053", fontSize: 11, lineHeight: 18 },
  currentCardBase: {
    borderWidth: 2,
    borderRadius: 16,
    padding: 20,
    backgroundColor: "transparent",
  },
  pastCardBase: {
    borderWidth: 2,
    borderColor: "#75787B",
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 14,
    marginTop: 10,
    justifyContent: "center",
  },
  pastCardLabel: { fontSize: 11, color: "#75787B", marginBottom: 4 },
  pastCardValue: { fontSize: 13, color: "#75787B" },
  inputLabel: { fontSize: 11, marginBottom: 8 },
  textInputBase: { padding: 0, fontSize: 15 },
  questionTitle: { fontSize: 14, color: "#6198FF", marginBottom: 16 },
  chipContainer: {
    borderWidth: 1,
    borderColor: "#6198FF",
    borderRadius: 16,
    padding: 16,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 10,
  },
  chip: {
    width: "48%",
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "#6B7280",
    borderRadius: 16,
    alignItems: "center",
    marginBottom: 4,
  },
  chipSelected: { backgroundColor: "#6198FF", borderColor: "#6198FF" },
  chipText: { fontSize: 14, color: "#4B5563" },
  chipTextSelected: { color: "#fff" },
  codeStepContainer: {
    padding: 20,
    paddingVertical: 35,
    borderWidth: 2,
    borderRadius: 16,
  },
  grayInputBox: {
    backgroundColor: "#E5E7EB",
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  buttonContainer: {
    padding: 20,
    gap: 10,
    flexDirection: "row",
    backgroundColor: "#FFFCF5",
  },
  backButton: {
    flex: 1,
    height: 52,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E5E7EB",
  },
  backButtonText: { color: "#6B7280", fontSize: 16 },
  nextButton: {
    flex: 2,
    height: 52,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  nextButtonText: { color: "#FFF", fontSize: 16 },
  myCodeRow: { flexDirection: "row", alignItems: "center" },
  copyIconButton: { padding: 12, backgroundColor: "#E5E7EB", borderRadius: 12 },

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
    elevation: 5,
  },
  modalIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
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
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 999,
  },
  modalButtonText: { color: "#FFF", fontSize: 15 },
});
