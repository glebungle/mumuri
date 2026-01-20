// app/onboarding/detail2.tsx
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react"; // useState 추가
import { Animated, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AppText from "../../components/AppText";

const AnimatedAppText = Animated.createAnimatedComponent(AppText);

export default function OnboardingDetail2() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { prevProgress } = useLocalSearchParams<{ prevProgress?: string }>();

  // --- 버튼 활성화 상태 추가 ---
  const [isReady, setIsReady] = useState(false);

  // --- 상단 바 애니메이션 ---
  const startPct = prevProgress ? Number(prevProgress) : 0.35;
  const endPct = 0.4;
  const topBar = useRef(new Animated.Value(startPct)).current;

  useEffect(() => {
    Animated.timing(topBar, {
      toValue: endPct,
      duration: 450,
      useNativeDriver: false,
    }).start();
  }, [topBar, endPct]);

  const progressWidth = topBar.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  });

  // --- 메인 애니메이션 (prog) ---
  const prog = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const t = setTimeout(() => {
      Animated.spring(prog, {
        toValue: 1,
        useNativeDriver: false,
        speed: 14,
        bounciness: 6,
      }).start(() => {
        // 애니메이션 완료 후 버튼 활성화
        setIsReady(true);
      });
    }, 500);
    return () => clearTimeout(t);
  }, [prog]);

  // 인터폴레이션 (기존과 동일)
  const cardBg = prog.interpolate({
    inputRange: [0, 1],
    outputRange: ["#BFBFBF", "#5F92FF"],
  });
  const cardRotate = prog.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "11deg"],
  });
  const cardScale = prog.interpolate({
    inputRange: [0, 1],
    outputRange: [0.8, 1],
  });
  const titleShootColor = prog.interpolate({
    inputRange: [0, 1],
    outputRange: ["#C8C8C8", "#FF7777"],
  });
  const titleSendColor = prog.interpolate({
    inputRange: [0, 1],
    outputRange: ["#C8C8C8", "#3BCF8F"],
  });
  const titleRememberColor = prog.interpolate({
    inputRange: [0, 1],
    outputRange: ["#C8C8C8", "#5F92FF"],
  });
  const descColor = prog.interpolate({
    inputRange: [0, 1],
    outputRange: ["#CFCFCF", "#000"],
  });
  const btnBg = prog.interpolate({
    inputRange: [0, 1],
    outputRange: ["#CFCFCF", "#5F92FF"],
  });
  const letterRotate = prog.interpolate({
    inputRange: [0, 1],
    outputRange: ["-6deg", "6deg"],
  });
  const letterScale = prog.interpolate({
    inputRange: [0, 1],
    outputRange: [0.8, 1],
  });

  const goNext = () => {
    if (!isReady) return; // 안전장치
    router.push("./detail3");
  };

  return (
    <View style={styles.wrap}>
      {/* 1. 상단 바 영역 */}
      <View style={styles.progressBarBg}>
        <Animated.View
          style={[styles.progressBarFill, { width: progressWidth }]}
        />
      </View>

      {/* 2. 중앙 컨텐츠 영역 (flex: 1로 남는 공간 차지) */}
      <View style={styles.centerContainer}>
        <Animated.View
          style={[
            styles.card,
            {
              backgroundColor: cardBg,
              transform: [{ rotate: cardRotate }, { scale: cardScale }],
            },
          ]}
        >
          <Animated.Image
            source={require("../../assets/images/letterback.png")}
            style={[styles.letterBack, { transform: [{ scale: letterScale }] }]}
            resizeMode="contain"
          />
          <Animated.Image
            source={require("../../assets/images/letter.png")}
            style={[
              styles.letterPaper,
              {
                transform: [{ rotate: letterRotate }, { scale: letterScale }],
              },
            ]}
            resizeMode="contain"
          />
          <Animated.Image
            source={require("../../assets/images/letterfront.png")}
            style={[
              styles.letterFront,
              { transform: [{ scale: letterScale }] },
            ]}
            resizeMode="contain"
          />
        </Animated.View>
      </View>

      {/* 3. 하단 영역 (텍스트 + 버튼) */}
      <View style={[styles.bottomArea, { paddingBottom: insets.bottom + 32 }]}>
        <View style={styles.textBox}>
          <AppText style={styles.titleLine}>
            <Animated.Text style={[styles.bold20, { color: titleShootColor }]}>
              찍고,
            </Animated.Text>{" "}
            <Animated.Text style={[styles.bold20, { color: titleSendColor }]}>
              보내고,
            </Animated.Text>{" "}
            <Animated.Text
              style={[styles.bold20, { color: titleRememberColor }]}
            >
              기억해요
            </Animated.Text>
          </AppText>

          <AnimatedAppText
            type="light"
            style={[styles.desc, { color: descColor }]}
          >
            촬영한 사진을 <AppText type="bold">사랑하는 사람에게 전달</AppText>
            해보세요
          </AnimatedAppText>
          <AnimatedAppText
            type="light"
            style={[styles.desc, { color: descColor }]}
          >
            무무리는 서로의 하루가 됩니다
          </AnimatedAppText>
        </View>

        {/* 버튼: isReady가 false일 때 disabled 처리 */}
        <Pressable onPress={goNext} disabled={!isReady} style={styles.btnWrap}>
          <Animated.View style={[styles.btn, { backgroundColor: btnBg }]}>
            <Animated.Text
              style={[
                styles.btnText,
                { color: "#fff", fontFamily: "Paperlogy-7Bold" },
              ]}
            >
              다음
            </Animated.Text>
          </Animated.View>
        </Pressable>
      </View>
    </View>
  );
}

const CARD_SIZE = 210;

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: "#FFFCF5",
    alignItems: "center",
  },
  progressBarBg: {
    height: 4,
    width: "88%",
    backgroundColor: "#E3E7EB",
    borderRadius: 999,
    marginTop: 54,
  },
  progressBarFill: {
    height: 4,
    backgroundColor: "#5F92FF",
    borderRadius: 999,
  },
  centerContainer: {
    flex: 1, // 중요: 상단바와 하단영역 사이의 모든 공간을 차지
    justifyContent: "center",
    alignItems: "center",
  },
  card: {
    width: CARD_SIZE,
    height: CARD_SIZE,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  letterBack: {
    marginBottom: 85,
    position: "absolute",
    width: CARD_SIZE * 0.8,
    height: CARD_SIZE * 1.1,
  },
  letterPaper: {
    position: "absolute",
    width: CARD_SIZE * 0.8,
    height: CARD_SIZE * 0.8,
    top: CARD_SIZE * 0.02,
  },
  letterFront: {
    position: "absolute",
    width: CARD_SIZE * 0.8,
    height: CARD_SIZE * 0.9,
    bottom: CARD_SIZE * 0.02,
  },
  bottomArea: {
    // position: "absolute" 대신 자연스럽게 바닥에 위치하게 할 수도 있지만,
    // 기존 디자인 유지를 위해 유지하되 내부 간격을 확실히 함
    width: "100%",
    alignItems: "center",
  },
  textBox: {
    alignItems: "center",
    paddingHorizontal: 20,
    marginBottom: 30, // 버튼과의 간격 확보
  },
  titleLine: {
    textAlign: "center",
    marginBottom: 8,
  },
  bold20: {
    fontSize: 20,
  },
  desc: {
    marginTop: 6,
    fontSize: 13,
    textAlign: "center",
  },
  btnWrap: {
    width: "100%",
    alignItems: "center",
  },
  btn: {
    width: 140,
    height: 56,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  btnText: {
    fontSize: 17,
  },
});
