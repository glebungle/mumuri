// app/onboarding/finish.tsx
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Easing, // Image import 추가
  Pressable,
  StyleSheet,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppText from '../../components/AppText';

const AnimatedImage = Animated.Image;

// 공 이미지 경로 (프로젝트에 맞게 수정 필요)
const pinkBall = require('../../assets/images/ball_pink.png');
const greenBall = require('../../assets/images/ball_green.png');

// 공 데이터 배열 (초기 위치 및 크기)
const ballData = [
  { id: 1, initialX: 50, initialY: 250, size: 20 },
  { id: 2, initialX: 280, initialY: 180, size: 25 },
  { id: 3, initialX: 80, initialY: 500, size: 18 },
  { id: 4, initialX: 300, initialY: 580, size: 22 },
  { id: 5, initialX: 180, initialY: 100, size: 20 },
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
    outputRange: ['0%', '100%'],
  });

  // --- 캐릭터 회전 애니메이션 (gentle) ---
  const rotateVal = useRef(new Animated.Value(0)).current;
  // 공 애니메이션을 위한 값
  const ballAnimVal = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const gentleEasing = Easing.bezier(0.25, 0.1, 0.25, 1);

    const runAnimation = () => {
      Animated.sequence([
        // 1. 회전 시작 (0 -> 1) & 공 튕김 시작 (분홍 -> 초록으로 이동)
        Animated.parallel([
          Animated.timing(rotateVal, {
            toValue: 1,
            duration: 800,
            easing: gentleEasing,
            useNativeDriver: true,
          }),
          Animated.spring(ballAnimVal, {
            toValue: 1,
            friction: 4,
            tension: 80,
            useNativeDriver: true,
          }),
        ]),
        // 2. 초록색 상태 유지 (4초)
        Animated.delay(4000),

        // 3. 회전 복귀 (1 -> 0) & 공 복귀 (초록 -> 분홍으로 이동)
        Animated.parallel([
          Animated.timing(rotateVal, {
            toValue: 0,
            duration: 800,
            easing: gentleEasing,
            useNativeDriver: true,
          }),
          Animated.spring(ballAnimVal, {
            toValue: 0,
            friction: 4,
            tension: 80,
            useNativeDriver: true,
          }),
        ]),
        // 4. 분홍색 상태 유지 (4초)
        Animated.delay(4000),
      ]).start(() => runAnimation()); // 무한 반복
    };

    runAnimation();
  }, [rotateVal, ballAnimVal]);

  const characterRotate = rotateVal.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  const onStart = () => {
    router.replace('/(auth)');
  };

  return (
    <View style={styles.wrap}>
      {/* 상단 바 */}
      <View style={styles.progressBarBg}>
        <Animated.View style={[styles.progressBarFill, { width: progressWidth }]} />
      </View>

      {/* 공 애니메이션 */}
      {ballData.map((ball, index) => {
        // 각 공마다 다른 방향으로 튕기도록 설정 (예시)
        const moveX = ballAnimVal.interpolate({
          inputRange: [0, 1],
          outputRange: [0, (index % 2 === 0 ? 1 : -1) * ( 0 + index * 5)],
        });
        const moveY = ballAnimVal.interpolate({
          inputRange: [0, 1],
          outputRange: [0, (index % 3 === 0 ? -1 : 1) * (0+ index * 5)],
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
            {/* 분홍색 공 (기본) */}
            <Animated.Image
              source={pinkBall}
              style={[styles.ballImage, { opacity: pinkOpacity }]}
              resizeMode="contain"
            />
            {/* 초록색 공 (회전 시 나타남) */}
            <Animated.Image
              source={greenBall}
              style={[styles.ballImage, { opacity: greenOpacity, position: 'absolute' }]}
              resizeMode="contain"
            />
          </Animated.View>
        );
      })}

      {/* 캐릭터 */}
      <AnimatedImage
        source={require('../../assets/images/rotatecharacter.png')}
        resizeMode="contain"
        style={[
          styles.character,
          { transform: [{ rotate: characterRotate }] },
        ]}
      />

      {/* 텍스트 */}
      <View style={styles.textBox}>
        <AppText style={styles.title}>
          지금, <AppText style={styles.highlight}>무무리</AppText>와 함께
          {'\n'}시작해볼까요?
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
    backgroundColor: '#303030',
    alignItems: 'center',
  },
  progressBarBg: {
    height: 4,
    width: '88%',
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 999,
    marginTop: 54,
  },
  progressBarFill: {
    height: 4,
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
  },

  // 캐릭터
  character: {
    position: 'absolute',
    top: 210,
    width: 900,
    height: 1200,
    zIndex: 1, // 공보다 위에 오도록 설정
  },

  // 공 스타일
  ballContainer: {
    position: 'absolute',
    zIndex: 0, // 캐릭터 뒤에 위치
  },
  ballImage: {
    width: '100%',
    height: '100%',
  },

  textBox: {
    marginTop: 600,
    alignItems: 'center',
    paddingHorizontal: 30,
    zIndex: 2, // 텍스트가 가장 위에 오도록
  },
  title: {
    fontSize: 22,
    textAlign: 'center',
    color: '#FFFFFF',
    lineHeight: 32,
  },
  highlight: {
    color: '#63B5FF',
    fontSize: 22,
  },
  btnWrap: {
    position: 'absolute',
    width: '100%',
    alignItems: 'center',
    zIndex: 2,
  },
  btn: {
    backgroundColor: '#F38C8C',
    paddingHorizontal: 52,
    paddingVertical: 14,
    borderRadius: 999,
  },
  btnText: {
    color: '#fff',
    fontSize: 16,
  },
});