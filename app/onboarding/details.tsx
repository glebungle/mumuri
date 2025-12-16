// app/onboarding/integrated.tsx (파일명은 원하시는 대로 사용하세요)
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  Image,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppText from '../../components/AppText';

// ==============================================================================
// Asset Imports
// ==============================================================================
const imgOnboarding = require('../../assets/images/onboarding.png');
const imgWink = require('../../assets/images/onboarding_wink.png');
const imgBg = require('../../assets/images/onboardingbg.png');
const imgArrow = require('../../assets/images/Arrow.png');
const imgCardBack = require('../../assets/images/letterback.png');
const imgLetter = require('../../assets/images/letter.png');
const imgCardFront = require('../../assets/images/letterfront.png');
const imgFrame = require('../../assets/images/frame.png');
const imgCh1 = require('../../assets/images/ch1.png');
const imgCh2 = require('../../assets/images/ch2.png');
const imgCh3 = require('../../assets/images/ch3.png');
const pinkBall = require('../../assets/images/ball_pink.png');
const greenBall = require('../../assets/images/ball_green.png');
const imgRotateChar = require('../../assets/images/rotatecharacter.png');
// [새로 추가된 이미지]
const imgBubble1 = require('../../assets/images/bubble1.png');
const imgBubble2 = require('../../assets/images/bubble2.png');

// ==============================================================================
// Global Constants & Helpers
// ==============================================================================
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const AnimatedAppText = Animated.createAnimatedComponent(AppText);
const AnimatedImage = Animated.Image;

const charImages = [imgCh1, imgCh2, imgCh3];

// ==============================================================================
// Main Component
// ==============================================================================
export default function OnboardingIntegrated() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // 0: Dot Explosion (Stage 1)
  // 1: Card Letter (Stage 2)
  // 2: Bouncing Frame (Stage 3)
  // 3: Bubbles & Heart (Stage 4 - NEW!)
  // 4: Rotation Finish (Stage 5)
  const [step, setStep] = useState(0);

  // 진행바 애니메이션
  const progressAnim = useRef(new Animated.Value(0.2)).current;

  useEffect(() => {
    // 단계별 프로그래스바 수치
    let targetValue = 0.2;
    if (step === 1) targetValue = 0.4;
    else if (step === 2) targetValue = 0.62;
    else if (step === 3) targetValue = 0.83; // 새로 추가된 단계
    else if (step === 4) targetValue = 1.0;

    Animated.timing(progressAnim, {
      toValue: targetValue,
      duration: 450,
      useNativeDriver: false,
    }).start();
  }, [step]);

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  const goNext = () => {
    if (step < 4) {
      setStep(step + 1);
    } else {
      // 마지막 단계 완료 -> 로그인/메인으로 이동
      router.replace('/(auth)');
    }
  };

  // 마지막 단계(Step 4)만 배경색 다크모드
  const containerBackgroundColor = step === 4 ? '#303030' : '#FFFCF5';
  const progressBarBgColor = step === 4 ? 'rgba(255,255,255,0.25)' : '#E3E7EB';
  const progressBarFillColor = step === 4 ? '#FFFFFF' : (step === 0 ? '#6198FF' : '#5F92FF');

  return (
    <View style={[styles.container, { backgroundColor: containerBackgroundColor }]}>
      {/* 상단 프로그래스바 (공통) */}
      <View style={[styles.progressBarContainer, { top: insets.top + 20 }]}>
        <View style={[styles.progressBarBg, { backgroundColor: progressBarBgColor }]}>
          <Animated.View
            style={[
              styles.progressBarFill,
              { width: progressWidth, backgroundColor: progressBarFillColor },
            ]}
          />
        </View>
      </View>

      {/* 메인 컨텐츠 영역 */}
      <View style={styles.contentArea}>
        {step === 0 && <Stage1 onNext={goNext} />}
        {step === 1 && <Stage2 onNext={goNext} />}
        {step === 2 && <Stage3 onNext={goNext} />}
        {step === 3 && <Stage4 onNext={goNext} />} 
        {step === 4 && <Stage5 onNext={goNext} />}
      </View>
    </View>
  );
}

