// app/oauth/kakao.tsx
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useRef } from 'react';
import { ActivityIndicator, Alert, View } from 'react-native';
import { authedFetch, normalizeMe } from '../lib/api';
import { hydrateUserBasicsFromGetuser } from '../lib/userBasics';

export default function KakaoDeepLinkHandler() {
  const { token, nickname, status } = useLocalSearchParams<{ token?: string; nickname?: string; status?: string }>();
  const once = useRef(false);

  useEffect(() => {
    (async () => {
      if (once.current) return;
      if (!token) {
        Alert.alert('로그인 오류', '토큰이 없습니다.');
        router.replace('/(auth)');
        return;
      }
      once.current = true;

      try {
        // 1) 토큰/닉네임 저장
        await AsyncStorage.setItem('token', String(token));
        if (nickname) await AsyncStorage.setItem('name', String(nickname));
        await hydrateUserBasicsFromGetuser(); //userId
        

        // 2) /user/getuser 
        const raw = await authedFetch('/user/getuser', { method: 'GET' });
        const me = normalizeMe(raw);
        const kv: [string,string][] = [];
        if (me.userId != null)   kv.push(['userId', String(me.userId)]);
        if (me.coupleId != null) kv.push(['coupleId', String(me.coupleId)]);
        if (me.coupleCode)       kv.push(['coupleCode', me.coupleCode]);
        if (me.name)             kv.push(['name', me.name]);
        if (kv.length) await AsyncStorage.multiSet(kv);

        // 3) 라우팅
        if (status === 'NEW' || status === 'NEED_INFO') router.replace('/signup');
        else router.replace('/(tabs)/camera');
      } catch (e: any) {
        console.warn('getuser failed:', e?.message);
        // // 그래도 회원가입으로 안내
        // router.replace('/signup');
      }
    })();
  }, [token, nickname, status]);

  return (
    <View style={{ flex:1, alignItems:'center', justifyContent:'center' }}>
      <ActivityIndicator />
    </View>
  );
}