// app/onboarding/finish.tsx
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppText from '../../components/AppText';

export default function OnboardingFinish() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { prevProgress } = useLocalSearchParams<{ prevProgress?: string }>();

  const startPct = prevProgress ? Number(prevProgress) : 0.83;
  const endPct = 1; // 끝

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

  const onStart = () => {
    // 온보딩 끝 → 원하는 곳으로
    router.replace('/(auth)');
  };

  return (
    <View style={styles.wrap}>
      {/* 상단 바 (흰색으로 전부 채워짐) */}
      <View style={styles.progressBarBg}>
        <Animated.View style={[styles.progressBarFill, { width: progressWidth }]} />
      </View>

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
  textBox: {
    marginTop: 500,
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
  sub: {
    marginTop: 16,
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
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