// ==============================================================================
// STAGE 1: Dot Explosion & Snap
// ==============================================================================
const Stage1 = ({ onNext }: { onNext: () => void }) => {
  const insets = useSafeAreaInsets();
  const [overlayVisible, setOverlayVisible] = useState(true);
  const [isSnapped, setIsSnapped] = useState(false);

  const stepAnim = useRef(new Animated.Value(0)).current; 
  const overlayAnim = useRef(new Animated.Value(1)).current;

  const hideOverlay = () => {
    Animated.timing(overlayAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start(() => setOverlayVisible(false));
  };

  const handleSnap = () => {
    setIsSnapped(true);
    Animated.spring(stepAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 12,
      bounciness: 8,
    }).start();
  };

  const charRotate = stepAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '8deg'] });
  const charNormalOpacity = stepAnim.interpolate({ inputRange: [0, 0.2], outputRange: [1, 0] });
  const charWinkOpacity = stepAnim.interpolate({ inputRange: [0, 0.2], outputRange: [0, 1] });
  const bgOpacity = stepAnim.interpolate({ inputRange: [0, 0.3], outputRange: [0, 1] });
  const bgScale = stepAnim.interpolate({ inputRange: [0, 0.3], outputRange: [0.9, 1] });

  const dotScale = stepAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 1.2, 1] });
  const dots = [
    { x: [0, -70], y: [0, -110] }, { x: [0, 0], y: [0, -140] }, { x: [0, 80], y: [0, -100] },
    { x: [0, 110], y: [0, -30] },  { x: [0, 70], y: [0, 60] },  { x: [0, -20], y: [0, 100] },
    { x: [0, -80], y: [0, 50] },   { x: [0, -100], y: [0, -40] },
  ];

  const bubbleOpacity = stepAnim.interpolate({ inputRange: [0, 0.4, 1], outputRange: [1, 1, 1] });
  const bottomTextOpacity = stepAnim.interpolate({ inputRange: [0.3, 1], outputRange: [0, 1] });
  const snapBtnOpacity = stepAnim.interpolate({ inputRange: [0, 0.2], outputRange: [1, 0] });
  const nextBtnOpacity = stepAnim.interpolate({ inputRange: [0.3, 1], outputRange: [0, 1] });

  return (
    <View style={styles.stageContainer}>
      <View style={styles.centerGraphics}>
        <View style={styles.confettiContainer}>
          {dots.map((d, i) => (
            <Animated.View
              key={i}
              style={[
                styles.dot,
                {
                  transform: [
                    { translateX: stepAnim.interpolate({ inputRange: [0, 1], outputRange: d.x }) },
                    { translateY: stepAnim.interpolate({ inputRange: [0, 1], outputRange: d.y }) },
                    { scale: dotScale },
                  ],
                },
              ]}
            />
          ))}
        </View>

        <AnimatedImage source={imgBg} style={[styles.bgImage, { opacity: bgOpacity, transform: [{ scale: bgScale }] }]} resizeMode="contain" />
        <Animated.View style={[styles.characterContainer, { transform: [{ rotate: charRotate }] }]}>
          <AnimatedImage source={imgOnboarding} style={[styles.fullImage, { opacity: charNormalOpacity }]} resizeMode="contain" />
          <AnimatedImage source={imgWink} style={[styles.fullImage, StyleSheet.absoluteFill, { opacity: charWinkOpacity }]} resizeMode="contain" />
        </Animated.View>
        
        <Animated.View style={[styles.bubble, { opacity: bubbleOpacity }]} pointerEvents="none">
          <AppText style={styles.bubbleText}>지금 보여주고 싶은 표정은?</AppText>
        </Animated.View>
      </View>

      <View style={[styles.bottomArea, { paddingBottom: insets.bottom + 20 }]}>
        <Animated.View style={[styles.textArea, { opacity: bottomTextOpacity }]}>
          <AppText style={styles.title}>
            우리의 <AppText style={{ color: '#6198FF', fontSize: 20 }}>오늘</AppText>을 담아보세요
          </AppText>
          <AppText type="light" style={styles.desc}>매일 새로운 질문이 도착해요</AppText>
          <AppText type="light" style={styles.desc}>질문에 맞는 순간을 <AppText type="bold">카메라</AppText>로 찍어보세요</AppText>
        </Animated.View>

        <View style={styles.buttonWrapper}>
          <Pressable onPress={handleSnap} disabled={isSnapped} style={StyleSheet.absoluteFill} pointerEvents={isSnapped ? 'none' : 'auto'}>
            <Animated.View style={[styles.blackBtn, { opacity: snapBtnOpacity }]}>
              <AppText type="bold" style={styles.btnTextWhite}>찰칵!</AppText>
            </Animated.View>
          </Pressable>
          <Animated.View style={[styles.arrow, { opacity: snapBtnOpacity }]} pointerEvents="none">
             <Image source={imgArrow} style={styles.fullImage} resizeMode="contain" />
          </Animated.View>

          <Pressable onPress={onNext} disabled={!isSnapped} style={StyleSheet.absoluteFill} pointerEvents={isSnapped ? 'auto' : 'none'}>
            <Animated.View style={[styles.blueBtn, { opacity: nextBtnOpacity }]}>
              <AppText type="bold" style={styles.btnTextWhite}>다음</AppText>
            </Animated.View>
          </Pressable>
        </View>
      </View>

      {overlayVisible && (
        <Animated.View style={[styles.overlay, { opacity: overlayAnim }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={hideOverlay} />
          <View style={styles.overlayContent}>
            <AppText style={styles.ovTitle}>
              <AppText style={{ color: '#6198FF', fontSize: 40 }}>질문</AppText>에 맞춰{'\n'}
              <AppText style={{ color: '#49DC95', fontSize: 40 }}>사진</AppText>을 <AppText style={{ color: '#FF9191', fontSize: 40 }}>찰칵</AppText>,{'\n'}따라해보세요!
            </AppText>
            <AppText style={styles.ovDesc}>*아무 곳이나 탭하면 시작합니다</AppText>
          </View>
        </Animated.View>
      )}
    </View>
  );
};

// ==============================================================================
// STAGE 2: Card & Letter
// ==============================================================================
const Stage2 = ({ onNext }: { onNext: () => void }) => {
  const insets = useSafeAreaInsets();
  const prog = useRef(new Animated.Value(0)).current;
  const [btnEnabled, setBtnEnabled] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      Animated.spring(prog, {
        toValue: 1,
        useNativeDriver: false,
        speed: 14,
        bounciness: 6,
      }).start(() => setBtnEnabled(true));
    }, 500);
    return () => clearTimeout(t);
  }, []);

  const cardBg = prog.interpolate({ inputRange: [0, 1], outputRange: ['#BFBFBF', '#5F92FF'] });
  const cardRotate = prog.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '11deg'] });
  const cardScale = prog.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] });
  const letterRotate = prog.interpolate({ inputRange: [0, 1], outputRange: ['-6deg', '6deg'] });
  const letterScale = prog.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] });

  const titleShootColor = prog.interpolate({ inputRange: [0, 1], outputRange: ['#C8C8C8', '#FF7777'] });
  const titleSendColor = prog.interpolate({ inputRange: [0, 1], outputRange: ['#C8C8C8', '#3BCF8F'] });
  const titleRememberColor = prog.interpolate({ inputRange: [0, 1], outputRange: ['#C8C8C8', '#5F92FF'] });
  const descColor = prog.interpolate({ inputRange: [0, 1], outputRange: ['#CFCFCF', '#000'] });
  const btnBg = prog.interpolate({ inputRange: [0, 1], outputRange: ['#CFCFCF', '#5F92FF'] });

  return (
    <View style={styles.stageContainer}>
      <View style={styles.centerGraphics}>
        <Animated.View style={[styles.card, { backgroundColor: cardBg, transform: [{ rotate: cardRotate }, { scale: cardScale }] }]}>
          <AnimatedImage source={imgCardBack} style={[styles.letterLayer, { transform: [{ scale: letterScale }] }]} resizeMode="contain" />
          <AnimatedImage source={imgLetter} style={[styles.letterPaper, { transform: [{ rotate: letterRotate }, { scale: letterScale }] }]} resizeMode="contain" />
          <AnimatedImage source={imgCardFront} style={[styles.letterLayer, { bottom: 5, transform: [{ scale: letterScale }] }]} resizeMode="contain" />
        </Animated.View>
      </View>

      <View style={[styles.bottomArea, { paddingBottom: insets.bottom + 20 }]}>
        <View style={styles.textArea}>
          <AppText style={styles.titleLine}>
            <Animated.Text style={[styles.bold20, { color: titleShootColor }]}>찍고, </Animated.Text>
            <Animated.Text style={[styles.bold20, { color: titleSendColor }]}>보내고, </Animated.Text>
            <Animated.Text style={[styles.bold20, { color: titleRememberColor }]}>기억해요</Animated.Text>
          </AppText>
          <AnimatedAppText type="light" style={[styles.desc, { color: descColor }]}>
            촬영한 사진을 <AppText type="bold">사랑하는 사람에게 전달</AppText>해보세요
          </AnimatedAppText>
          <AnimatedAppText type="light" style={[styles.desc, { color: descColor }]}>
            무무리는 서로의 하루가 됩니다
          </AnimatedAppText>
        </View>

        <Pressable onPress={onNext} disabled={!btnEnabled} style={styles.buttonWrapper}>
          <Animated.View style={[styles.blueBtn, { backgroundColor: btnBg, width: 140 }]}>
            <AppText type="bold" style={styles.btnTextWhite}>다음</AppText>
          </Animated.View>
        </Pressable>
      </View>
    </View>
  );
};

