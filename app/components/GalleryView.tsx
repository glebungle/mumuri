import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { addHours, format, parseISO } from 'date-fns';
import * as FileSystem from 'expo-file-system/legacy';
// import { LinearGradient } from 'expo-linear-gradient'; 
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppText from '../../components/AppText';
import { useUser } from '../context/UserContext';

const BASE_URL = 'https://mumuri.shop';
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const calendarImg = require('../../assets/images/calendar.png');

// --- 파일 시스템 래퍼 ---
const FS = FileSystem as any;
function getWritableDir(): string {
  const base = FS.documentDirectory ?? FS.cacheDirectory ?? '';
  if (!base) return '';
  return base.endsWith('/') ? base : base + '/';
}

type Photo = { 
  id: string; 
  url: string; 
  createdAt: string; 
  missionTitle?: string; 
  ownerNickname?: string;
};

function normalizePhoto(raw: any): Photo | null {
  if (!raw || typeof raw !== 'object') return null;
  const id = raw.photoId ?? raw.id;
  const url = raw.imageUrl ?? raw.photoUrl ?? raw.url;
  const createdAt = raw.createdAt;
  if (!id || !url || !createdAt) return null;
  return { 
    id: String(id), 
    url: String(url), 
    createdAt: String(createdAt), 
    missionTitle: raw.missionText || undefined,
    ownerNickname: raw.ownerNickname
  };
}

