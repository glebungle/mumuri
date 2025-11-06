// app/onboarding/detail2.tsx
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppText from '../../components/AppText';

// 🔥 AppText를 애니메이션 가능하게
const AnimatedAppText = Animated.createAnimatedComponent(AppText);

export default function OnboardingDetail2() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { prevProgress } = useLocalSearchParams<{ prevProgress?: string }>();

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
    outputRange: ['0%', '100%'],
  });

  // 색 전환용
  const prog = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const t = setTimeout(() => {
      Animated.spring(prog, {
        toValue: 1,
        useNativeDriver: false,
        speed: 14,
        bounciness: 6,
      }).start();
    }, 500);
    return () => clearTimeout(t);
  }, [prog]);

  const titleShootColor = prog.interpolate({
    inputRange: [0, 1],
    outputRange: ['#C8C8C8', '#000'],
  });
  const titleSendColor = prog.interpolate({
    inputRange: [0, 1],
    outputRange: ['#C8C8C8', '#6198FF'],
  });
  const titleRememberColor = prog.interpolate({
    inputRange: [0, 1],
    outputRange: ['#C8C8C8', '#000'],
  });

  const descColor = prog.interpolate({
    inputRange: [0, 1],
    outputRange: ['#CFCFCF', '#000'],
  });

  const btnBg = prog.interpolate({
    inputRange: [0, 1],
    outputRange: ['#CFCFCF', '#5F92FF'],
  });

  const goNext = () => {
    router.push('./finish');
  };

  return (
    <View style={styles.wrap}>
      {/* 상단 바 */}
      <View style={styles.progressBarBg}>
        <Animated.View style={[styles.progressBarFill, { width: progressWidth }]} />
      </View>

      {/* 텍스트 영역 */}
      <View style={styles.textBox}>
        <AppText style={styles.titleLine}>
          <Animated.Text style={[styles.bold20, { color: titleShootColor }]}>
            사진과 함께
          </Animated.Text>{' '}
          <Animated.Text style={[styles.bold20, { color: titleSendColor }]}>
            마음
          </Animated.Text>{' '}
          <Animated.Text style={[styles.bold20, { color: titleRememberColor }]}>
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

      {/* 버튼 */}
      <Pressable
        onPress={goNext}
        style={[styles.btnWrap, { bottom: insets.bottom + 32 }]}
      >
        <Animated.View style={[styles.btn, { backgroundColor: btnBg }]}>
          <AppText type="bold" style={styles.btnText}>
            다음
          </AppText>
        </Animated.View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: '#FFFCF5',
    alignItems: 'center',
  },
  progressBarBg: {
    height: 4,
    width: '88%',
    backgroundColor: '#E3E7EB',
    borderRadius: 999,
    marginTop: 54,
  },
  progressBarFill: {
    height: 4,
    backgroundColor: '#5F92FF',
    borderRadius: 999,
  },
  textBox: {
    marginTop: 520,
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  titleLine: {
    textAlign: 'center',
  },
  bold20: {
    fontSize: 20,
  },
  desc: {
    marginTop: 6,
    fontSize: 15,
    textAlign: 'center',
  },
  btnWrap: {
    position: 'absolute',
    width: '100%',
    alignItems: 'center',
  },
  btn: {
    width: 140,
    height: 56,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: {
    fontSize: 17,
    color: '#fff',
  },
});
