// app/onboarding/detail2.tsx
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, Image, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppText from '../../components/AppText';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const imgFrame = require('../../assets/images/frame.png');
const imgCh1 = require('../../assets/images/ch1.png');
const imgCh2 = require('../../assets/images/ch2.png');
const imgCh3 = require('../../assets/images/ch3.png');

const charImages = [imgCh1, imgCh2, imgCh3];

const AnimatedAppText = Animated.createAnimatedComponent(AppText);

export default function OnboardingDetail2() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { prevProgress } = useLocalSearchParams<{ prevProgress?: string }>();

  // 1. 상단 프로그래스바
  const startPct = prevProgress ? Number(prevProgress) : 0.35;
  const endPct = 0.62;
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

  // 2. 텍스트/버튼 등장
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

  const titleShootColor = prog.interpolate({ inputRange: [0, 1], outputRange: ['#C8C8C8', '#000'] });
  const titleSendColor = prog.interpolate({ inputRange: [0, 1], outputRange: ['#C8C8C8', '#FF7777'] });
  const titleRememberColor = prog.interpolate({ inputRange: [0, 1], outputRange: ['#C8C8C8', '#000'] });
  const descColor = prog.interpolate({ inputRange: [0, 1], outputRange: ['#CFCFCF', '#000'] });
  const btnBg = prog.interpolate({ inputRange: [0, 1], outputRange: ['#CFCFCF', '#5F92FF'] });

  // ---------------------------------------------------------
  // 3. 동기화된 애니메이션 로직 (렉 & 깜빡임 수정)
  // ---------------------------------------------------------

  const [charIndex, setCharIndex] = useState(0);
  
  const fadeAnim = useRef(new Animated.Value(1)).current; // 투명도
  const rotateVal = useRef(new Animated.Value(-1)).current; // 각도 제어

  useEffect(() => {
    let isMounted = true; 

    const runSyncAnimation = (nextIndex: number) => {
      if (!isMounted) return;

      // 1단계: Fade Out (캐릭터 사라짐)
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: false,
      }).start(() => {

        setCharIndex(nextIndex);

        let targetAngleValue = 0;
        // 각도 매핑: 0번(좌) -> 1번(우) -> 2번(정면)
        if (nextIndex === 0) targetAngleValue = -1; 
        if (nextIndex === 1) targetAngleValue = 0;  
        if (nextIndex === 2) targetAngleValue = 1;  

        // 50ms 딜레이: 화면이 그려진 뒤에 애니메이션 시작
        setTimeout(() => {
          if (!isMounted) return;

          Animated.parallel([
            Animated.spring(rotateVal, {
              toValue: targetAngleValue,
              friction: 30,   
              tension: 20,  
              useNativeDriver: false,
            }),
            // 새 캐릭터 등장
            Animated.timing(fadeAnim, {
              toValue: 1,
              duration: 350,
              useNativeDriver: false,
            })
          ]).start(() => {
            // 사이클 종료 후 대기
            setTimeout(() => {
              if (isMounted) runSyncAnimation((nextIndex + 1) % 3);
            }, 3600); 
          });
        }, 50); // 렌더링 갭 (Gap)
      });
    };

    // 최초 시작 (1초 딜레이)
    const initTimer = setTimeout(() => {
      runSyncAnimation(1);
    }, 1000);

    return () => {
      isMounted = false;
      clearTimeout(initTimer);
    };
  }, []);

  // 각도 범위 (-15도 ~ 15도)
  const frameRotate = rotateVal.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: ['-15deg', '30deg', '15deg'], 
  });

  // 공 움직임
  const ball1Y = rotateVal.interpolate({ inputRange: [-1, 1], outputRange: [20, -20] });
  const ball2X = rotateVal.interpolate({ inputRange: [-1, 1], outputRange: [-20, 20] });
  const ball3Y = rotateVal.interpolate({ inputRange: [-1, 1], outputRange: [-15, 15] });

  const ball1Color = '#49DC95';
  const ball2Color = '#FF9191';
  const ball3Color = '#6198FF';

  const goNext = () => {
    router.push('./detail4');
  };

  return (
    <View style={styles.wrap}>
      {/* 상단 바 */}
      <View style={styles.progressBarBg}>
        <Animated.View style={[styles.progressBarFill, { width: progressWidth }]} />
      </View>

      {/* 이미지 영역 */}
      <View style={styles.imageContainer}>
        
        {/* 공들 */}
        <Animated.View style={[styles.ball, styles.ball1, { transform: [{ translateY: ball1Y }], backgroundColor: ball1Color }]} />
        <Animated.View style={[styles.ball, styles.ball2, { transform: [{ translateX: ball2X }], backgroundColor: ball2Color }]} />
        <Animated.View style={[styles.ball, styles.ball3, { transform: [{ translateY: ball3Y }], backgroundColor: ball3Color }]} />

        {/* 1. 캐릭터 (Fade 적용) */}
        <View style={styles.charWrapper}>
          <Animated.Image 
            source={charImages[charIndex]} 
            style={[styles.charImage, { opacity: fadeAnim }]} 
            resizeMode="contain" 
          />
        </View>
        
        {/* 2. 프레임 (회전 적용) */}
        <Animated.View style={[styles.frameWrapper, { transform: [{ rotate: frameRotate }] }]}>
          <Image 
            source={imgFrame} 
            style={styles.frameImage} 
            resizeMode="contain" 
          />
        </Animated.View>

      </View>

      {/* 텍스트 영역 */}
      <View style={styles.textBox}>
        <AppText style={styles.titleLine}>
          <Animated.Text style={[styles.bold20, { color: titleShootColor }]}>우리만의</Animated.Text>{' '}
          <Animated.Text style={[styles.bold20, { color: titleSendColor }]}>즐거운</Animated.Text>{' '}
          <Animated.Text style={[styles.bold20, { color: titleRememberColor }]}>기록</Animated.Text>
        </AppText>
        <AnimatedAppText type="light" style={[styles.desc, { color: descColor }]}>
          멀리 있어도 사진 한 장으로 이어지는 마음
        </AnimatedAppText>
        <AnimatedAppText type="light" style={[styles.desc, { color: descColor }]}>
          함께하는 <AppText type="bold">일상을 특별하게</AppText> 만들어보세요
        </AnimatedAppText>
      </View>

      {/* 버튼 */}
      <Pressable onPress={goNext} style={[styles.btnWrap, { bottom: insets.bottom + 32 }]}>
        <Animated.View style={[styles.btn, { backgroundColor: btnBg }]}>
          <AppText type="bold" style={styles.btnText}>다음</AppText>
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
  
  imageContainer: {
    marginTop: 60,
    width: 300,
    height: 380,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  
  charWrapper: {
    position: 'absolute',
    width: 200, 
    height: 260,
    zIndex: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  charImage: {
    width: '100%',
    height: '100%',
  },

  frameWrapper: {
    zIndex: 10, 
    alignItems: 'center',
    justifyContent: 'center',
  },
  frameImage: {
    width: 260,
    height: 320,
  },

  ball: {
    position: 'absolute',
    borderRadius: 999,
  },
  ball1: {
    width: 18,
    height: 18,
    top: 20,
    left: 20,
    zIndex: 1,
  },
  ball2: {
    width: 24,
    height: 24,
    bottom: 50,
    left: 10,
    zIndex: 20,
  },
  ball3: {
    width: 14,
    height: 14,
    top: 100,
    right: 10,
    zIndex: 1,
  },

  textBox: {
    position:'absolute',
    bottom:SCREEN_HEIGHT*0.17,
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  titleLine: { textAlign: 'center' },
  bold20: { fontSize: 20 },
  desc: { marginTop: 6, fontSize: 13, textAlign: 'center' },
  btnWrap: { position: 'absolute', width: '100%', alignItems: 'center' },
  btn: { width: 140, height: 56, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  btnText: { fontSize: 17, color: '#fff' },
});