const ToastMessage = ({ message, visible, onHide }: { message: string, visible: boolean, onHide: () => void }) => {
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (visible) {
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.delay(2000), 
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
  const insets = useSafeAreaInsets();
  const { userData, refreshUserData } = useUser();
  const coupleId = userData?.coupleId || null;

  const [loading, setLoading] = useState(true);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number | null>(null);
  
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMsg, setToastMsg] = useState('');

  const viewerListRef = useRef<FlatList<Photo> | null>(null);

  const showToast = (msg: string) => { setToastMsg(msg); setToastVisible(true); };

  const loadPhotos = useCallback(async (pageNum: number, shouldRefresh: boolean = false) => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) return;
      if (pageNum === 0) setLoading(true);

      const url = `${BASE_URL}/photos/gallery?page=${pageNum}&size=20&sort=createdAt,desc`; 
      const res = await fetch(url, {
        method: 'GET',
        headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const rawList = data.content || [];
      const parsed = rawList.map(normalizePhoto).filter(Boolean) as Photo[];

      if (shouldRefresh || pageNum === 0) {
        setPhotos(parsed);
      } else {
        setPhotos(prev => [...prev, ...parsed]);
      }
      setHasMore(!data.last);
      setPage(pageNum);
    } catch (e) { console.warn('[Gallery] Load failed:', e); } 
    finally { setLoading(false); setRefreshing(false); setLoadingMore(false); }
  }, []);

  useFocusEffect(useCallback(() => { loadPhotos(0, true); }, [loadPhotos]));
  const onRefresh = () => { setRefreshing(true); setHasMore(true); loadPhotos(0, true); };
  const onEndReached = () => { if (!hasMore || loadingMore || loading) return; setLoadingMore(true); loadPhotos(page + 1); };

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
    } catch (e) { Alert.alert('오류', '저장 실패'); } finally { setSaving(false); }
  };

  const handlePostToHome = async () => { 
    if (selectedPhotoIndex === null) return;
    const photo = photos[selectedPhotoIndex];
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) return;
      const res = await fetch(`${BASE_URL}/calendar/missions/thumb?photoId=${photo.id}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) { setIsMenuVisible(false); showToast('홈 화면에 게시되었습니다.'); refreshUserData(); } 
      else { Alert.alert('실패', '홈 화면 게시에 실패했습니다.'); }
    } catch (e) { Alert.alert('오류', '통신 중 오류가 발생했습니다.'); }
  };

  const handleCloseViewer = () => {
    setSelectedPhotoIndex(null);
    setIsMenuVisible(false);
  };

  const closeMenu = () => { if (isMenuVisible) setIsMenuVisible(false); };

  // 현재 표시중인 사진 정보
  const currentPhoto = selectedPhotoIndex !== null ? photos[selectedPhotoIndex] : null;
  const formattedDate = currentPhoto ? format(addHours(parseISO(currentPhoto.createdAt), 9), 'yyyy. MM. dd.') : '';
  const nickname = currentPhoto?.ownerNickname || '알 수 없음';

  // 뷰어에서 스크롤이 끝났을 때 현재 인덱스 계산
  const handleViewerScrollEnd = (event: any) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / SCREEN_WIDTH);
    if (!isNaN(index) && index >= 0 && index < photos.length) {
      setSelectedPhotoIndex(index);
    }
  };

  // 모달이 열릴 때, 해당 인덱스로 스크롤 맞추기
  useEffect(() => {
    if (selectedPhotoIndex !== null && viewerListRef.current) {
      viewerListRef.current.scrollToIndex({
        index: selectedPhotoIndex,
        animated: false,
      });
    }
  }, [selectedPhotoIndex]);

  if (loading && page === 0 && !refreshing) return <View style={styles.center}><ActivityIndicator size="large" color="#333" /></View>;

  return (
    <View style={styles.container}>
      <View style={{ height: 10}} />
      {!coupleId ? (
        <View style={styles.center}>
          <AppText type='medium' style={styles.emptyText}>마이페이지에서 커플을 연결해주세요!</AppText>
        </View>
      ) : photos.length === 0 ? (
        <View style={styles.center}>
          <AppText style={styles.emptyText}>아직 사진이 없어요.</AppText>
        </View>
      ) : (
        <FlatList
          data={photos}
          keyExtractor={(item) => item.id}
          numColumns={3}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          onEndReached={onEndReached}
          onEndReachedThreshold={0.5}
          ListFooterComponent={loadingMore ? <ActivityIndicator size="small" color="#999" style={{marginVertical: 20}} /> : null}
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

      {/* 뷰어 모달 */}
      <Modal 
        visible={selectedPhotoIndex !== null} 
        transparent={true} 
        onRequestClose={handleCloseViewer} // 안드로이드 하드웨어 뒤로가기 대응
        animationType="fade"               // 등장/퇴장 모두 페이드
      >
        <View style={styles.modalBackground}>
          <View style={styles.modalContentContainer}>
            {/* 이미지 배경 (슬라이드 가능) */}
            <View style={styles.imageWrapper}>
              {photos.length > 0 && (
                <FlatList
                  ref={viewerListRef}
                  data={photos}
                  keyExtractor={(item) => item.id}
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  onMomentumScrollEnd={handleViewerScrollEnd}
                  getItemLayout={(_, index) => ({
                    length: SCREEN_WIDTH,
                    offset: SCREEN_WIDTH * index,
                    index,
                  })}
                  renderItem={({ item }) => (
                    <View style={styles.viewerItem}>
                      <Image
                        source={{ uri: item.url }}
                        style={styles.fullScreenImage}
                        resizeMode="contain"
                      />
                    </View>
                  )}
                />
              )}

              {/* 헤더 정보 (닉네임, 날짜, 메뉴/닫기 버튼) */}
              <View style={[styles.viewerHeader, { paddingTop: insets.top + 10 }]}>
                <View style={styles.headerInfo}>
                  <View style={styles.nicknameRow}>
                    <View style={styles.dot} />
                    <AppText type="bold" style={styles.nicknameText}>
                      {nickname}
                    </AppText>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Image source={calendarImg} style={[styles.calendarImage]} />
                    <AppText type="semibold" style={styles.dateText}>{formattedDate}</AppText>
                  </View>
                </View>

                <View style={styles.headerButtons}>
                  {/* 메뉴 버튼 */}
                  <Pressable
                    onPress={() => setIsMenuVisible(!isMenuVisible)}
                    style={styles.iconButton}
                  >
                    <Ionicons name="ellipsis-vertical" size={24} color="#FFF" />
                  </Pressable>

                  {/* 닫기 버튼 */}
                  <Pressable onPress={handleCloseViewer} style={styles.iconButton}>
                    <Ionicons name="close" size={28} color="#FFF" />
                  </Pressable>
                </View>
              </View>
            </View>

            {/* 메뉴 바깥 클릭 시 닫히는 투명 오버레이 */}
            {isMenuVisible && (
              <TouchableWithoutFeedback onPress={closeMenu}>
                <View style={[StyleSheet.absoluteFillObject, { zIndex: 15 }]} />
              </TouchableWithoutFeedback>
            )}

            {/* 우측 상단 메뉴 팝업 */}
            {isMenuVisible && (
              <View style={[styles.menuPopup, { top: insets.top + 50 }]}>
                <Pressable style={styles.menuItem} onPress={handlePostToHome}>
                  <AppText type="semibold" style={styles.menuText}>
                    홈화면 게시
                  </AppText>
                </Pressable>
                <View style={styles.menuDivider} />
                <Pressable
                  style={styles.menuItem}
                  onPress={handleDownload}
                  disabled={saving}
                >
                  <AppText type="semibold" style={styles.menuText}>
                    {saving ? '저장 중...' : '다운로드'}
                  </AppText>
                </Pressable>
              </View>
            )}

            {/* 토스트 메시지 */}
            <ToastMessage
              message={toastMsg}
              visible={toastVisible}
              onHide={() => setToastVisible(false)}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { color: '#808080', fontSize: 16, marginBottom:'50%' },
  gridItem: { width: SCREEN_WIDTH / 3, height: SCREEN_WIDTH/1.5, borderWidth: 0.5, borderColor: '#FFF' },
  gridImage: { width: '100%', height: '100%' },
  
  // 🟢 뷰어 스타일
  modalBackground: { flex: 1, backgroundColor: '#000' },
  modalContentContainer: { flex: 1, backgroundColor: '#000' },
  imageWrapper: { flex: 1, position: 'relative' },
  fullScreenImage: { width: '100%', height: '100%' },
  
  // 그라데이션 헤더
  gradientHeader: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 1 },
  
  // 헤더 내용물
  viewerHeader: { 
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, 
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', 
    paddingHorizontal: 20 
  },
  headerInfo: { flexDirection:'row',gap: 13 },
  nicknameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#FFF' },
  nicknameText: { color: '#FFF', fontSize: 12 },
  dateText: { color: '#fff', fontSize: 12 },
  calendarImage: { width: 16, height: 16, tintColor: '#fff',},
  
  headerButtons: { flexDirection: 'row', gap: 10, alignItems: 'center', },
  iconButton: { padding: 4 },

  // 메뉴 및 토스트
  menuPopup: { position: 'absolute', right: 20, zIndex: 20, backgroundColor: '#FFF', borderRadius: 12, paddingVertical: 4, width: 120, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 3.84, elevation: 5 },
  menuItem: { paddingVertical: 16, paddingHorizontal:'15%' },
  menuDivider: { height: 1, backgroundColor: '#9B9B9B', marginHorizontal: 10 },
  menuText: { fontSize: 12, color: '#333' },
  toastContainer: { position: 'absolute', bottom: '10%', alignSelf: 'center', backgroundColor: 'rgba(50, 50, 50, 0.9)', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, zIndex: 100 },
  toastText: { color: '#FFF', fontSize: 14 },
  viewerItem: { width: SCREEN_WIDTH, height: SCREEN_HEIGHT },
});
