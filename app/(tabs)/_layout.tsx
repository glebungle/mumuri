// app/(tabs)/_layout.tsx
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { withLayoutContext } from 'expo-router';

const { Navigator } = createMaterialTopTabNavigator();
export const TopTabs = withLayoutContext(Navigator);

export default function TabsLayout() {
  return (
    <TopTabs
      tabBar={() => null}
      screenOptions={{
        swipeEnabled: true,   // 좌우 스와이프 허용
        lazy: true,           // 필요할 때 렌더
      }}
    >
      <TopTabs.Screen name="gallery" options={{ title: '게시판' }} />
      <TopTabs.Screen name="camera" options={{ title: '카메라' }} />
      <TopTabs.Screen name="chat" options={{ title: '채팅' }} />
      {/* <TopTabs.Screen name="index" options={{ title: '임시' }} /> */}
      {/* push 로만 진입: 스와이프/탭 목록에서 숨김 */}
      <TopTabs.Screen name="share" options={{ href: null }} />
    </TopTabs>
  );
}