// ==============================================================================
// STAGE 3: Bouncing Frame & Balls
// ==============================================================================
const Stage3 = ({ onNext }: { onNext: () => void }) => {
  const insets = useSafeAreaInsets();
  const prog = useRef(new Animated.Value(0)).current;
  const [btnEnabled, setBtnEnabled] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      Animated.spring(prog, {
        toValue: 1,
        useNativeDriver: false,
        speed: 14,
        bounciness: 6,
      }).start(() => setBtnEnabled(true));
    }, 500);
    return () => clearTimeout(t);
  }, []);

  const titleShootColor = prog.interpolate({ inputRange: [0, 1], outputRange: ['#C8C8C8', '#000'] });
  const titleSendColor = prog.interpolate({ inputRange: [0, 1], outputRange: ['#C8C8C8', '#FF7777'] });
  const titleRememberColor = prog.interpolate({ inputRange: [0, 1], outputRange: ['#C8C8C8', '#000'] });
  const descColor = prog.interpolate({ inputRange: [0, 1], outputRange: ['#CFCFCF', '#000'] });
  const btnBg = prog.interpolate({ inputRange: [0, 1], outputRange: ['#CFCFCF', '#5F92FF'] });

  const [charIndex, setCharIndex] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const rotateVal = useRef(new Animated.Value(-1)).current;

  useEffect(() => {
    let isMounted = true;
    const runSyncAnimation = (nextIndex: number) => {
      if (!isMounted) return;
      Animated.timing(fadeAnim, { toValue: 0, duration: 300, useNativeDriver: false }).start(() => {
        setCharIndex(nextIndex);
        let targetAngle = nextIndex === 0 ? -1 : (nextIndex === 1 ? 1 : 0);
        
        setTimeout(() => {
          if (!isMounted) return;
          Animated.parallel([
            Animated.spring(rotateVal, { toValue: targetAngle, friction: 5, tension: 100, useNativeDriver: false }),
            Animated.timing(fadeAnim, { toValue: 1, duration: 350, useNativeDriver: false })
          ]).start(() => {
            setTimeout(() => {
              if (isMounted) runSyncAnimation((nextIndex + 1) % 3);
            }, 1800);
          });
        }, 50);
      });
    };
    const timer = setTimeout(() => runSyncAnimation(1), 1000);
    return () => { isMounted = false; clearTimeout(timer); };
  }, []);

  const frameRotate = rotateVal.interpolate({ inputRange: [-1, 0, 1], outputRange: ['-15deg', '-3deg', '15deg'] });
  const ball1Y = rotateVal.interpolate({ inputRange: [-1, 1], outputRange: [20, -20] });
  const ball2X = rotateVal.interpolate({ inputRange: [-1, 1], outputRange: [-20, 20] });
  const ball3Y = rotateVal.interpolate({ inputRange: [-1, 1], outputRange: [-15, 15] });

  const colorAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(colorAnim, { toValue: 1, duration: 2000, useNativeDriver: false }),
      Animated.timing(colorAnim, { toValue: 0, duration: 2000, useNativeDriver: false })
    ])).start();
  }, []);
  const b1Color = colorAnim.interpolate({ inputRange: [0, 1], outputRange: ['#49DC95', '#81F795'] });
  const b2Color = colorAnim.interpolate({ inputRange: [0, 1], outputRange: ['#FF9191', '#FFB4B4'] });
  const b3Color = colorAnim.interpolate({ inputRange: [0, 1], outputRange: ['#6198FF', '#8EB4FF'] });

  return (
    <View style={styles.stageContainer}>
      <View style={styles.centerGraphics}>
        <View style={styles.frameContainer}>
          <Animated.View style={[styles.ball, { width: 18, height: 18, top: 20, left: 20, transform: [{ translateY: ball1Y }], backgroundColor: b1Color }]} />
          <Animated.View style={[styles.ball, { width: 24, height: 24, bottom: 50, left: 10, zIndex: 20, transform: [{ translateX: ball2X }], backgroundColor: b2Color }]} />
          <Animated.View style={[styles.ball, { width: 14, height: 14, top: 100, right: 10, transform: [{ translateY: ball3Y }], backgroundColor: b3Color }]} />
          
          <View style={styles.charWrapper}>
            <AnimatedImage source={charImages[charIndex]} style={[styles.fullImage, { opacity: fadeAnim }]} resizeMode="contain" />
          </View>
          <Animated.View style={[styles.frameWrapper, { transform: [{ rotate: frameRotate }] }]}>
            <Image source={imgFrame} style={styles.frameImage} resizeMode="contain" />
          </Animated.View>
        </View>
      </View>

      <View style={[styles.bottomArea, { paddingBottom: insets.bottom + 20 }]}>
        <View style={styles.textArea}>
          <AppText style={styles.titleLine}>
            <Animated.Text style={[styles.bold20, { color: titleShootColor }]}>우리만의 </Animated.Text>
            <Animated.Text style={[styles.bold20, { color: titleSendColor }]}>즐거운 </Animated.Text>
            <Animated.Text style={[styles.bold20, { color: titleRememberColor }]}>기록</Animated.Text>
          </AppText>
          <AnimatedAppText type="light" style={[styles.desc, { color: descColor }]}>멀리 있어도 사진 한 장으로 이어지는 마음</AnimatedAppText>
          <AnimatedAppText type="light" style={[styles.desc, { color: descColor }]}>함께하는 <AppText type="bold">일상을 특별하게</AppText> 만들어보세요</AnimatedAppText>
        </View>

        <Pressable onPress={onNext} disabled={!btnEnabled} style={styles.buttonWrapper}>
          <Animated.View style={[styles.blueBtn, { backgroundColor: btnBg, width: 140 }]}>
            <AppText type="bold" style={styles.btnTextWhite}>다음</AppText>
          </Animated.View>
        </Pressable>
      </View>
    </View>
  );
};

