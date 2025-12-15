import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { addHours, format, parseISO } from 'date-fns';
import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  FlatList,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  TouchableWithoutFeedback,
  View
} from 'react-native';
import AppText from '../../components/AppText';
import { useUser } from '../context/UserContext';

const BASE_URL = 'https://mumuri.shop';
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// --- 파일 시스템 래퍼 및 유틸리티 ---
const FS = FileSystem as any;
function getWritableDir(): string {
  const base = FS.documentDirectory ?? FS.cacheDirectory ?? '';
  if (!base) return '';
  return base.endsWith('/') ? base : base + '/';
}

type Photo = { id: string; url: string; createdAt: string; missionId?: number; };
function normalizePhoto(raw: any): Photo | null {
  if (!raw || typeof raw !== 'object') return null;
  const id = raw.id ?? raw.photo_id ?? raw.photoId;
  const url = raw.photoUrl ?? raw.url ?? raw.presignedUrl;
  const createdAt = raw.createdAt ?? raw.created_at;
  if (!id || !url || !createdAt) return null;
  return { id: String(id), url: String(url), createdAt: String(createdAt), missionId: raw.missionId };
}

// 토스트 메시지 컴포넌트
const ToastMessage = ({ message, visible, onHide }: { message: string, visible: boolean, onHide: () => void }) => {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.delay(2000), // 2초 대기
        Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start(() => onHide());
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <Animated.View style={[styles.toastContainer, { opacity }]}>
      <AppText type='medium' style={styles.toastText}>{message}</AppText>
    </Animated.View>
  );
};

