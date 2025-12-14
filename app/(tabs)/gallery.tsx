import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
// ✅ [수정] addHours 추가 (시간 보정용)
import { addHours, format, parseISO } from 'date-fns';
import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppText from '../../components/AppText';
import { useUser } from '../context/UserContext';

const BASE_URL = 'https://mumuri.shop';
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

/** ========= FileSystem 안전 사용 래퍼 ========= */
const FS = FileSystem as any;
function getWritableDir(): string {
  const base = FS.documentDirectory ?? FS.cacheDirectory ?? '';
  if (!base) return '';
  return base.endsWith('/') ? base : base + '/';
}
/** =========================================== */

type Photo = {
  id: string;
  url: string;
  createdAt: string;
  missionId?: number;
};

// --- 데이터 정규화 ---
function normalizePhoto(raw: any): Photo | null {
  if (!raw || typeof raw !== 'object') return null;
  const id = raw.id ?? raw.photo_id ?? raw.photoId;
  const url = raw.photoUrl ?? raw.url ?? raw.presignedUrl;
  const createdAt = raw.createdAt ?? raw.created_at;

  if (!id || !url || !createdAt) return null;

  return {
    id: String(id),
    url: String(url),
    createdAt: String(createdAt),
    missionId: raw.missionId,
  };
}

