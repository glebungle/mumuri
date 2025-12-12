import { useColorScheme } from '@/components/useColorScheme';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import * as Linking from 'expo-linking';
import { Stack, router } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { Alert } from 'react-native';
import 'react-native-reanimated';
import { UserProvider } from './context/UserContext'; // 경로 확인

export const unstable_settings = {
  initialRouteName: 'index',
};

SplashScreen.preventAutoHideAsync();

// 딥링크 URL에서 파라미터를 추출하여 로그인 처리하는 비동기 함수
const handleDeepLink = async (url: string) => {
  const urlObj = new URL(url);
  const params = urlObj.searchParams;

  const token = params.get('token');
  const nickname = params.get('nickname') || '사용자';
  const status = params.get('status'); // 예: 'NEW' (신규), 'EXISTING' (기존)
  const userId = params.get('userId'); // userId도 딥링크로 받을 경우

  if (token) {
    try {
      // AsyncStorage에 토큰 및 사용자 정보 저장
      await AsyncStorage.setItem('token', token);
      await AsyncStorage.setItem('name', nickname);
      if (userId) {
        await AsyncStorage.setItem('userId', userId);
      }

      console.log(`✅ DeepLink Login Success: ${nickname}. Status: ${status}`);
      Alert.alert('로그인 성공', `${nickname}님, 무무리에 오신 것을 환영합니다!`);

      // 사용자 상태에 따라 라우팅 (NEW면 /signup으로 이동)
      if (status === 'NEW' || status === 'NEED_INFO') {
        console.log('➡️ New user detected, routing to /signup');
        router.replace('/onboarding/intro');
      } else {
        console.log('➡️ Existing user, routing to /(tabs)');
        router.replace('/(tabs)/home');
      }
    } catch (e) {
      console.error('AsyncStorage 저장 오류:', e);
      Alert.alert('오류', '로그인 정보를 저장하는 데 실패했습니다.');
    }
  } else {
    console.error('DeepLink Error: Token not found in URL.');
    Alert.alert('로그인 오류', '로그인 처리 중 필수 정보를 받지 못했습니다.');
  }
};

export default function RootLayout() {
  const [loaded, error] = useFonts({
    'Pretendard-ExtraBold': require('../assets/fonts/Pretendard-ExtraBold.ttf'),
    'Pretendard-Bold': require('../assets/fonts/Pretendard-Bold.ttf'),
    'Pretendard-Medium': require('../assets/fonts/Pretendard-Medium.ttf'),
    'Pretendard-SemiBold': require('../assets/fonts/Pretendard-SemiBold.ttf'),
    'Pretendard-Regular': require('../assets/fonts/Pretendard-Regular.ttf'),
    'Pretendard-Light': require('../assets/fonts/Pretendard-Light.ttf'),
    'Pretendard-ExtraLight': require('../assets/fonts/Pretendard-ExtraLight.ttf'),
    'Pretendard-Thin': require('../assets/fonts/Pretendard-Thin.ttf'),
    'Paperlogy-8ExtraBold': require('../assets/fonts/Paperlogy-8ExtraBold.ttf'),
    'Paperlogy-7Bold': require('../assets/fonts/Paperlogy-7Bold.ttf'),
    'Paperlogy-5Medium': require('../assets/fonts/Paperlogy-5Medium.ttf'),
    'Paperlogy-6SemiBold': require('../assets/fonts/Paperlogy-6SemiBold.ttf'),
    'Paperlogy-4Regular': require('../assets/fonts/Paperlogy-4Regular.ttf'),
    'Paperlogy-3Light': require('../assets/fonts/Paperlogy-3Light.ttf'),
    'Paperlogy-2ExtraLight': require('../assets/fonts/Paperlogy-2ExtraLight.ttf'),
    'Paperlogy-1Thin': require('../assets/fonts/Paperlogy-1Thin.ttf'),
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    ...FontAwesome.font,
  });

  // 딥링크 리스너 설정 (앱이 실행된 후)
  useEffect(() => {
    // 앱이 이미 실행 중일 때 새로운 딥링크가 들어오는 경우 처리
    const subscription = Linking.addEventListener('url', (event) => {
      if (event.url.startsWith('mumuri://oauth/kakao')) {
        handleDeepLink(event.url);
      }
    });

    // 앱이 딥링크로 처음 실행되었을 때 처리
    Linking.getInitialURL().then((url) => {
      if (url && url.startsWith('mumuri://oauth/kakao')) {
        handleDeepLink(url);
      }
    });

    return () => {
      subscription.remove();
    };
  }, [loaded]); // 폰트 로드 이후 리스너 설정

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) SplashScreen.hideAsync();
  }, [loaded]);

  if (!loaded) return null;
  return <RootLayoutNav />;
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();

  return (
    <UserProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="signup" />
          <Stack.Screen name="signup-finish" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
        </Stack>
      </ThemeProvider>
    </UserProvider>
  );
}
