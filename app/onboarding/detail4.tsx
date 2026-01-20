// app/onboarding/detail4.tsx
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AppText from "../../components/AppText";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const AnimatedAppText = Animated.createAnimatedComponent(AppText);

export default function OnboardingDetail4() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { prevProgress } = useLocalSearchParams<{ prevProgress?: string }>();

  // --- 버튼 활성화 상태 추가 ---
  const [isReady, setIsReady] = useState(false);

  // 상단 바 애니메이션
  const startPct = prevProgress ? Number(prevProgress) : 0.62;
  const endPct = 0.83;
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

  const prog = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const t = setTimeout(() => {
      Animated.spring(prog, {
        toValue: 1,
        useNativeDriver: false,
        speed: 14,
        bounciness: 6,
      }).start(() => {
        setIsReady(true);
      });
    }, 500);
    return () => clearTimeout(t);
  }, [prog]);

  // 인터폴레이션 (기존 유지)
  const titleShootColor = prog.interpolate({
    inputRange: [0, 1],
    outputRange: ["#C8C8C8", "#000"],
  });
  const titleSendColor = prog.interpolate({
    inputRange: [0, 1],
    outputRange: ["#C8C8C8", "#6198FF"],
  });
  const titleRememberColor = prog.interpolate({
    inputRange: [0, 1],
    outputRange: ["#C8C8C8", "#000"],
  });
  const descColor = prog.interpolate({
    inputRange: [0, 1],
    outputRange: ["#CFCFCF", "#000"],
  });
  const btnBg = prog.interpolate({
    inputRange: [0, 1],
    outputRange: ["#CFCFCF", "#5F92FF"],
  });

  // 버블 페이드인 애니메이션
  const bubble1Opacity = useRef(new Animated.Value(0)).current;
  const bubble2Opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const t1 = setTimeout(() => {
      Animated.timing(bubble1Opacity, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }).start();
    }, 1000);

    const t2 = setTimeout(() => {
      Animated.timing(bubble2Opacity, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }).start();
    }, 1500);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [bubble1Opacity, bubble2Opacity]);

  const goNext = () => {
    if (!isReady) return;
    router.push("./finish");
  };

  return (
    <View style={styles.wrap}>
      {/* 1. 상단 바 */}
      <View style={styles.progressBarBg}>
        <Animated.View
          style={[styles.progressBarFill, { width: progressWidth }]}
        />
      </View>

      {/* 2. 중앙 버블 영역 (가변 공간) */}
      <View style={styles.centerContainer}>
        <View style={styles.bubblesArea}>
          <Animated.Image
            source={require("../../assets/images/bubble1.png")}
            style={[styles.bubble1, { opacity: bubble1Opacity }]}
            resizeMode="contain"
          />
          <Animated.Image
            source={require("../../assets/images/bubble2.png")}
            style={[styles.bubble2, { opacity: bubble2Opacity }]}
            resizeMode="contain"
          />
        </View>
      </View>

      {/* 3. 하단 통합 영역 (텍스트 + 버튼) */}
      <View style={[styles.bottomArea, { paddingBottom: insets.bottom + 32 }]}>
        <View style={styles.textBox}>
          <AppText style={styles.titleLine}>
            <Animated.Text style={[styles.bold20, { color: titleShootColor }]}>
              사진과 함께
            </Animated.Text>{" "}
            <Animated.Text style={[styles.bold20, { color: titleSendColor }]}>
              마음
            </Animated.Text>
            {""}
            <Animated.Text
              style={[styles.bold20, { color: titleRememberColor }]}
            >
              을 전해요
            </Animated.Text>
          </AppText>

          <AnimatedAppText
            type="light"
            style={[styles.desc, { color: descColor }]}
          >
            짧은 한마디로 더 가까워지는 대화
          </AnimatedAppText>
          <AnimatedAppText
            type="light"
            style={[styles.desc, { color: descColor }]}
          >
            <AppText type="bold">두 사람만의 공간</AppText>에서 이어지는 이야기
          </AnimatedAppText>
        </View>

        <Pressable onPress={goNext} disabled={!isReady} style={styles.btnWrap}>
          <Animated.View style={[styles.btn, { backgroundColor: btnBg }]}>
            <AppText type="bold" style={styles.btnText}>
              다음
            </AppText>
          </Animated.View>
        </Pressable>
      </View>
    </View>
  );
}

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

  // 중앙 영역 최적화
  centerContainer: {
    flex: 1,
    width: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  bubblesArea: {
    width: "100%",
    height: 350,
    alignItems: "center",
    justifyContent: "center",
  },
  bubble1: {
    position: "absolute",
    left: "10%",
    top: 0,
    width: 173,
    height: 168,
  },
  bubble2: {
    position: "absolute",
    right: "5%",
    bottom: 0,
    width: 243,
    height: 157,
  },

  // 하단 영역 최적화
  bottomArea: {
    width: "100%",
    alignItems: "center",
  },
  textBox: {
    alignItems: "center",
    paddingHorizontal: 20,
    marginBottom: 30,
  },
  titleLine: {
    textAlign: "center",
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
    color: "#fff",
  },
});
