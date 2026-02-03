// app/onboarding/detail.tsx
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Image,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AppText from "../../components/AppText";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

const onboardingImg = require("../../assets/images/onboarding.png");
const onboardingWinkImg = require("../../assets/images/onboarding_wink.png");
const onboardingBgImg = require("../../assets/images/onboardingbg.png");
const arrowImg = require("../../assets/images/Arrow.png");

export default function OnboardingDetail() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { prevProgress } = useLocalSearchParams<{ prevProgress?: string }>();

  // 진행 바
  const startPct = prevProgress ? Number(prevProgress) : 0;
  const endPct = 0.2;
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

  // 화면 상태
  const [overlayVisible, setOverlayVisible] = useState(true);
  const [isPage3, setIsPage3] = useState(false);

  // 메인 애니메이션 값 (0 -> 1)
  const step = useRef(new Animated.Value(0)).current;
  const overlay = useRef(new Animated.Value(1)).current;

  const hideOverlay = () => {
    Animated.timing(overlay, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start(() => setOverlayVisible(false));
  };

  // 2 → 3 페이지 전환 액션
  const goToPage3 = () => {
    setIsPage3(true);
    Animated.spring(step, {
      toValue: 1,
      useNativeDriver: true,
      speed: 12,
      bounciness: 8,
    }).start();
  };

  const goNextScreen = () => {
    router.push({
      pathname: "./detail2",
      params: { prevProgress: String(endPct) },
    });
  };

  // --- 애니메이션 인터폴레이션 ---

  // 1. 캐릭터 관련
  const charRotate = step.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "8deg"],
  });
  const charNormalOpacity = step.interpolate({
    inputRange: [0, 0.2],
    outputRange: [1, 0],
  });
  const charWinkOpacity = step.interpolate({
    inputRange: [0, 0.2],
    outputRange: [0, 1],
  });

  // 2. 배경/사각형 관련
  const bgOpacity = step.interpolate({
    inputRange: [0, 0.3],
    outputRange: [0, 1],
  });
  const bgScale = step.interpolate({
    inputRange: [0, 0.3],
    outputRange: [0.9, 1],
  });

  // 3. 초록 점

  const dot1X = step.interpolate({ inputRange: [0, 1], outputRange: [0, -70] });
  const dot1Y = step.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -110],
  });

  const dot2X = step.interpolate({ inputRange: [0, 1], outputRange: [0, 0] });
  const dot2Y = step.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -140],
  });

  const dot3X = step.interpolate({ inputRange: [0, 1], outputRange: [0, 80] });
  const dot3Y = step.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -100],
  });

  const dot4X = step.interpolate({ inputRange: [0, 1], outputRange: [0, 110] });
  const dot4Y = step.interpolate({ inputRange: [0, 1], outputRange: [0, -30] });

  const dot5X = step.interpolate({ inputRange: [0, 1], outputRange: [0, 70] });
  const dot5Y = step.interpolate({ inputRange: [0, 1], outputRange: [0, 60] });

  const dot6X = step.interpolate({ inputRange: [0, 1], outputRange: [0, -20] });
  const dot6Y = step.interpolate({ inputRange: [0, 1], outputRange: [0, 100] });

  const dot7X = step.interpolate({ inputRange: [0, 1], outputRange: [0, -80] });
  const dot7Y = step.interpolate({ inputRange: [0, 1], outputRange: [0, 50] });

  const dot8X = step.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -100],
  });
  const dot8Y = step.interpolate({ inputRange: [0, 1], outputRange: [0, -40] });

  const dotScale = step.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, 1.2, 1],
  });

  // 4. 기타 UI 요소
  const bubbleOpacity = step.interpolate({
    inputRange: [0, 0.4, 1],
    outputRange: [1, 1, 1],
  });
  const bottomBoxOpacity = step.interpolate({
    inputRange: [0.3, 1],
    outputRange: [0, 1],
  });
  const shotBtnOpacity = step.interpolate({
    inputRange: [0, 0.2],
    outputRange: [1, 0],
  });
  const nextBtnOpacity = step.interpolate({
    inputRange: [0.3, 1],
    outputRange: [0, 1],
  });

  return (
    <View style={styles.wrap}>
      {/* 상단 진행바 */}
      <View style={styles.progressBarBg}>
        <Animated.View
          style={[styles.progressBarFill, { width: progressWidth }]}
        />
      </View>

      <View style={styles.contentContainer}>
        <View style={styles.confettiContainer}>
          <Animated.View
            style={[
              styles.dot,
              {
                transform: [
                  { translateX: dot1X },
                  { translateY: dot1Y },
                  { scale: dotScale },
                ],
              },
            ]}
          />
          <Animated.View
            style={[
              styles.dot,
              {
                transform: [
                  { translateX: dot2X },
                  { translateY: dot2Y },
                  { scale: dotScale },
                ],
              },
            ]}
          />
          <Animated.View
            style={[
              styles.dot,
              {
                transform: [
                  { translateX: dot3X },
                  { translateY: dot3Y },
                  { scale: dotScale },
                ],
              },
            ]}
          />
          <Animated.View
            style={[
              styles.dot,
              {
                transform: [
                  { translateX: dot4X },
                  { translateY: dot4Y },
                  { scale: dotScale },
                ],
              },
            ]}
          />
          <Animated.View
            style={[
              styles.dot,
              {
                transform: [
                  { translateX: dot5X },
                  { translateY: dot5Y },
                  { scale: dotScale },
                ],
              },
            ]}
          />
          <Animated.View
            style={[
              styles.dot,
              {
                transform: [
                  { translateX: dot6X },
                  { translateY: dot6Y },
                  { scale: dotScale },
                ],
              },
            ]}
          />
          <Animated.View
            style={[
              styles.dot,
              {
                transform: [
                  { translateX: dot7X },
                  { translateY: dot7Y },
                  { scale: dotScale },
                ],
              },
            ]}
          />
          <Animated.View
            style={[
              styles.dot,
              {
                transform: [
                  { translateX: dot8X },
                  { translateY: dot8Y },
                  { scale: dotScale },
                ],
              },
            ]}
          />
        </View>

        {/* 배경 및 사각형 이미지 */}
        <Animated.Image
          source={onboardingBgImg}
          style={[
            styles.bgImage,
            { opacity: bgOpacity, transform: [{ scale: bgScale }] },
          ]}
          resizeMode="contain"
        />

        {/* 캐릭터 컨테이너 */}
        <Animated.View
          style={[
            styles.characterContainer,
            { transform: [{ rotate: charRotate }] },
          ]}
        >
          {/* 기본 캐릭터 */}
          <Animated.Image
            source={onboardingImg}
            style={[styles.characterImage, { opacity: charNormalOpacity }]}
            resizeMode="contain"
          />
          <Animated.Image
            source={onboardingWinkImg}
            style={[
              styles.characterImage,
              styles.absoluteFill,
              { opacity: charWinkOpacity },
            ]}
            resizeMode="contain"
          />
        </Animated.View>
      </View>

      <Animated.View
        pointerEvents="none"
        style={[styles.bubble, { opacity: bubbleOpacity }]}
      >
        <AppText style={styles.bubbleText}>지금 보여주고 싶은 표정은?</AppText>
      </Animated.View>

      {/* 3페이지 설명 텍스트 */}
      <Animated.View
        pointerEvents="none"
        style={[styles.bottomBox, { opacity: bottomBoxOpacity }]}
      >
        <AppText style={styles.title}>
          우리의{" "}
          <AppText style={{ color: "#6198FF", fontSize: 20 }}>오늘</AppText>을
          담아보세요
        </AppText>
        <AppText type="light" style={styles.desc}>
          매일 새로운 질문이 도착해요
        </AppText>
        <AppText type="light" style={styles.desc}>
          질문에 맞는 순간을{" "}
          <AppText type="bold" style={{ color: "#000" }}>
            카메라
          </AppText>
          로 찍어보세요
        </AppText>
      </Animated.View>

      {/* 2페이지 버튼 */}
      <Pressable
        onPress={goToPage3}
        style={[styles.bottomPressable, { bottom: insets.bottom + 12 }]}
        pointerEvents={isPage3 ? "none" : "auto"}
      >
        <Animated.View style={[styles.shotBtn, { opacity: shotBtnOpacity }]}>
          <AppText type="bold" style={{ color: "#fff" }}>
            찰칵!
          </AppText>
        </Animated.View>
      </Pressable>

      {/* 2페이지 화살표 (Arrow) */}
      <Animated.View
        pointerEvents="none"
        style={[styles.arrow, { opacity: shotBtnOpacity }]}
      >
        <Image
          source={arrowImg}
          style={{ width: "100%", height: "100%" }}
          resizeMode="contain"
        />
      </Animated.View>

      {/* 3페이지 버튼 (다음) */}
      <Pressable
        onPress={goNextScreen}
        style={[styles.bottomPressable, { bottom: insets.bottom + 12 }]}
        pointerEvents={isPage3 ? "auto" : "none"}
      >
        <Animated.View style={[styles.nextBtn, { opacity: nextBtnOpacity }]}>
          <AppText type="bold" style={{ color: "#fff" }}>
            다음
          </AppText>
        </Animated.View>
      </Pressable>

      {/* 첫 오버레이 */}
      {overlayVisible && (
        <Animated.View style={[styles.overlay, { opacity: overlay }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={hideOverlay} />
          <View style={styles.overlayContent}>
            <AppText style={styles.ovTitle}>
              <AppText style={{ color: "#6198FF", fontSize: 48 }}>질문</AppText>
              에 맞춰{"\n"}
              <AppText style={{ color: "#49DC95", fontSize: 48 }}>사진</AppText>
              을{" "}
              <AppText style={{ color: "#FF9191", fontSize: 48 }}>찰칵</AppText>
              ,{"\n"}
              따라해보세요!
            </AppText>
            <AppText style={styles.ovDesc}>
              *아무 곳이나 탭하면 시작합니다
            </AppText>
          </View>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: "#FFFCF5",
  },
  progressBarBg: {
    height: 4,
    width: "88%",
    backgroundColor: "#E3E7EB",
    borderRadius: 999,
    marginTop: 54,
    alignSelf: "center",
    zIndex: 10,
  },
  progressBarFill: {
    height: 4,
    backgroundColor: "#6198FF",
    borderRadius: 999,
  },
  // 메인 컨텐츠 영역
  contentContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    marginTop: -60,
  },
  characterContainer: {
    width: 500,
    height: 700,
    alignItems: "center",
    justifyContent: "center",
    left: -70,
    bottom: -50,
    zIndex: 5,
  },
  characterImage: {
    width: "100%",
    height: "100%",
  },
  bgImage: {
    position: "absolute",
    width: "90%",
    height: "100%",
    top: -10,
    zIndex: 6,
  },
  absoluteFill: {
    position: "absolute",
    top: 0,
    left: 0,
  },
  confettiContainer: {
    position: "absolute",
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 3,
  },
  dot: {
    position: "absolute",
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#49DC95",
  },
  bubble: {
    position: "absolute",
    top: "60%",
    right: "10%",
    alignSelf: "center",
    paddingHorizontal: 18,
    paddingVertical: 10,
    backgroundColor: "#000",
    borderRadius: 22,
    zIndex: 20,
  },
  bubbleText: {
    color: "#fff",
    fontSize: 14,
  },
  bottomBox: {
    position: "absolute",
    bottom: SCREEN_HEIGHT * 0.17,
    width: "100%",
    alignItems: "center",
    zIndex: 10,
  },
  title: {
    fontSize: 20,
    color: "#333",
    marginBottom: 8,
    textAlign: "center",
  },
  desc: {
    fontSize: 13,
    color: "#000",
    textAlign: "center",
    lineHeight: 22,
  },
  bottomPressable: {
    position: "absolute",
    width: "100%",
    alignItems: "center",
    zIndex: 30,
  },
  shotBtn: {
    backgroundColor: "#000",
    paddingHorizontal: 48,
    paddingVertical: 12,
    borderRadius: 999,
    marginBottom: 20,
  },
  nextBtn: {
    backgroundColor: "#6198FF",
    paddingHorizontal: 48,
    paddingVertical: 12,
    borderRadius: 999,
    marginBottom: 20,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255,255,255,0.92)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 100,
  },
  overlayContent: {
    alignItems: "center",
    paddingHorizontal: 32,
  },
  ovTitle: {
    fontSize: 40,
    lineHeight: 50,
    textAlign: "center",
    color: "#333",
  },
  ovDesc: {
    marginTop: 20,
    fontSize: 13,
    color: "#888",
  },
  arrow: {
    position: "absolute",
    bottom: SCREEN_HEIGHT * 0.17,
    right: SCREEN_WIDTH * 0.2,
    alignSelf: "center",
    width: 80,
    height: SCREEN_HEIGHT * 0.2,
    zIndex: 19,
  },
});
