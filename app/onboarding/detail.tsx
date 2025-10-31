// app/onboarding/detail.tsx
import { useRouter } from 'expo-router';
import React, { useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppText from '../../components/AppText';

export default function OnboardingDetail() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [overlayVisible, setOverlayVisible] = useState(true);
  const [isPage3, setIsPage3] = useState(false);

  const step = useRef(new Animated.Value(0)).current;
  const overlay = useRef(new Animated.Value(1)).current;

  const hideOverlay = () => {
    Animated.timing(overlay, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start(() => setOverlayVisible(false));
  };

  const goToPage3 = () => {
    setIsPage3(true);
    Animated.spring(step, {
      toValue: 1,
      useNativeDriver: true,
      speed: 14,
      bounciness: 9,
    }).start();
  };

  const goNextScreen = () => {
    router.push('./detail2'); // ← 여기로 이동
  };

  const characterTranslateY = step.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -30],
  });

  const bubbleOpacity = step.interpolate({
    inputRange: [0, 0.4, 1],
    outputRange: [1, 1, 0],
  });

  const bottomBoxOpacity = step.interpolate({
    inputRange: [0, 0.4, 1],
    outputRange: [0, 0, 1],
  });

  const confettiOpacity = step.interpolate({
    inputRange: [0, 0.2, 1],
    outputRange: [0, 0, 1],
  });

  const normalCharOpacity = step.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0],
  });
  const winkCharOpacity = step.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  const shotBtnOpacity = step.interpolate({
    inputRange: [0, 0.4, 1],
    outputRange: [1, 1, 0],
  });
  const nextBtnOpacity = step.interpolate({
    inputRange: [0, 0.4, 1],
    outputRange: [0, 0, 1],
  });

  return (
    <View style={styles.wrap}>
      <View style={styles.progressBarBg}>
        <View style={styles.progressBarFill} />
      </View>

      <Animated.View
        pointerEvents="none"
        style={[
          styles.characterWrap,
          { transform: [{ translateY: characterTranslateY }] },
        ]}
      >
        <Animated.Image
          source={require('../../assets/images/onboarding.png')}
          style={[styles.characterImg, { opacity: normalCharOpacity }]}
          resizeMode="contain"
        />
        <Animated.Image
          source={require('../../assets/images/onboarding_wink.png')}
          style={[
            styles.characterImg,
            styles.characterAbsolute,
            { opacity: winkCharOpacity },
          ]}
          resizeMode="contain"
        />
      </Animated.View>

      <Animated.View
        pointerEvents="none"
        style={[styles.bubble, { opacity: bubbleOpacity }]}
      >
        <AppText style={styles.bubbleText}>지금 보여주고 싶은 표정은?</AppText>
      </Animated.View>

      <Animated.View
        pointerEvents="none"
        style={[styles.bottomBox, { opacity: bottomBoxOpacity }]}
      >
        <AppText style={styles.title}>
          우리의 <AppText style={{ color: '#4C86FF' }}>오늘</AppText>을 담아보세요
        </AppText>
        <AppText style={styles.desc}>매일 새로운 질문이 도착해요</AppText>
        <AppText style={styles.desc}>
          질문에 맞는 순간을 <AppText style={{ fontWeight: '700' }}>카메라</AppText>로 찍어보세요
        </AppText>
      </Animated.View>

      <Animated.View
        pointerEvents="none"
        style={[styles.confettiLayer, { opacity: confettiOpacity }]}
      >
        <View style={[styles.dot, { top: 40, left: 40 }]} />
        <View style={[styles.dot, { top: 80, right: 50 }]} />
        <View style={[styles.dot, { top: 160, left: 120 }]} />
      </Animated.View>

      {/* 2페이지 버튼 */}
      <Pressable
        onPress={goToPage3}
        style={[styles.bottomPressable, { bottom: insets.bottom + 12 }]}
        pointerEvents={isPage3 ? 'none' : 'auto'}
      >
        <Animated.View style={[styles.shotBtn, { opacity: shotBtnOpacity }]}>
          <AppText type="bold" style={{ color: '#fff' }}>
            찰칵!
          </AppText>
        </Animated.View>
      </Pressable>

      {/* 3페이지 버튼 */}
      <Pressable
        onPress={goNextScreen}
        style={[styles.bottomPressable, { bottom: insets.bottom + 12 }]}
        pointerEvents={isPage3 ? 'auto' : 'none'}
      >
        <Animated.View style={[styles.nextBtn, { opacity: nextBtnOpacity }]}>
          <AppText type="bold" style={{ color: '#fff' }}>
            다음
          </AppText>
        </Animated.View>
      </Pressable>

      {overlayVisible && (
        <Animated.View style={[styles.overlay, { opacity: overlay }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={hideOverlay} />
          <View style={styles.overlayContent}>
            <AppText style={styles.ovTitle}>
              <AppText style={{ color: '#6198FF', fontSize: 48 }}>질문</AppText>에 맞춰{'\n'}
              <AppText style={{ color: '#49DC95', fontSize: 48 }}>사진</AppText>을{' '}
              <AppText style={{ color: '#FF9191', fontSize: 48 }}>찰칵</AppText>,{'\n'}
              따라해보세요!
            </AppText>
            <AppText style={styles.ovDesc}>*아무 곳이나 탭하면 시작합니다</AppText>
          </View>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: '#FFFCF5',
  },
  progressBarBg: {
    height: 4,
    width: '88%',
    backgroundColor: '#E3E7EB',
    borderRadius: 999,
    marginTop: 54,
    alignSelf: 'center',
  },
  progressBarFill: {
    height: 4,
    width: '35%',
    backgroundColor: '#6198FF',
    borderRadius: 999,
  },
  characterWrap: {
    marginTop: 28,
    width: '100%',
    alignItems: 'flex-start',
  },
  characterImg: {
    width: 420,
    height: 700,
    marginLeft: -80,
  },
  characterAbsolute: {
    position: 'absolute',
    left: 0,
  },
  bubble: {
    position: 'absolute',
    top: 330,
    left: '50%',
    transform: [{ translateX: -110 }],
    paddingHorizontal: 18,
    paddingVertical: 10,
    backgroundColor: '#000',
    borderRadius: 22,
    zIndex: 20,
  },
  bubbleText: {
    color: '#fff',
  },
  bottomBox: {
    position: 'absolute',
    bottom: 140,
    width: '100%',
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  desc: {
    fontSize: 13,
    color: '#888',
    textAlign: 'center',
  },
  confettiLayer: {
    position: 'absolute',
    top: 120,
    width: '100%',
    height: 240,
  },
  dot: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#49DC95',
  },
  bottomPressable: {
    position: 'absolute',
    width: '100%',
    alignItems: 'center',
    zIndex: 9999,
  },
  shotBtn: {
    backgroundColor: '#000',
    paddingHorizontal: 40,
    paddingVertical: 14,
    borderRadius: 999,
  },
  nextBtn: {
    backgroundColor: '#6198FF',
    paddingHorizontal: 50,
    paddingVertical: 14,
    borderRadius: 999,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10000,
  },
  overlayContent: {
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  ovTitle: {
    fontSize: 48,
    textAlign: 'center',
    color: '#333',
  },
  ovDesc: {
    marginTop: 14,
    fontSize: 12,
    color: '#777',
  },
});