// ==============================================================================
// STAGE 4: Bubbles & Heart (NEW ADDITION)
// ==============================================================================
const Stage4 = ({ onNext }: { onNext: () => void }) => {
  const insets = useSafeAreaInsets();
  
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

  // Color Interpolations
  const titleShootColor = prog.interpolate({ inputRange: [0, 1], outputRange: ['#C8C8C8', '#000'] });
  const titleSendColor = prog.interpolate({ inputRange: [0, 1], outputRange: ['#C8C8C8', '#6198FF'] });
  const titleRememberColor = prog.interpolate({ inputRange: [0, 1], outputRange: ['#C8C8C8', '#000'] });
  const descColor = prog.interpolate({ inputRange: [0, 1], outputRange: ['#CFCFCF', '#000'] });
  const btnBg = prog.interpolate({ inputRange: [0, 1], outputRange: ['#CFCFCF', '#5F92FF'] });

  // Bubble Fade-In
  const bubble1Opacity = useRef(new Animated.Value(0)).current;
  const bubble2Opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const t1 = setTimeout(() => {
      Animated.timing(bubble1Opacity, { toValue: 1, duration: 600, useNativeDriver: true }).start();
    }, 1000);

    const t2 = setTimeout(() => {
      Animated.timing(bubble2Opacity, { toValue: 1, duration: 600, useNativeDriver: true }).start();
    }, 1500);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  return (
    <View style={styles.stageContainer}>
      {/* 버블 이미지 영역 - 기존 코드의 레이아웃 유지 */}
      <View style={styles.bubblesArea}>
        <Animated.Image
          source={imgBubble1}
          style={[styles.bubble1, { opacity: bubble1Opacity }]}
          resizeMode="contain"
        />
        <Animated.Image
          source={imgBubble2}
          style={[styles.bubble2, { opacity: bubble2Opacity }]}
          resizeMode="contain"
        />
      </View>

      {/* 텍스트 영역 (textBox) */}
      <View style={[styles.textBox]}>
         {/* 스타일 통일을 위해 bottomArea 대신 textBox 스타일 사용 (요청하신 위치 준수) */}
        <AppText style={styles.titleLine}>
          <Animated.Text style={[styles.bold20, { color: titleShootColor }]}>사진과 함께 </Animated.Text>
          <Animated.Text style={[styles.bold20, { color: titleSendColor }]}>마음</Animated.Text>
          <Animated.Text style={[styles.bold20, { color: titleRememberColor }]}>을 전해요</Animated.Text>
        </AppText>

        <AnimatedAppText type="light" style={[styles.desc, { color: descColor }]}>
          짧은 한마디로 더 가까워지는 대화
        </AnimatedAppText>
        <AnimatedAppText type="light" style={[styles.desc, { color: descColor }]}>
          <AppText type="bold">두 사람만의 공간</AppText>에서 이어지는 이야기
        </AnimatedAppText>
      </View>

      {/* 버튼 영역 */}
      <Pressable
        onPress={onNext}
        style={[styles.btnWrap, { bottom: insets.bottom + 32 }]}
      >
        <Animated.View style={[styles.btn, { backgroundColor: btnBg }]}>
          <AppText type="bold" style={styles.btnTextWhite}>다음</AppText>
        </Animated.View>
      </Pressable>
    </View>
  );
};

