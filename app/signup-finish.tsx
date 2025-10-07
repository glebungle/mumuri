import { router } from 'expo-router';
import React, { useMemo } from 'react';
import { Dimensions, Text, TouchableOpacity, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';


const { width } = Dimensions.get('window');

// 개별 말풍선(버블) 컴포넌트
function Bubble({
  size,
  x,
  delay = 0,
}: {
  size: number;  // 지름
  x: number;     // 왼쪽 위치(px)
  delay?: number;
}) {
  const upDown = useSharedValue(0);
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0.85);

    React.useEffect(() => {
    upDown.value = withRepeat(
      withSequence(
        withDelay(delay, withTiming(-16, { duration: 1200, easing: Easing.out(Easing.quad) })),
        withTiming(0, { duration: 1200, easing: Easing.inOut(Easing.quad) })
      ),
      -1,
      true
    );

    scale.value = withRepeat(
      withSequence(
        withDelay(delay, withTiming(1.08, { duration: 900, easing: Easing.inOut(Easing.ease) })),
        withTiming(1, { duration: 900, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );

    opacity.value = withRepeat(
      withSequence(
        withDelay(delay, withTiming(1, { duration: 900, easing: Easing.linear })),
        withTiming(0.8, { duration: 900, easing: Easing.linear })
      ),
      -1,
      true
    );
  }, []);


  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: upDown.value }, { scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: size / 2,
          left: x,
          backgroundColor: '#5B8EF7', // 파란 버블
        },
        style,
      ]}
    />
  );
}

export default function SignupFinish() {
  // 버블 구성은 랜덤으로 한 번 생성
  const bubbles = useMemo(
    () => [
      { size: 112, x: width * 0.44, delay: 0 },
      { size: 88,  x: width * 0.60, delay: 150 },
      { size: 72,  x: width * 0.35, delay: 250 },
      { size: 48,  x: width * 0.30, delay: 400 },
      { size: 20,  x: width * 0.25, delay: 300 },
    ],
    []
  );

  return (
    <View style={{ flex: 1, backgroundColor: '#FFFCF5', padding: 24, justifyContent: 'space-between' }}>
      {/* 상단 인사 */}
      <View style={{ marginTop: 40 }}>
        <Text style={{ fontSize: 12, color: '#C4C4C4', marginBottom: 12 }}>회원가입</Text>
        <Text style={{ fontSize: 24, fontWeight: '800', color: '#3B82F6', textAlign: 'center' }}>
          안녕하세요, 형원님!
        </Text>
        <Text style={{ marginTop: 8, color: '#6B7280', textAlign: 'center' }}>
          어쩌구 저쩌구 따뜻하고 좋은 문장{'\n'}스크립트 스크립트 스크립트
        </Text>
      </View>

      {/* 버블 군집 */}
      <View style={{ height: 220, alignSelf: 'stretch', marginVertical: 8 }}>
        <View
          style={{
            position: 'absolute',
            left: width * 0.18,
            top: 100,
            width: 10,
            height: 10,
            borderRadius: 5,
            backgroundColor: '#5B8EF7',
            opacity: 0.9,
          }}
        />
        {bubbles.map((b, i) => (
          <Bubble key={i} size={b.size} x={b.x} delay={b.delay} />
        ))}
      </View>

      {/* 시작 버튼 */}
      <TouchableOpacity
        onPress={() => router.replace('/(tabs)')}
        style={{
          backgroundColor: '#3B82F6',
          borderRadius: 28,
          height: 56,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 8,
        }}
      >
        <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>시작하기</Text>
      </TouchableOpacity>
    </View>
  );
}




// import { View, Text, TouchableOpacity } from 'react-native';
// import { router } from 'expo-router';

// export default function SignupFinish() {
//   return (
//     <View style={{ flex:1, justifyContent:'center', alignItems:'center', backgroundColor:'#FFFCF8' }}>
//       <Text style={{ fontSize:26, fontWeight:'800', color:'#3B82F6', marginBottom:6 }}>안녕하세요, 형원님!</Text>
//       <Text style={{ textAlign:'center', color:'#6B7280', marginBottom:30 }}>
//         어쩌구 저쩌구 따뜻하고 좋은 스크립트{'\n'}스크립트스크립트스크립트
//       </Text>

//       <TouchableOpacity
//         onPress={() => router.replace('/(tabs)')}
//         style={{
//           backgroundColor:'#3B82F6',
//           borderRadius:24,
//           paddingVertical:14,
//           paddingHorizontal:48,
//         }}
//       >
//         <Text style={{ color:'#fff', fontWeight:'700' }}>시작하기</Text>
//       </TouchableOpacity>
//     </View>
//   );
// }
