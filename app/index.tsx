import { router } from 'expo-router';
import { ActivityIndicator, Button, Text, View } from 'react-native';
import KakaoLoginButton from '../components/KakaoLoginButton';

export default function RootSplash() {
  // useEffect(() => {
  //   const timer = setTimeout(() => {
  //     // 로그인 또는 회원가입 여부 체크 후 분기!!

  //     router.replace('/signup'); // 또는 바로 '/(tabs)'
  //   }, 1000);
  //   return () => clearTimeout(timer);
  // }, []);

  return (
    <View style={{ flex:1, alignItems:'center', justifyContent:'center' }}>
      <Text style={{ fontSize:22, fontWeight:'700' }}>무무리</Text>
      <ActivityIndicator style={{ marginTop:20 }} />
      <Text style={{ color:'#6B7280' }}>카카오로 시작하기</Text>
      <KakaoLoginButton />
      <Button title="회원가입으로 이동" onPress={() => router.push('/signup')} />
    </View>
  );
}
