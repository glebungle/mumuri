import { router } from 'expo-router';
import React from 'react';
import { Dimensions, Image, TouchableOpacity, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import AppText from '../components/AppText';

const { width } = Dimensions.get('window');

function Bubble({
  size,
  x,
  delay = 0,
}: {
  size: number; 
  x: number; 
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
          backgroundColor: '#5B8EF7', 
        },
        style,
      ]}
    />
  );
}

export default function SignupFinish() {

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFCF5', padding: 24, justifyContent: 'space-between' }}>
      
      {/* 상단 인사 */}
      <View style={{ marginTop: 40, alignItems: 'center' }}> 
        <Image
          source={require('../assets/images/BlueHeart.png')}
        />
        <AppText style={{ margin:30,fontSize: 24, color: '#3B82F6', textAlign: 'center' }}>
          안녕하세요, 00님!
        </AppText>
        <AppText type="medium" style={{ marginTop: 8, color: '#6B7280', textAlign: 'center', fontSize:12}}>
          어쩌구 저쩌구 따뜻하고 좋은 문장스크립트 스크립트 스크립트
        </AppText>
      </View>

      {/* 중앙 이미지 */}
      <Image
        source={require('../assets/images/Union.png')}
        style={{ alignSelf: 'center' }} 
      />

      {/* 시작 버튼 */}
      <TouchableOpacity
        onPress={() => router.replace('/(tabs)/camera')}
        style={{
          backgroundColor: '#3B82F6',
          borderRadius: 28,
          height: 56,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 8,
        }}
      >
        <AppText style={{ color: '#fff', fontSize: 14 }}>시작하기</AppText>
      </TouchableOpacity>
    </SafeAreaView>
  );
}