// ==============================================================================
// STAGE 5: Finish (Rotation)
// ==============================================================================
const Stage5 = ({ onNext }: { onNext: () => void }) => {
  const insets = useSafeAreaInsets();
  const rotateVal = useRef(new Animated.Value(0)).current;
  const ballAnimVal = useRef(new Animated.Value(0)).current;

  // 공 데이터
  const ballData = [
    { id: 1, initialX: 50, initialY: 250, size: 20 },
    { id: 2, initialX: 280, initialY: 180, size: 25 },
    { id: 3, initialX: 80, initialY: 500, size: 18 },
    { id: 4, initialX: 300, initialY: 580, size: 22 },
    { id: 5, initialX: 180, initialY: 100, size: 20 },
  ];

  useEffect(() => {
    const gentleEasing = Easing.bezier(0.25, 0.1, 0.25, 1);
    const runAnimation = () => {
      Animated.sequence([
        Animated.parallel([
          Animated.timing(rotateVal, { toValue: 1, duration: 800, easing: gentleEasing, useNativeDriver: true }),
          Animated.spring(ballAnimVal, { toValue: 1, friction: 4, tension: 80, useNativeDriver: true }),
        ]),
        Animated.delay(4000),
        Animated.parallel([
          Animated.timing(rotateVal, { toValue: 0, duration: 800, easing: gentleEasing, useNativeDriver: true }),
          Animated.spring(ballAnimVal, { toValue: 0, friction: 4, tension: 80, useNativeDriver: true }),
        ]),
        Animated.delay(4000),
      ]).start(() => runAnimation());
    };
    runAnimation();
  }, []);

  const characterRotate = rotateVal.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] });

  return (
    <View style={styles.stageContainer}>
      <View style={styles.centerGraphics}>
        {ballData.map((ball, index) => {
          const moveX = ballAnimVal.interpolate({ inputRange: [0, 1], outputRange: [0, (index % 2 === 0 ? 1 : -1) * (50 + index * 20)] });
          const moveY = ballAnimVal.interpolate({ inputRange: [0, 1], outputRange: [0, (index % 3 === 0 ? -1 : 1) * (30 + index * 15)] });
          const pinkOpacity = ballAnimVal.interpolate({ inputRange: [0, 0.4, 0.6, 1], outputRange: [1, 1, 0, 0] });
          const greenOpacity = ballAnimVal.interpolate({ inputRange: [0, 0.4, 0.6, 1], outputRange: [0, 0, 1, 1] });

          return (
            <Animated.View key={ball.id} style={{ position: 'absolute', left: ball.initialX, top: ball.initialY, width: ball.size, height: ball.size, transform: [{ translateX: moveX }, { translateY: moveY }], zIndex: 0 }}>
              <AnimatedImage source={pinkBall} style={[styles.fullImage, { opacity: pinkOpacity }]} resizeMode="contain" />
              <AnimatedImage source={greenBall} style={[styles.fullImage, { opacity: greenOpacity, position: 'absolute' }]} resizeMode="contain" />
            </Animated.View>
          );
        })}
        <AnimatedImage source={imgRotateChar} resizeMode="contain" style={{ width: 300, height: 400, zIndex: 1, transform: [{ rotate: characterRotate }] }} />
      </View>

      <View style={[styles.bottomArea, { paddingBottom: insets.bottom + 20 }]}>
        <View style={styles.textArea}>
          <AppText style={[styles.title, { color: '#FFF' }]}>
            지금, <AppText style={{ color: '#63B5FF', fontSize: 22 }}>무무리</AppText>와 함께{'\n'}시작해볼까요?
          </AppText>
        </View>
        <Pressable onPress={onNext} style={styles.buttonWrapper}>
          <View style={styles.pinkBtn}>
            <AppText type="bold" style={styles.btnTextWhite}>시작</AppText>
          </View>
        </Pressable>
      </View>
    </View>
  );
};