export default function GalleryView() {
  const { userData } = useUser();
  const coupleId = userData?.coupleId || null;

  const [loading, setLoading] = useState(true);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number | null>(null);
  
  // 메뉴 & 저장 상태
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const [saving, setSaving] = useState(false);

  // 토스트 상태
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMsg, setToastMsg] = useState('');

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setToastVisible(true);
  };

  // 데이터 로드
  const loadPhotos = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token || !coupleId) {
        setPhotos([]);
        setLoading(false);
        return;
      }
      const url = `${BASE_URL}/photo/${coupleId}/all`;
      const res = await fetch(url, {
        method: 'GET',
        headers: { Accept: 'application/json', 'ngrok-skip-browser-warning': 'true', Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const rawList = Array.isArray(data) ? data : (data.items || []);
      const parsed = rawList.map(normalizePhoto).filter(Boolean) as Photo[];
      parsed.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setPhotos(parsed);
    } catch (e) {
      console.warn('[Gallery] Load failed:', e);
      setPhotos([]); 
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [coupleId]); 

  useFocusEffect(useCallback(() => { loadPhotos(); }, [loadPhotos]));
  const onRefresh = () => { setRefreshing(true); loadPhotos(); };

  // 사진 저장 로직
  const handleDownload = async () => {
    if (selectedPhotoIndex === null) return;
    const photo = photos[selectedPhotoIndex];
    try {
      setSaving(true);
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') { Alert.alert('권한 필요', '갤러리 권한이 필요합니다.'); return; }
      
      const filename = `mumuri_${photo.id}.jpg`;
      const fileUri = `${getWritableDir()}${filename}`;
      const { uri } = await FileSystem.downloadAsync(photo.url, fileUri);
      await MediaLibrary.saveToLibraryAsync(uri);
      
      setIsMenuVisible(false);
      showToast('앨범에 저장되었습니다.');

    } catch (e) { 
      Alert.alert('오류', '저장 실패'); 
    } finally { 
      setSaving(false); 
    }
  };

  const handlePostToHome = () => { 
    setIsMenuVisible(false); 
    showToast('홈화면 게시 기능 준비 중입니다! 🚧');
  };

  // 🟢 [수정] 뷰어 닫기 핸들러 (메뉴 상태도 초기화)
  const handleCloseViewer = () => {
    setSelectedPhotoIndex(null);
    setIsMenuVisible(false); // 메뉴 닫기 강제
  };

  // 메뉴 외부 터치 핸들러
  const closeMenu = () => {
    if (isMenuVisible) setIsMenuVisible(false);
  };

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#333" /></View>;

  return (
    <View style={styles.container}>
      {/* 헤더 공간 확보용 */}
      <View style={{ height: 10}} />

      {!coupleId ? (
        <View style={styles.center}><AppText type='medium' style={styles.emptyText}>마이페이지에서 커플을 연결해주세요!</AppText></View>
      ) : photos.length === 0 ? (
        <View style={styles.center}><AppText style={styles.emptyText}>아직 사진이 없어요.</AppText></View>
      ) : (
        <FlatList
          data={photos}
          keyExtractor={(item) => item.id}
          numColumns={3}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          renderItem={({ item, index }) => (
            <Pressable style={({ pressed }) => [styles.gridItem, pressed && { opacity: 0.8 }]} onPress={() => setSelectedPhotoIndex(index)}>
              <Image source={{ uri: item.url }} style={styles.gridImage} resizeMode="cover" />
            </Pressable>
          )}
        />
      )}

      {/* 뷰어 모달 */}
      <Modal visible={selectedPhotoIndex !== null} transparent={true} onRequestClose={handleCloseViewer} animationType="fade">
        <View style={styles.modalContainer}>
          
          {/* 🟢 [수정] 헤더 zIndex: 30 (오버레이보다 높게 설정하여 클릭 보장) */}
          <View style={[styles.viewerHeader, { paddingTop: 50 }]}>
            <Pressable onPress={handleCloseViewer} style={{ padding: 8 }}>
              <Ionicons name="close" size={28} color="#FFF" />
            </Pressable>
            {selectedPhotoIndex !== null && (
              <AppText style={styles.viewerDate}>{format(addHours(parseISO(photos[selectedPhotoIndex].createdAt), 9), 'yyyy. MM. dd')}</AppText>
            )}
            <Pressable onPress={() => setIsMenuVisible(!isMenuVisible)} style={{ padding: 8 }}>
              <Ionicons name="ellipsis-vertical" size={24} color="#FFF" />
            </Pressable>
          </View>

          {/* 메뉴 외부 터치 시 닫기 위한 투명 오버레이 (zIndex: 15) */}
          {isMenuVisible && (
            <TouchableWithoutFeedback onPress={closeMenu}>
              <View style={[StyleSheet.absoluteFillObject, { zIndex: 15 }]} />
            </TouchableWithoutFeedback>
          )}

          {/* 메뉴 팝업 (zIndex: 20) */}
          {isMenuVisible && (
            <View style={[styles.menuPopup, { top: 100 }]}>
              <Pressable style={styles.menuItem} onPress={handlePostToHome}>
                <AppText type='semibold' style={styles.menuText}>홈화면 게시</AppText></Pressable>
              <View style={styles.menuDivider} />
              <Pressable style={styles.menuItem} onPress={handleDownload} disabled={saving}>
                <AppText type='semibold' style={styles.menuText}>{saving ? '저장 중...' : '다운로드'}</AppText>
              </Pressable>
            </View>
          )}

          {/* 이미지 슬라이더 */}
          {selectedPhotoIndex !== null && (
            <FlatList
              data={photos} horizontal pagingEnabled initialScrollIndex={selectedPhotoIndex}
              getItemLayout={(_, index) => ({ length: SCREEN_WIDTH, offset: SCREEN_WIDTH * index, index })}
              keyExtractor={(item) => item.id}
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={(e) => {
                const newIndex = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
                setSelectedPhotoIndex(newIndex);
                setIsMenuVisible(false); // 페이지 넘기면 메뉴 닫기
              }}
              renderItem={({ item }) => (
                <Pressable onPress={closeMenu}> 
                  <View style={styles.fullScreenImageContainer}>
                    <Image source={{ uri: item.url }} style={styles.fullScreenImage} resizeMode="contain" />
                  </View>
                </Pressable>
              )}
            />
          )}

          {/* 토스트 메시지 */}
          <ToastMessage 
            message={toastMsg} 
            visible={toastVisible} 
            onHide={() => setToastVisible(false)} 
          />

        </View>
      </Modal>
    </View>
  );
}

// Gallery CSS
const styles = StyleSheet.create({
  container: { flex: 1},
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { color: '#808080', fontSize: 16, marginBottom:'50%' },
  gridItem: { width: SCREEN_WIDTH / 3, height: SCREEN_WIDTH/1.5, borderWidth: 0.5, borderColor: '#FFF' },
  gridImage: { width: '100%', height: '100%' },
  modalContainer: { flex: 1, backgroundColor: '#000' },
  
  viewerHeader: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 17, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 20, backgroundColor: 'rgba(0,0,0,0.4)' },
  viewerDate: { color: '#FFF', fontSize: 16 },
  
  fullScreenImageContainer: { width: SCREEN_WIDTH, height: SCREEN_HEIGHT, justifyContent: 'center', alignItems: 'center' },
  fullScreenImage: { width: '100%', height: '80%' },
  
  // 메뉴 zIndex: 20
  menuPopup: { position: 'absolute', right: 16, zIndex: 20, backgroundColor: '#FFF', borderRadius: 12, paddingVertical: 4, width: '30%', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 3.84, elevation: 5 },
  menuItem: { paddingVertical: 12, alignItems: 'center' },
  menuDivider: { height: 1, backgroundColor: '#EEE', marginHorizontal: 10 },
  menuText: { fontSize: 12, color: '#333' },

  toastContainer: {
    position: 'absolute',
    bottom: 50,
    alignSelf: 'center',
    backgroundColor: 'rgba(50, 50, 50, 0.9)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    zIndex: 100,
  },
  toastText: {
    color: '#FFF',
    fontSize: 14,
  },
});