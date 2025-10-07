// app/signup.tsx
import { router } from 'expo-router';
import { Button, Text, View } from 'react-native';

export default function Signup() {
  return (
    <View style={{ flex:1, justifyContent:'center', alignItems:'center' }}>
      <Text>회원가입 화면</Text>
      <Button title="돌아가기" onPress={() => router.back()} />
    </View>
  );
}
