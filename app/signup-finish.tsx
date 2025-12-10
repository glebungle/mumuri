import { router } from 'expo-router';
import React from 'react';
import { Dimensions, Image, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AppText from '../components/AppText';

const { width } = Dimensions.get('window');

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
      </View>

      {/* 시작 버튼 */}
      <TouchableOpacity
        onPress={() => router.replace('/(tabs)/home')}
        style={{
          backgroundColor: '#FF9191',
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
