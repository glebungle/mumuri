// app/onboarding/detail2.tsx
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppText from '../../components/AppText';

const AnimatedAppText = Animated.createAnimatedComponent(AppText);

export default function OnboardingDetail2() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { prevProgress } = useLocalSearchParams<{ prevProgress?: string }>();

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
    outputRange: ['0%', '100%'],
  });

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

  const cardBg = prog.interpolate({
    inputRange: [0, 1],
    outputRange: ['#BFBFBF', '#5F92FF'],
  });
  const cardRotate = prog.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '-11deg'],
  });
  const cardScale = prog.interpolate({
    inputRange: [0, 1],
    outputRange: [0.8, 1],
  });

  const titleShootColor = prog.interpolate({
    inputRange: [0, 1],
    outputRange: ['#C8C8C8', '#FF7777'],
  });
  const titleSendColor = prog.interpolate({
    inputRange: [0, 1],
    outputRange: ['#C8C8C8', '#3BCF8F'],
  });
  const titleRememberColor = prog.interpolate({
    inputRange: [0, 1],
    outputRange: ['#C8C8C8', '#5F92FF'],
  });

  const descColor = prog.interpolate({
    inputRange: [0, 1],
    outputRange: ['#CFCFCF', '#000'],
  });

  const btnBg = prog.interpolate({
    inputRange: [0, 1],
    outputRange: ['#CFCFCF', '#5F92FF'],
  });
  const btnTextColor = prog.interpolate({
    inputRange: [0, 1],
    outputRange: ['#fff', '#fff'],
  });

  const goNext = () => {
    router.push('./detail3');
  };

  return (
    <View style={styles.wrap}>
      {/* 상단 바 */}
      <View style={styles.progressBarBg}>
        <Animated.View style={[styles.progressBarFill, { width: progressWidth }]} />
      </View>

      {/* 가운데 카드 */}
      <Animated.View
        style={[
          styles.card,
          {
            backgroundColor: cardBg,
            transform: [{ rotate: cardRotate }, { scale: cardScale }],
          },
        ]}
      />

      {/* 텍스트 영역 */}
      <View style={styles.textBox}>
        <AppText style={styles.titleLine}>
          <Animated.Text style={[styles.bold20, { color: titleShootColor }]}>
            찍고,
          </Animated.Text>{' '}
          <Animated.Text style={[styles.bold20, { color: titleSendColor }]}>
            보내고,
          </Animated.Text>{' '}
          <Animated.Text style={[styles.bold20, { color: titleRememberColor }]}>
            기억해요
          </Animated.Text>
        </AppText>

        <AnimatedAppText
          type="light"
          style={[styles.desc, { color: descColor }]}
        >
          촬영한 사진을{' '}
          <AppText type="bold">사랑하는 사람에게 전달</AppText>
          해보세요
        </AnimatedAppText>

        <AnimatedAppText
          type="light"
          style={[styles.desc, { color: descColor }]}
        >
          무무리는 서로의 하루가 됩니다
        </AnimatedAppText>
      </View>

      {/* 버튼 */}
      <Pressable
        onPress={goNext}
        style={[styles.btnWrap, { bottom: insets.bottom + 32 }]}
      >
        <Animated.View style={[styles.btn, { backgroundColor: btnBg }]}>
          <Animated.Text style={[styles.btnText, { color: btnTextColor }]}>
            다음
          </Animated.Text>
        </Animated.View>
      </Pressable>
    </View>
  );
}

const CARD_SIZE = 210;

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
  card: {
    width: CARD_SIZE,
    height: CARD_SIZE,
    marginTop: 80,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textBox: {
    marginTop: 320,
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  titleLine: {
    textAlign: 'center',
  },
  bold20: {
    fontSize: 20,
  },
  desc: {
    marginTop: 6,
    fontSize: 16,
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
    fontWeight: '700',
    fontSize: 17,
  },
});
