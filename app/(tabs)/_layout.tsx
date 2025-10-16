// app/(tabs)/_layout.tsx
import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }}>
      <Tabs.Screen
        name="camera"
        options={{
          title: '카메라',
          tabBarIcon: ({ color, size }) => <Ionicons name="camera" color={color} size={size} />
        }}
      />
      {/* share는 탭바 숨기고 push로만 들어가게 */}
      <Tabs.Screen name="share" options={{ href: null }} />
    </Tabs>
  );
}
