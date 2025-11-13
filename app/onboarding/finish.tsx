// app/onboarding/finish.tsx
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppText from '../../components/AppText';

const AnimatedImage = Animated.Image;

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

  useEffect(() => {
    const gentleEasing = Easing.bezier(0.25, 0.1, 0.25, 1); // 피그마 gentle 느낌에 가까운 곡선

    Animated.loop(
      Animated.sequence([
        // 0deg → 180deg
        Animated.timing(rotateVal, {
          toValue: 1,
          duration: 800,          // 좀 더 길게, 부드럽게
          easing: gentleEasing,    // ✅ 부드러운 곡선
          useNativeDriver: true,
        }),
        Animated.delay(4000),       // 살짝 쉬었다가
        // 180deg → 0deg
        Animated.timing(rotateVal, {
          toValue: 0,
          duration: 800,
          easing: gentleEasing,    // ✅ 돌아올 때도 동일 easing
          useNativeDriver: true,
        }),
        Animated.delay(4000),
      ])
    ).start();
  }, [rotateVal]);

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
  },

  textBox: {
    marginTop: 600,
    alignItems: 'center',
    paddingHorizontal: 30,
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