export default function GalleryScreen() {
  const insets = useSafeAreaInsets();
  
  const { userData } = useUser();
  const coupleId = userData?.coupleId || null;

  const [loading, setLoading] = useState(true);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  // 뷰어 관련 상태
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number | null>(null);
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const [saving, setSaving] = useState(false);

  // --- 데이터 로드 ---
  const loadPhotos = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      
      console.log('============== [Gallery Debug] ==============');
      console.log('🔑 현재 토큰:', token ? `${token.slice(0, 10)}...` : '없음');
      console.log('❤️ 현재 커플ID:', coupleId);

      if (!token || !coupleId) {
        console.log('❌ 토큰이나 커플ID가 없어서 초기화합니다.');
        setPhotos([]);
        setLoading(false);
        return;
      }

      const url = `${BASE_URL}/photo/${coupleId}/all`;
      console.log('🚀 요청 URL:', url);

      const res = await fetch(url, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'ngrok-skip-browser-warning': 'true',
          Authorization: `Bearer ${token}`,
        },
      });

      console.log('📡 응답 상태:', res.status);

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const data = await res.json();
      
      const rawList = Array.isArray(data) ? data : (data.items || []);
      const parsed = rawList.map(normalizePhoto).filter(Boolean) as Photo[];
      
      // 최신순 정렬
      parsed.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      console.log(`📸 로드된 사진 개수: ${parsed.length}장`);
      setPhotos(parsed);

    } catch (e) {
      console.warn('[Gallery] Load failed:', e);
      setPhotos([]); 
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [coupleId]); 

  useFocusEffect(
    useCallback(() => {
      loadPhotos();
    }, [loadPhotos])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadPhotos();
  };

  // --- 사진 저장 ---
  const handleDownload = async () => {
    if (selectedPhotoIndex === null) return;
    const photo = photos[selectedPhotoIndex];
    
    try {
      setSaving(true);
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('권한 필요', '사진을 저장하려면 갤러리 접근 권한이 필요합니다.');
        return;
      }

      const filename = `mumuri_${photo.id}.jpg`;
      const fileUri = `${getWritableDir()}${filename}`;

      const { uri } = await FileSystem.downloadAsync(photo.url, fileUri);
      await MediaLibrary.saveToLibraryAsync(uri);
      
      Alert.alert('저장 완료', '앨범에 사진이 저장되었습니다.');
      setIsMenuVisible(false);
    } catch (e) {
      Alert.alert('오류', '사진 저장에 실패했습니다.');
      console.warn(e);
    } finally {
      setSaving(false);
    }
  };

  const handlePostToHome = () => {
    Alert.alert('알림', '홈화면 게시 기능은 준비 중입니다! 🚧');
    setIsMenuVisible(false);
  };

  // --- 네비게이션 ---
  const goHome = () => router.push('/(tabs)/home');
  const goMyPage = () => router.push('/mypage');

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#333" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* 1. 상단 헤더 */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <View style={styles.tabSwitch}>
          <Pressable onPress={goHome} style={styles.inactiveTab}>
            <AppText type='medium' style={styles.inactiveTabText}>   홈   </AppText>
          </Pressable>
          <Pressable style={styles.activeTab}>
            <AppText style={styles.activeTabText}>갤러리</AppText>
            <View style={styles.activeIndicator} />
          </Pressable>
        </View>
        <Pressable onPress={goMyPage}>
          <Ionicons name="person-circle-outline" size={32} color="#111" />
        </Pressable>
      </View>

      {/* 2. 그리드 뷰 */}
      {!coupleId ? (
        <View style={styles.center}>
          <AppText type='medium' style={styles.emptyText}>마이페이지에서 커플을 연결해주세요!</AppText>
        </View>
      ) : photos.length === 0 ? (
        <View style={styles.center}>
          <AppText style={styles.emptyText}>아직 업로드된 사진이 없어요.</AppText>
        </View>
      ) : (
        <FlatList
          data={photos}
          keyExtractor={(item) => item.id}
          numColumns={3}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          renderItem={({ item, index }) => (
            <Pressable 
              style={({ pressed }) => [styles.gridItem, pressed && { opacity: 0.8 }]}
              onPress={() => setSelectedPhotoIndex(index)}
            >
              <Image source={{ uri: item.url }} style={styles.gridImage} resizeMode="cover" />
            </Pressable>
          )}
        />
      )}

      {/* 3. 전체 화면 뷰어 모달 */}
      <Modal
        visible={selectedPhotoIndex !== null}
        transparent={true}
        onRequestClose={() => setSelectedPhotoIndex(null)}
        animationType="fade"
      >
        <View style={styles.modalContainer}>
          {/* 뷰어 헤더 */}
          <View style={[styles.viewerHeader, { paddingTop: insets.top + 10 }]}>
            <Pressable onPress={() => setSelectedPhotoIndex(null)} style={{ padding: 8 }}>
              <Ionicons name="close" size={28} color="#FFF" />
            </Pressable>
            
            {/* ✅ [수정] 한국 시간(UTC+9) 보정하여 날짜 표시 */}
            {selectedPhotoIndex !== null && (
              <AppText style={styles.viewerDate}>
                {format(
                  addHours(parseISO(photos[selectedPhotoIndex].createdAt), 9), 
                  'yyyy. MM. dd'
                )}
              </AppText>
            )}

            <Pressable onPress={() => setIsMenuVisible(!isMenuVisible)} style={{ padding: 8 }}>
              <Ionicons name="ellipsis-horizontal" size={24} color="#FFF" />
            </Pressable>
          </View>

          {/* 메뉴 팝업 */}
          {isMenuVisible && (
            <View style={[styles.menuPopup, { top: insets.top + 60 }]}>
              <Pressable style={styles.menuItem} onPress={handlePostToHome}>
                <AppText style={styles.menuText}>홈화면 게시</AppText>
              </Pressable>
              <View style={styles.menuDivider} />
              <Pressable style={styles.menuItem} onPress={handleDownload} disabled={saving}>
                <AppText style={styles.menuText}>{saving ? '저장 중...' : '다운로드'}</AppText>
              </Pressable>
            </View>
          )}

          {/* 슬라이드 뷰어 */}
          {selectedPhotoIndex !== null && (
            <FlatList
              data={photos}
              horizontal
              pagingEnabled
              initialScrollIndex={selectedPhotoIndex}
              getItemLayout={(_, index) => (
                { length: SCREEN_WIDTH, offset: SCREEN_WIDTH * index, index }
              )}
              keyExtractor={(item) => item.id}
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={(e) => {
                const newIndex = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
                setSelectedPhotoIndex(newIndex);
                setIsMenuVisible(false); // 페이지 넘기면 메뉴 닫기
              }}
              renderItem={({ item }) => (
                <View style={styles.fullScreenImageContainer}>
                  <Image 
                    source={{ uri: item.url }} 
                    style={styles.fullScreenImage} 
                    resizeMode="contain" 
                  />
                </View>
              )}
            />
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop:'7%',
    backgroundColor: '#FFFCF5',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: '#808080',
    fontSize: 16,
    marginBottom:'50%',
  },

  // --- 헤더 ---
  header: {
    paddingHorizontal:20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 10,
    backgroundColor: '#FFFCF5',
  },
  tabSwitch: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
  },
  activeTab: {
    alignItems: 'center',
    paddingBottom: 4,
  },
  activeTabText: {
    color: '#111',
    fontSize: 14,
  },
  activeIndicator: {
    width: '100%',
    height: 2,
    backgroundColor: '#111',
    marginTop: 4,
  },
  inactiveTab: {
    paddingBottom: 10,
  },
  inactiveTabText: {
    color: '#666666',
    fontSize: 14,
  },

  // --- 그리드 ---
  gridItem: {
    width: SCREEN_WIDTH / 3,
    height: SCREEN_WIDTH/1.5,
    borderWidth: 0.5,
    borderColor: '#FFF',
  },
  gridImage: {
    width: '100%',
    height: '100%',
  },

  // --- 뷰어 ---
  modalContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  viewerHeader: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    zIndex: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 20,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  viewerDate: {
    color: '#FFF',
    fontSize: 16,
  },
  fullScreenImageContainer: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullScreenImage: {
    width: '100%',
    height: '80%',
  },

  // --- 메뉴 팝업 ---
  menuPopup: {
    position: 'absolute',
    right: 16,
    zIndex: 20,
    backgroundColor: '#FFF',
    borderRadius: 8,
    paddingVertical: 4,
    width: 140,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  menuItem: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  menuDivider: {
    height: 1,
    backgroundColor: '#EEE',
    marginHorizontal: 10,
  },
  menuText: {
    fontSize: 14,
    color: '#333',
  },
});