// ==============================================================================
// Common Styles
// ==============================================================================
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  stageContainer: {
    flex: 1,
    width: '100%',
    alignItems: 'center', // Stage 4 정렬 위해 추가
  },
  // --- Header (ProgressBar) ---
  progressBarContainer: {
    position: 'absolute',
    left: 0, right: 0,
    alignItems: 'center',
    zIndex: 50,
  },
  progressBarBg: {
    height: 4,
    width: '88%',
    borderRadius: 999,
  },
  progressBarFill: {
    height: 4,
    borderRadius: 999,
  },
  // --- Content Area ---
  contentArea: {
    flex: 1,
  },
  centerGraphics: {
    flex: 1, 
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 100, 
  },
  // --- Bottom Area (Text & Buttons) ---
  bottomArea: {
    position: 'absolute',
    bottom: 0,
    left: 0, right: 0,
    alignItems: 'center',
    zIndex: 40,
  },
  textArea: {
    marginBottom: 30,
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 20,
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  titleLine: { textAlign: 'center' },
  bold20: { fontSize: 20 },
  desc: {
    fontSize: 13,
    color: '#000',
    textAlign: 'center',
    lineHeight: 22,
    marginTop: 6,
  },
  buttonWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 56, 
    width: '100%',
  },
  // --- Buttons ---
  blackBtn: {
    backgroundColor: '#000',
    paddingHorizontal: 48,
    paddingVertical: 14,
    borderRadius: 999,
  },
  blueBtn: {
    backgroundColor: '#6198FF',
    paddingHorizontal: 48,
    paddingVertical: 14,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    height: 56,
  },
  pinkBtn: {
    backgroundColor: '#F38C8C',
    paddingHorizontal: 52,
    paddingVertical: 14,
    borderRadius: 999,
  },
  btnTextWhite: {
    color: '#fff',
    fontSize: 16,
  },
  
  // --- Stage 1 Styles ---
  confettiContainer: { position: 'absolute', width: 100, height: 100, alignItems: 'center', justifyContent: 'center', zIndex: 0 },
  dot: { position: 'absolute', width: 18, height: 18, borderRadius: 9, backgroundColor: '#49DC95' },
  characterContainer: { width: 300, height: 400, alignItems: 'center', justifyContent: 'center', zIndex: 5 },
  bgImage: { position: 'absolute', width: '90%', height: '100%', zIndex: 1 },
  fullImage: { width: '100%', height: '100%' },
  bubble: { position: 'absolute', top: '20%', right: '10%', paddingHorizontal: 18, paddingVertical: 10, backgroundColor: '#000', borderRadius: 22, zIndex: 20 },
  bubbleText: { color: '#fff', fontSize: 14 },
  arrow: { position: 'absolute', bottom: 10, right: '20%', width: 60, height: 120, zIndex: 19 },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255,255,255,0.92)', alignItems: 'center', justifyContent: 'center', zIndex: 100 },
  overlayContent: { alignItems: 'center', paddingHorizontal: 32 },
  ovTitle: { fontSize: 40, lineHeight: 50, textAlign: 'center', color: '#333' },
  ovDesc: { marginTop: 20, fontSize: 13, color: '#888' },

  // --- Stage 2 Styles ---
  card: { width: 210, height: 210, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  letterLayer: { position: 'absolute', width: 210 * 0.8, height: 210 * 1.1 },
  letterPaper: { position: 'absolute', width: 210 * 0.8, height: 210 * 0.8, top: 5 },

  // --- Stage 3 Styles ---
  frameContainer: { width: 300, height: 380, alignItems: 'center', justifyContent: 'center' },
  charWrapper: { position: 'absolute', width: 200, height: 260, zIndex: 5, alignItems: 'center', justifyContent: 'center' },
  frameWrapper: { zIndex: 10, alignItems: 'center', justifyContent: 'center' },
  frameImage: { width: 260, height: 320 },
  ball: { position: 'absolute', borderRadius: 999 },

  // --- Stage 4 Styles (NEW) ---
  bubblesArea: {
    position: 'absolute',
    top: 130,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: -1, // 텍스트 뒤로
  },
  bubble1: {
    position: 'absolute',
    left: '13%',
    width: 173,
    height: 168,
  },
  bubble2: {
    position: 'absolute',
    right: '5%',
    width: 243,
    height: 157,
    marginTop: 0,
  },
  textBox: {
    marginTop: 520, // Stage 4 전용 위치
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 8,
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
    // Shadow if needed
  },
});