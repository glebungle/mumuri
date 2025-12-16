import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  SafeAreaView,
  StyleSheet,
  View,
} from 'react-native';
import AppText from '../components/AppText';
import { useUser } from './context/UserContext';

const BASE_URL = 'https://mumuri.shop';
const defaultProfileImg = require('../assets/images/userprofile.png'); 

export default function EditProfileScreen() {
  const { userData, refreshUserData } = useUser();
  const [loading, setLoading] = useState(false);

  // 현재 표시할 이미지 (Context에 있으면 URL, 없으면 기본 이미지)
  const currentImage = userData?.myProfileImageUrl
    ? { uri: userData.myProfileImageUrl }
    : defaultProfileImg;

  // 1. 갤러리에서 사진 선택 및 업로드 (등록/수정)
  const pickAndUploadImage = async () => {
    // 권한 요청
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('권한 필요', '사진 라이브러리 접근 권한이 필요합니다.');
      return;
    }

    // 이미지 선택
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, // 편집 허용 (크롭 등)
      aspect: [1, 1],      // 1:1 비율
      quality: 0.8,        // 용량 최적화
    });

    if (!result.canceled) {
      await uploadProfileImage(result.assets[0].uri);
    }
  };

  // 2. 프로필 사진 업로드
  const uploadProfileImage = async (uri: string) => {
    try {
      setLoading(true);
      const token = await AsyncStorage.getItem('token');
      if (!token) return;

      // FormData 생성
      const formData = new FormData();
      formData.append('file', {
        uri: uri,
        name: 'profile.jpg',
        type: 'image/jpeg',
      } as any);

      const res = await fetch(`${BASE_URL}/profile-photo`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data', 
        },
        body: formData,
      });

      if (res.ok) {
        await refreshUserData();
        Alert.alert('완료', '프로필 사진이 변경되었습니다.');
      } else {
        const errorText = await res.text();
        console.error('Upload Failed:', errorText);
        Alert.alert('실패', '사진 업로드에 실패했습니다.');
      }
    } catch (e) {
      console.error(e);
      Alert.alert('오류', '서버 통신 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 3. 프로필 사진 삭제 
  const deleteProfileImage = async () => {
    if (!userData?.myProfileImageUrl) {
        Alert.alert('알림', '삭제할 프로필 사진이 없습니다.');
        return;
    }

    Alert.alert('사진 삭제', '기본 이미지로 되돌리시겠습니까?', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: async () => {
          try {
            setLoading(true);
            const token = await AsyncStorage.getItem('token');
            const res = await fetch(`${BASE_URL}/profile-photo`, {
              method: 'DELETE',
              headers: { Authorization: `Bearer ${token}` },
            });

            if (res.ok) {
              await refreshUserData();
              Alert.alert('완료', '프로필 사진이 삭제되었습니다.');
            } else {
              Alert.alert('실패', '사진 삭제에 실패했습니다.');
            }
          } catch (e) {
            console.error(e);
          } finally {
            setLoading(false);
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* 헤더 */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={{padding: 10}}>
          <Ionicons name="chevron-back" size={28} color="#444" />
        </Pressable>
        <AppText type="pretendard-b" style={styles.headerTitle}>프로필 편집</AppText>
        <View style={{ width: 48 }} /> 
      </View>

      <View style={styles.content}>
        {/* 프로필 이미지 영역 */}
        <View style={styles.imageWrapper}>
          <Image source={currentImage} style={styles.profileImage} resizeMode="cover" />
          
          {/* 로딩 인디케이터 */}
          {loading && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="small" color="#FFF" />
            </View>
          )}

          {/* 카메라 아이콘 버튼 */}
          <Pressable style={styles.cameraButton} onPress={pickAndUploadImage} disabled={loading}>
            <Ionicons name="camera" size={20} color="#FFF" />
          </Pressable>
        </View>

        {/* 버튼 그룹 */}
        <View style={styles.buttonGroup}>
          <Pressable style={styles.actionButton} onPress={pickAndUploadImage} disabled={loading}>
            <AppText style={styles.actionButtonText}>사진 변경</AppText>
          </Pressable>
          
          <View style={styles.divider} />

          <Pressable style={styles.actionButton} onPress={deleteProfileImage} disabled={loading}>
            <AppText style={[styles.actionButtonText, { color: '#FF6B6B' }]}>사진 삭제</AppText>
          </Pressable>
        </View>

        {/* (추가 가능) 닉네임 변경 등 다른 편집 폼이 들어갈 자리 */}
        <View style={{ marginTop: 40, alignItems:'center' }}>
            <AppText style={{color:'#999', fontSize:13}}>이름 및 생일 변경 기능 준비중...</AppText>
        </View>

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFCF5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  headerTitle: {
    fontSize: 18,
    color: '#333',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 40,
  },
  imageWrapper: {
    width: 120,
    height: 120,
    marginBottom: 20,
  },
  profileImage: {
    width: '100%',
    height: '100%',
    borderRadius: 60,
    borderWidth: 1,
    borderColor: '#EEE',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#444',
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFFCF5',
  },
  buttonGroup: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    borderRadius: 12,
    marginTop: 10,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  actionButton: {
    paddingHorizontal: 16,
  },
  actionButtonText: {
    fontSize: 15,
    color: '#333',
    fontFamily: 'Pretendard-Medium',
  },
  divider: {
    width: 1,
    height: 16,
    backgroundColor: '#E0E0E0',
    marginHorizontal: 4,
  },
});