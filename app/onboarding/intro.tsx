// app/onboarding/intro.tsx
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import AppText from '../../components/AppText';

const LINES = [
  '반갑습니다, 무무리입니다!',
  '무무리는 누구나 즐길 수 있는 사진 기반 커플 앱 입니다.',
  '지금부터 무무리에 대해 알려드릴게요!',
];

export default function OnboardingIntro() {
  const router = useRouter();
  const [activeIdx, setActiveIdx] = useState(0);
  const [buttonVisible] = useState(new Animated.Value(0));

  useEffect(() => {
    LINES.forEach((_, idx) => {
      if (idx === 0) return;
      setTimeout(() => {
        setActiveIdx(idx);
      }, idx * 1100);
    });

    const totalTime = (LINES.length - 1) * 1500 + 400;
    const timer = setTimeout(() => {
      Animated.timing(buttonVisible, {
        toValue: 1,
        duration: 350,
        useNativeDriver: true,
      }).start();
    }, totalTime);

    return () => clearTimeout(timer);
  }, [buttonVisible]);

  const goNext = () => {
    // 다음 온보딩이 있으면 '/onboarding/step2'
    // 바로 로그인/회원가입이면 '/(auth)'
    router.push('/(auth)');
  };

  const isDone = activeIdx === LINES.length - 1;

  return (
    <View style={styles.wrap}>
      <View style={styles.textBox}>
        {LINES.map((line, idx) => {
          const isPast = idx < activeIdx;
          const isCurrent = idx === activeIdx;
          return (
            <AppText
              key={idx}
              style={[
                styles.line,
                isPast && styles.pastLine,
                isCurrent && styles.currentLine,
              ]}
            >
              {line}
            </AppText>
          );
        })}
      </View>

      <Animated.View
        style={[
          styles.btnWrap,
          {
            opacity: buttonVisible,
            transform: [
              {
                translateY: buttonVisible.interpolate({
                  inputRange: [0, 1],
                  outputRange: [14, 0],
                }),
              },
            ],
          },
        ]}
      >
        <Pressable
          onPress={goNext}
          disabled={!isDone}
          style={[styles.btn, !isDone && { opacity: 0.5 }]}
        >
          <AppText type='bold' style={styles.btnText}>네!</AppText>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: '#FFFCF5',
    justifyContent: 'space-between',
    paddingBottom: 72,
  },
  textBox: {
    marginTop: 140,
    paddingHorizontal: 28,
    gap: 20,
  },
  line: {
    fontSize: 16,
    lineHeight: 22,
  },
  pastLine: {
    color: '#C4C4C4',
  },
  currentLine: {
    color: '#111',
  },
  btnWrap: {
    width: '100%',
    alignItems: 'center',
  },
  btn: {
    width: 124,
    height: 56,
    borderRadius: 999,
    backgroundColor: '#FF9191',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: {
    color: '#fff',
    fontSize: 16,
  },
});
