// app/onboarding/detail2.tsx
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Dimensions,
  Pressable,
  StyleSheet,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppText from '../../components/AppText';

const AnimatedAppText = Animated.createAnimatedComponent(AppText);
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function OnboardingDetail2() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { prevProgress } = useLocalSearchParams<{ prevProgress?: string }>();

  // --- 상단 바 애니메이션 ---
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

  // --- 카드 / 텍스트 컬러용 메인 애니메이션 (prog) ---
  const prog = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const t = setTimeout(() => {
      Animated.spring(prog, {
        toValue: 1,
        useNativeDriver: false,
        speed: 14, // 더 빠르고 역동적으로
        bounciness: 6,
      }).start();
    }, 500);
    return () => clearTimeout(t);
  }, [prog]);

  // 카드 배경색, 회전, 스케일 (파란 사각형)
  const cardBg = prog.interpolate({
    inputRange: [0, 1],
    outputRange: ['#BFBFBF', '#5F92FF'],
  });
  // prog가 0에서 1로 갈 때 -11deg로 회전 
  const cardRotate = prog.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '11deg'],
  });
  const cardScale = prog.interpolate({
    inputRange: [0, 1],
    outputRange: [0.8, 1],
  });

  // 텍스트 색상 애니메이션 (유지)
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

  // --- 편지지 좌우 기울기 애니메이션 (수정) ---
  // prog 값에 따라 편지지가 카드와 반대 방향으로 기울어지게 조정
  const letterRotate = prog.interpolate({
    inputRange: [0, 1,],
    outputRange: ['-6deg', '6deg'], // prog가 0->1일 때, -6deg -> 6deg로 변화 (확실히 기울어짐)
  });

  const goNext = () => {
    router.push('./detail3');
  };

  // prog 값에 따라 편지 이미지 크기가 커지는 애니메이션 (유지)
  const letterScale = prog.interpolate({
    inputRange: [0, 1],
    outputRange: [0.8, 1], // 카드가 0.8 -> 1로 커지는 비율과 동일하게
  });

  return (
    <View style={styles.wrap}>
      {/* 상단 바 */}
      <View style={styles.progressBarBg}>
        <Animated.View style={[styles.progressBarFill, { width: progressWidth }]} />
      </View>

      {/* 가운데 카드 + 편지 세트 */}
      <View>
        <Animated.View
          style={[
            styles.card,
            {
              backgroundColor: cardBg,
              // 카드 회전 및 스케일 적용
              transform: [{ rotate: cardRotate }, { scale: cardScale }],
            },
          ]}
        >
          {/* 편지봉투 뒤 (회색) - 회전, 스케일만 애니메이션 적용 */}
          <Animated.Image
            source={require('../../assets/images/letterback.png')}
            style={[styles.letterBack, { transform: [{ scale: letterScale }] }]}
            resizeMode="contain"
          />
          {/* 편지지 (노란 종이) : prog 좌우 회전 */}
          <Animated.Image
            source={require('../../assets/images/letter.png')}
            style={[
              styles.letterPaper,
              {
                // 편지지 회전 및 스케일 적용
                transform: [{ rotate: letterRotate }, { scale: letterScale }],
              },
            ]}
            resizeMode="contain"
          />
          {/* 봉투 앞 (흰색) - 회전, 스케일만 애니메이션 적용 */}
          <Animated.Image
            source={require('../../assets/images/letterfront.png')}
            style={[styles.letterFront, { transform: [{ scale: letterScale }] }]}
            resizeMode="contain"
          />
        </Animated.View>
      </View>

      {/* 텍스트 영역 (유지) */}
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

      {/* 버튼 (유지) */}
      <Pressable
        onPress={goNext}
        style={[styles.btnWrap, { bottom: insets.bottom + 32 }]}
      >
        <Animated.View style={[styles.btn, { backgroundColor: btnBg }]}>
          <Animated.Text style={[styles.btnText, { color: btnTextColor , fontFamily: 'Paperlogy-7Bold'}]}>
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
    marginTop: 150,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },

  // 편지 레이어들
  // Animated.Image로 변경하여 scale 애니메이션 적용
  letterBack: {
    marginBottom:85,
    position: 'absolute',
    width: CARD_SIZE * 0.8,
    height: CARD_SIZE * 1.1,
  },
  letterPaper: {
    position: 'absolute',
    width: CARD_SIZE * 0.8,
    height: CARD_SIZE * 0.8,
    top: CARD_SIZE * 0.02,
  },
  letterFront: {
    position: 'absolute',
    width: CARD_SIZE * 0.8,
    height: CARD_SIZE * 0.9,
    bottom: CARD_SIZE * 0.02,
  },
  textBox: {
    position:'absolute',
    bottom:SCREEN_HEIGHT*0.17,
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
    fontSize: 13,
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
  },
});