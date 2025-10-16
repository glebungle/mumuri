// app/(auth)/_layout.tsx
import { Stack } from 'expo-router';
export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="signup" />        {/* 필요하면 */}
      <Stack.Screen name="signup-finish" /> {/* 필요하면 */}
    </Stack>
  );
}
