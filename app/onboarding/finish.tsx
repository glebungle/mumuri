// app/onboarding/finish.tsx
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useRef } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AppText from "../../components/AppText";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

const AnimatedImage = Animated.Image;

const pinkBall = require("../../assets/images/ball_pink.png");
const greenBall = require("../../assets/images/ball_green.png");

const ballData = [
  {
    id: 1,
    initialX: SCREEN_WIDTH * 0.1,
    initialY: SCREEN_HEIGHT * 0.2,
    size: 22,
  },
  {
    id: 2,
    initialX: SCREEN_WIDTH * 0.4,
    initialY: SCREEN_HEIGHT * 0.1,
    size: 18,
  },
  {
    id: 3,
    initialX: SCREEN_WIDTH * 0.8,
    initialY: SCREEN_HEIGHT * 0.18,
    size: 24,
  },
  {
    id: 4,
    initialX: SCREEN_WIDTH * 0.08,
    initialY: SCREEN_HEIGHT * 0.55,
    size: 20,
  },
  {
    id: 5,
    initialX: SCREEN_WIDTH * 0.85,
    initialY: SCREEN_HEIGHT * 0.62,
    size: 22,
  },
  {
    id: 6,
    initialX: SCREEN_WIDTH * 0.05,
    initialY: SCREEN_HEIGHT * 0.88,
    size: 24,
  },
];

export default function OnboardingFinish() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { prevProgress } = useLocalSearchParams<{ prevProgress?: string }>();

  const startPct = prevProgress ? Number(prevProgress) : 0.83;
  const endPct = 1;

  const topBar = useRef(new Animated.Value(startPct)).current;

  useEffect(() => {
    Animated.timing(topBar, {
      toValue: endPct,
      duration: 500,
      useNativeDriver: false,
    }).start();
  }, [topBar]);

  const progressWidth = topBar.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  });

  const rotateVal = useRef(new Animated.Value(0)).current;
  const ballAnimVal = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const gentleEasing = Easing.bezier(0.25, 0.1, 0.25, 1);

    const runAnimation = () => {
      Animated.sequence([
        Animated.parallel([
          Animated.timing(rotateVal, {
            toValue: 1,
            duration: 1200,
            easing: gentleEasing,
            useNativeDriver: true,
          }),
          Animated.spring(ballAnimVal, {
            toValue: 1,
            friction: 6,
            tension: 60,
            useNativeDriver: true,
          }),
        ]),

        Animated.delay(7000),

        Animated.parallel([
          Animated.timing(rotateVal, {
            toValue: 0,
            duration: 1200,
            easing: gentleEasing,
            useNativeDriver: true,
          }),
          Animated.spring(ballAnimVal, {
            toValue: 0,
            friction: 6,
            tension: 60,
            useNativeDriver: true,
          }),
        ]),

        Animated.delay(7000),
      ]).start(() => runAnimation());
    };

    runAnimation();
  }, [rotateVal, ballAnimVal]);

  const characterRotate = rotateVal.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "180deg"],
  });

  const onStart = async () => {
    try {
      await AsyncStorage.setItem("hasSeenOnboarding", "true");
      router.replace("/(auth)");
    } catch (e) {
      console.error("온보딩 상태 저장 실패:", e);
      router.replace("/(auth)");
    }
  };

  return (
    <View style={styles.wrap}>
      {/* 상단 바 */}
      <View style={styles.progressBarBg}>
        <Animated.View
          style={[styles.progressBarFill, { width: progressWidth }]}
        />
      </View>

      {/* 공 애니메이션 */}
      {ballData.map((ball, index) => {
        const moveX = ballAnimVal.interpolate({
          inputRange: [0, 1],
          outputRange: [0, (index % 2 === 0 ? 1 : -1) * (0 + index * 5)],
        });
        const moveY = ballAnimVal.interpolate({
          inputRange: [0, 1],
          outputRange: [0, (index % 3 === 0 ? -1 : 1) * (0 + index * 5)],
        });

        const pinkOpacity = ballAnimVal.interpolate({
          inputRange: [0, 0.4, 0.6, 1],
          outputRange: [0, 0, 1, 1], // 0일때 분홍, 1일때 투명
        });
        const greenOpacity = ballAnimVal.interpolate({
          inputRange: [0, 0.4, 0.6, 1],
          outputRange: [1, 1, 0, 0], // 0일때 투명, 1일때 초록
        });

        return (
          <Animated.View
            key={ball.id}
            style={[
              styles.ballContainer,
              {
                left: ball.initialX,
                top: ball.initialY,
                width: ball.size,
                height: ball.size,
                transform: [{ translateX: moveX }, { translateY: moveY }],
              },
            ]}
          >
            {/* 분홍색 공  */}
            <Animated.Image
              source={pinkBall}
              style={[styles.ballImage, { opacity: pinkOpacity }]}
              resizeMode="contain"
            />
            {/* 초록색 공 */}
            <Animated.Image
              source={greenBall}
              style={[
                styles.ballImage,
                { opacity: greenOpacity, position: "absolute" },
              ]}
              resizeMode="contain"
            />
          </Animated.View>
        );
      })}

      {/* 캐릭터 */}
      <AnimatedImage
        source={require("../../assets/images/rotatecharacter.png")}
        resizeMode="contain"
        style={[styles.character, { transform: [{ rotate: characterRotate }] }]}
      />

      {/* 텍스트 */}
      <View style={styles.textBox}>
        <AppText style={styles.title}>
          지금, <AppText style={styles.highlight}>무무리</AppText>와 함께
          {"\n"}시작해볼까요?
        </AppText>
      </View>

      {/* 시작 버튼 */}
      <Pressable
        onPress={onStart}
        style={[styles.btnWrap, { bottom: insets.bottom + 36 }]}
      >
        <View style={styles.btn}>
          <AppText type="bold" style={styles.btnText}>
            시작
          </AppText>
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: "#303030",
    alignItems: "center",
  },
  progressBarBg: {
    height: 4,
    width: "88%",
    backgroundColor: "rgba(255,255,255,0.25)",
    borderRadius: 999,
    marginTop: 54,
  },
  progressBarFill: {
    height: 4,
    backgroundColor: "#FFFFFF",
    borderRadius: 999,
  },

  // 캐릭터
  character: {
    position: "absolute",
    bottom: SCREEN_HEIGHT * -0.7,
    width: SCREEN_WIDTH * 0.9,
    height: SCREEN_HEIGHT * 1.5,
    zIndex: 1,
  },

  // 공 스타일
  ballContainer: {
    position: "absolute",
    zIndex: 2,
  },
  ballImage: {
    width: "100%",
    height: "100%",
  },

  textBox: {
    position: "absolute",
    bottom: SCREEN_HEIGHT * 0.17,
    alignItems: "center",
    paddingHorizontal: 30,
    zIndex: 2,
  },
  title: {
    fontSize: 22,
    textAlign: "center",
    color: "#FFFFFF",
    lineHeight: 32,
  },
  highlight: {
    color: "#63B5FF",
    fontSize: 22,
  },
  btnWrap: {
    position: "absolute",
    width: "100%",
    alignItems: "center",
    zIndex: 2,
  },
  btn: {
    backgroundColor: "#F38C8C",
    paddingHorizontal: 52,
    paddingVertical: 14,
    borderRadius: 999,
  },
  btnText: {
    color: "#fff",
    fontSize: 16,
  },
});
