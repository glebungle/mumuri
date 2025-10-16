// app/_layout.tsx
import { useColorScheme } from '@/components/useColorScheme';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import 'react-native-reanimated';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [loaded, error] = useFonts({
        // Pretendard 폰트 로드 유지
        'Pretendard-ExtraBold': require('../assets/fonts/Pretendard-ExtraBold.ttf'),
        'Pretendard-Bold': require('../assets/fonts/Pretendard-Bold.ttf'),
        'Pretendard-Medium': require('../assets/fonts/Pretendard-Medium.ttf'),
        'Pretendard-SemiBold': require('../assets/fonts/Pretendard-SemiBold.ttf'),
        'Pretendard-Regular': require('../assets/fonts/Pretendard-Regular.ttf'),
        'Pretendard-Light': require('../assets/fonts/Pretendard-Light.ttf'),
        'Pretendard-ExtraLight': require('../assets/fonts/Pretendard-ExtraLight.ttf'),
        'Pretendard-Thin': require('../assets/fonts/Pretendard-Thin.ttf'),
        SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
        ...FontAwesome.font,
    });

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />           {/* 게이트키퍼 */}
        <Stack.Screen name="oauth/kakao" />     {/* 딥링크 라우트 */}
        <Stack.Screen name="(auth)" />          {/* 인증 스택 */}
        <Stack.Screen name="(tabs)" />          {/* 탭 스택 */}
      </Stack>
    </ThemeProvider>
  );
}
