// app/(tabs)/_layout.tsx
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { withLayoutContext } from 'expo-router';

const { Navigator } = createMaterialTopTabNavigator();
export const TopTabs = withLayoutContext(Navigator);

export default function TabsLayout() {
  return (
    <TopTabs
      // ✅ 탭바 완전 숨김: screenOptions가 아니라 여기!
      tabBar={() => null}
      screenOptions={{
        swipeEnabled: true,   // 좌우 스와이프 허용
        lazy: true,           // 필요할 때 렌더
      }}
    >
      <TopTabs.Screen name="camera" options={{ title: '카메라' }} />
      <TopTabs.Screen name="two" options={{ title: 'two' }} />
      {/* push 로만 진입: 스와이프/탭 목록에서 숨김 */}
      <TopTabs.Screen name="share" options={{ href: null }} />
    </TopTabs>
  );
}
