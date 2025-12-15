// app/onboarding/intro.tsx
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import AppText from '../../components/AppText';

const LINES = [
  ['반갑습니다, ', { text: '무무리', color: '#00C896' }, '입니다!'],
  [
    '무무리는 ',
    { text: '누구나', color: '#FF9191' },
    ' 즐길 수 있는 ',
    { text: '사진 기반 커플 앱', color: '#FF9191' },
    ' 입니다.',
  ],
  ['지금부터 ', { text: '무무리', color: '#6198FF' }, '에 대해 알려드릴게요!'],
];

export default function OnboardingIntro() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const contentWidth = Math.min(width - 10, 420); // 가운데 들어갈 실제 폭
  const [activeIdx, setActiveIdx] = useState(0);

  const lineScales = useRef(
    LINES.map((_, i) => new Animated.Value(i === 0 ? 1 : 0.92))
  ).current;
  const lineOpacities = useRef(
    LINES.map((_, i) => new Animated.Value(i === 0 ? 1 : 0))
  ).current;

  useEffect(() => {
    LINES.forEach((_, idx) => {
      if (idx === 0) return;
      setTimeout(() => {
        setActiveIdx((cur) => {
          const next = idx;

          // 지난 줄 축소 + 회색
          Animated.parallel([
            Animated.spring(lineScales[cur], {
              toValue: 0.9,
              useNativeDriver: true,
              speed: 18,
              bounciness: 6,
            }),
            Animated.timing(lineOpacities[cur], {
              toValue: 1,
              duration: 150,
              useNativeDriver: true,
            }),
          ]).start();

          // 새 줄 등장
          Animated.sequence([
            Animated.timing(lineOpacities[next], {
              toValue: 1,
              duration: 140,
              useNativeDriver: true,
            }),
            Animated.spring(lineScales[next], {
              toValue: 1,
              useNativeDriver: true,
              speed: 17,
              bounciness: 7,
            }),
          ]).start();

          return next;
        });
      }, idx * 1100);
    });
  }, [lineOpacities, lineScales]);

  const goNext = () => {
    if (activeIdx !== LINES.length - 1) return;
    router.push('./detail');
  };

  const isDone = activeIdx === LINES.length - 1;

  const renderLine = (
    parts: (string | { text: string; color: string })[],
    idx: number
  ) => {
    const isPast = idx < activeIdx;
    const isCurrent = idx === activeIdx;
    const isLast = idx === LINES.length - 1;
    const baseFontSize = isPast ? 12 : isLast ? 18 : 13;

    if (isPast) {
      const plain = parts
        .map((p) => (typeof p === 'string' ? p : p.text))
        .join('');
      return (
        <Animated.View
          key={idx}
          style={[
            styles.lineWrap,
            {
              width: contentWidth,
              transform: [{ scale: lineScales[idx] }],
              opacity: lineOpacities[idx],
            },
          ]}
        >
          <AppText
            style={[
              styles.line,
              styles.pastLine,
              { fontSize: baseFontSize, textAlign: 'center' },
            ]}
          >
            {plain}
          </AppText>
        </Animated.View>
      );
    }

    return (
      <Animated.View
        key={idx}
        style={[
          styles.lineWrap,
          {
            width: contentWidth,
            transform: [{ scale: lineScales[idx] }],
            opacity: lineOpacities[idx],
          },
        ]}
      >
        <AppText
          style={[
            styles.line,
            isCurrent && styles.currentLine,
            { fontSize: baseFontSize, textAlign: 'center' },
          ]}
        >
          {parts.map((part, i) =>
            typeof part === 'string' ? (
              <AppText key={i} style={{ fontSize: baseFontSize }}>
                {part}
              </AppText>
            ) : (
              <AppText
                key={i}
                style={{ fontSize: baseFontSize, color: part.color }}
              >
                {part.text}
              </AppText>
            )
          )}
        </AppText>
      </Animated.View>
    );
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.textBox}>
        {LINES.map((line, idx) => {
          if (idx > activeIdx) return null;
          return renderLine(line, idx);
        })}
      </View>

      <View style={styles.btnWrap}>
        <Pressable
          onPress={goNext}
          disabled={!isDone}
          style={[
            styles.btn,
            { backgroundColor: isDone ? '#FF9191' : '#C4C4C4' },
          ]}
        >
          <AppText type="bold" style={styles.btnText}>
            네!
          </AppText>
        </Pressable>
      </View>
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
    gap: 65,
    alignItems: 'center',
  },
  lineWrap: {
    alignSelf: 'center',
  },
  line: {
    lineHeight: 22,
  },
  pastLine: {
    color: '#C4C4C4',
  },
  currentLine: {
    color: '#444',
  },
  btnWrap: {
    width: '100%',
    alignItems: 'center',
  },
  btn: {
    width: 124,
    height: 56,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: {
    color: '#fff',
    fontSize: 16,
  },
});