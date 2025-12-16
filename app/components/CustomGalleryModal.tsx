// components/CustomGalleryModal.tsx
import { Ionicons } from '@expo/vector-icons';
import * as MediaLibrary from 'expo-media-library';
import React, { useEffect, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

const { width } = Dimensions.get('window');
const COLUMN_COUNT = 3; // 사진은 3열
const ALBUM_COLUMN_COUNT = 2; // 앨범은 2열
const IMAGE_SIZE = width / COLUMN_COUNT;
const ALBUM_SIZE = (width - 48) / ALBUM_COLUMN_COUNT; // 앨범 박스 크기 계산 (여백 고려)

interface CustomGalleryModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (uri: string) => void;
}

export default function CustomGalleryModal({ visible, onClose, onSelect }: CustomGalleryModalProps) {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  
  // 데이터 상태
  const [assets, setAssets] = useState<MediaLibrary.Asset[]>([]);
  const [albums, setAlbums] = useState<MediaLibrary.Album[]>([]);
  
  // UI 상태
  const [currentAlbum, setCurrentAlbum] = useState<MediaLibrary.Album | null>(null);
  const [isAlbumListVisible, setIsAlbumListVisible] = useState(false); // 앨범 목록을 보여줄지 여부

  useEffect(() => {
    (async () => {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      setHasPermission(status === 'granted');
      if (status === 'granted') {
        loadAlbums();
      }
    })();
  }, [visible]);

  // 1. 앨범 목록 로드 (처음 한 번만)
  const loadAlbums = async () => {
    const fetchedAlbums = await MediaLibrary.getAlbumsAsync({
      includeSmartAlbums: true,
    });
    setAlbums(fetchedAlbums);
    
    // 기본적으로 '최근 항목'(또는 전체)을 찾아서 설정
    // 보통 Recents 혹은 Camera Roll이 첫 번째 혹은 스마트 앨범임
    const recentAlbum = fetchedAlbums.find(a => a.title === 'Recents' || a.title === '최근 항목') || fetchedAlbums[0];
    setCurrentAlbum(recentAlbum);
    loadAssets(recentAlbum);
  };

  // 2. 특정 앨범의 사진 로드
  const loadAssets = async (album: MediaLibrary.Album | null) => {
    if (!album) return;
    const { assets } = await MediaLibrary.getAssetsAsync({
      album: album,
      mediaType: 'photo',
      sortBy: ['creationTime'],
      first: 100, // 성능상 100개씩 끊거나 페이징 필요
    });
    setAssets(assets);
  };

  // 앨범 선택 핸들러
  const handleSelectAlbum = (album: MediaLibrary.Album) => {
    setCurrentAlbum(album);
    setIsAlbumListVisible(false); // 앨범 목록 닫기
    loadAssets(album); // 해당 앨범 사진 로드
  };

  // --- 렌더링 함수들 ---

  // 사진 한 장 렌더링 (3열)
  const renderPhotoItem = ({ item }: { item: MediaLibrary.Asset }) => (
    <Pressable onPress={() => onSelect(item.uri)}>
      <Image
        source={{ uri: item.uri }}
        style={{ width: IMAGE_SIZE, height: IMAGE_SIZE, borderWidth: 0.5, borderColor: '#222' }}
        resizeMode="cover"
      />
    </Pressable>
  );

  // 앨범 하나 렌더링 (2열) - 디자인 요청 반영 (회색 박스 + 텍스트)
  const renderAlbumItem = ({ item }: { item: MediaLibrary.Album }) => (
    <Pressable style={styles.albumItem} onPress={() => handleSelectAlbum(item)}>
      {/* 앨범 썸네일 (여기서는 단순 회색 박스로 처리, 필요시 해당 앨범 첫 사진 가져오기 가능) */}
      <View style={styles.albumCover}>
         <Ionicons name="images-outline" size={32} color="#666" />
      </View>
      <Text style={styles.albumTitle} numberOfLines={1}>{item.title}</Text>
      <Text style={styles.albumCount}>{item.assetCount.toLocaleString()}</Text>
    </Pressable>
  );

  if (!hasPermission) return null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <View style={styles.container}>
        
        {/* 상단 헤더 (디자인 반영: 검은 배경, 흰 글씨) */}
        <View style={styles.header}>
          <Pressable onPress={onClose} style={styles.headerBtn}>
            <Text style={styles.headerBtnText}>취소</Text>
          </Pressable>

          {/* 제목을 누르면 앨범 리스트 토글 */}
          <Pressable style={styles.titleWrap} onPress={() => setIsAlbumListVisible(!isAlbumListVisible)}>
            <Text style={styles.headerTitle}>
              {currentAlbum?.title || '최근 항목'}
            </Text>
            <Ionicons 
              name={isAlbumListVisible ? "chevron-up" : "chevron-down"} 
              size={16} 
              color="#fff" 
              style={{ marginLeft: 4 }}
            />
          </Pressable>

          <View style={styles.headerBtn} /> 
        </View>

        {/* 본문: 앨범 목록 모드 vs 사진 목록 모드 */}
        {isAlbumListVisible ? (
          <View style={styles.albumListContainer}>
            <Text style={styles.sectionTitle}>사진첩</Text>
            <FlatList
              data={albums}
              renderItem={renderAlbumItem}
              keyExtractor={(item) => item.id}
              numColumns={ALBUM_COLUMN_COUNT}
              columnWrapperStyle={{ justifyContent: 'space-between' }}
              contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
            />
          </View>
        ) : (
          <FlatList
            data={assets}
            renderItem={renderPhotoItem}
            keyExtractor={(item) => item.id}
            numColumns={COLUMN_COUNT}
            showsVerticalScrollIndicator={true}
          />
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1C1C1E' }, // 다크 모드 배경
  header: {
    height: 60,
    marginTop: 40, // 노치 대응
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    backgroundColor: '#1C1C1E',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  headerBtn: { minWidth: 40, alignItems: 'flex-start' },
  headerBtnText: { color: '#6198FF', fontSize: 16, }, // 취소 버튼 색상
  titleWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#333', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
  headerTitle: { fontSize: 16,  color: '#fff' },
  
  // 앨범 목록 스타일
  albumListContainer: { flex: 1, backgroundColor: '#1C1C1E' },
  sectionTitle: { color: '#fff', fontSize: 14,  marginVertical: 16, paddingHorizontal: 16 },
  albumItem: { marginBottom: 24, width: ALBUM_SIZE },
  albumCover: {
    width: ALBUM_SIZE,
    height: ALBUM_SIZE,
    backgroundColor: '#333', // 회색 박스
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  albumTitle: { color: '#fff', fontSize: 14, },
  albumCount: { color: '#888', fontSize: 12, marginTop: 2 },
});