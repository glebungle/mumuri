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
        swipeEnabled: true,  
        lazy: true,   
      }}
    >
      <TopTabs.Screen name="home" options={{ title: '홈' }} />
      <TopTabs.Screen name="gallery" options={{ title: '갤러리' }} />
    </TopTabs>
  );
}
