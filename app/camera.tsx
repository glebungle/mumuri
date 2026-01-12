import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  LayoutChangeEvent,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import ViewShot from 'react-native-view-shot';
import AppText from '../components/AppText';
import { useUser } from './context/UserContext';

const { height: screenHeight, width: screenWidth } = Dimensions.get('window');
const CAMERA_HEIGHT = screenHeight * 0.8; 
const BASE_URL = 'https://mumuri.shop';

const heartImg = require('../assets/images/Heart.png');
const galleryImg = require('../assets/images/gallery.png');
const rotateImg = require('../assets/images/camera-rotate.png');

async function authedFetch(path: string, init: RequestInit = {}) {
  const token = await AsyncStorage.getItem('token');
  const headers = {
    Accept: 'application/json',
    'ngrok-skip-browser-warning': 'true',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(init.body && typeof init.body === 'string' ? { 'Content-Type': 'application/json' } : {}),
    ...(init.headers || {}),
  };
  const res = await fetch(`${BASE_URL}${path}`, { ...init, headers });
  const text = await res.text();
  if (!res.ok) throw new Error(`${path} ${res.status}`);
  try { return JSON.parse(text); } catch { return text; }
}

type CropRect = { originX: number; originY: number; width: number; height: number };
type MissionProgress = { userId: number; status: string; photoUrl: string | null; completedAt?: string | null; };
type TodayMission = { missionId: number; title: string; description: string; difficulty: string; reward: number; status: string; missionDate: string; progresses: MissionProgress[]; myDone?: boolean; myCompletedAt?: string; };

export default function CameraHome() {
  const router = useRouter();
  const { userData, refreshUserData } = useUser();
  const insets = useSafeAreaInsets();
  
  const cameraRef = useRef<CameraView>(null);
  const viewShotRef = useRef<ViewShot>(null);

  const [camPerm, requestCamPerm] = useCameraPermissions();
  const [isReady, setIsReady] = useState(false);
  const [capturing, setCapturing] = useState(false);
  
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [facing, setFacing] = useState<'back' | 'front'>('back');
  
  const [viewW, setViewW] = useState(screenWidth);
  const [viewH, setViewH] = useState(CAMERA_HEIGHT);

  const [isLayoutMode, setIsLayoutMode] = useState(false);
  const [layoutPhotos, setLayoutPhotos] = useState<string[]>([]);
  const dday = userData?.date ?? 0; 

  // --- 미션 관련 상태 수정 ---
  const [missions, setMissions] = useState<TodayMission[]>([]);
  const [sel, setSel] = useState(0);
  const [isLoadingMissions, setIsLoadingMissions] = useState(true); // 로딩 상태 추가

  const nextMission = useCallback(() => { if (!missions.length) return; setSel((i) => (i + 1) % missions.length); }, [missions.length]);
  const prevMission = useCallback(() => { if (!missions.length) return; setSel((i) => (i - 1 + missions.length) % missions.length); }, [missions.length]);
  
  const onCameraWrapLayout = (e: LayoutChangeEvent) => { 
    const { width, height } = e.nativeEvent.layout; 
    if (width > 0 && height > 0) { setViewW(width); setViewH(height); }
  };

  useEffect(() => { (async () => { if (!camPerm?.granted) await requestCamPerm(); })(); }, []);
  useFocusEffect(useCallback(() => { refreshUserData(); }, []));

  useEffect(() => { 
    const fetchTodayMission = async () => { 
      setIsLoadingMissions(true); // 로딩 시작
      try { 
        const json = await authedFetch('/api/couples/missions/today', { method: 'GET' }); 
        let missionsData: TodayMission[] = []; 
        
        if (Array.isArray(json)) {
          missionsData = json as TodayMission[]; 
        } else if (json && Array.isArray((json as any).missions)) {
          missionsData = (json as any).missions; 
        }

        const pendingMissions = missionsData.filter(mission => !mission.myDone);

        if (pendingMissions.length > 0) { 
          setMissions(pendingMissions); 
          setSel(0); 
        } else { 
          setMissions([]); 
        } 
      } catch (e) { 
        console.error("미션 로드 실패:", e);
        setMissions([]); 
      } finally {
        setIsLoadingMissions(false); // 로딩 끝
      }
    }; 
    fetchTodayMission(); 
  }, []);

  if (!camPerm) return <View style={styles.loadingScreen} />;
  if (!camPerm.granted) return <View style={styles.center}><Text style={styles.permissionTitle}>카메라 권한이 필요해요</Text><Pressable style={styles.permBtn} onPress={requestCamPerm}><Text style={styles.permBtnText}>권한 허용하기</Text></Pressable></View>;

  const toggleLayoutMode = () => { setIsLayoutMode(!isLayoutMode); setLayoutPhotos([]); setPreviewUri(null); };

  const getCameraTransformStyle = () => {
    const baseStyle: any = { position: 'absolute', width: viewW, height: viewH, zIndex: 0 };
    if (!isLayoutMode || previewUri) return baseStyle;
    const activeIndex = layoutPhotos.length;
    const shiftX = viewW / 4; const shiftY = viewH / 4;
    let translateX = 0; let translateY = 0;
    switch (activeIndex) {
        case 0: translateX = -shiftX; translateY = -shiftY; break;
        case 1: translateX = shiftX; translateY = -shiftY; break;
        case 2: translateX = -shiftX; translateY = shiftY; break;
        case 3: translateX = shiftX; translateY = shiftY; break;
    }
    return { ...baseStyle, transform: [{ translateX }, { translateY }, { scale: 0.5 }] };
  };

  const takePhoto = async () => {
    if (!cameraRef.current || !isReady || capturing) return;
    setCapturing(true);
    try {
      const pic = await cameraRef.current.takePictureAsync({ quality: 0.8, skipProcessing: false, exif: true });
      if (!pic?.uri) { Alert.alert('촬영 실패'); return; }

      const targetAspect = viewW / viewH; 
      let srcW = pic.width; let srcH = pic.height;
      const orientation = pic.exif?.Orientation;
      const isRotated = Platform.OS === 'android' && (orientation === 6 || orientation === 8);
      if (isRotated) [srcW, srcH] = [srcH, srcW];

      const srcAspect = srcW / srcH;
      let crop: CropRect;
      if (srcAspect > targetAspect) {
        const newW = Math.round(srcH * targetAspect);
        crop = { originX: Math.max(0, Math.floor((srcW - newW) / 2)), originY: 0, width: newW, height: srcH };
      } else {
        const newH = Math.round(srcW / targetAspect);
        crop = { originX: 0, originY: Math.max(0, Math.floor((srcH - newH) / 2)), width: srcW, height: newH };
      }

      const manipulated = await ImageManipulator.manipulateAsync(
        pic.uri, [{ crop }, { resize: { width: 800 } }],
        { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG }
      );

      if (isLayoutMode) {
        const newLayout = [...layoutPhotos, manipulated.uri];
        setLayoutPhotos(newLayout);
        if (newLayout.length === 4) setPreviewUri('PENDING_MERGE');
      } else { setPreviewUri(manipulated.uri); }
    } catch (e) { Alert.alert('오류', '사진 처리에 실패했습니다.'); } finally { setCapturing(false); }
  };

  const pickFromGallery = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images, 
        allowsEditing: true, 
        aspect: [viewW, viewH], 
        quality: 1,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const selectedUri = result.assets[0].uri;
        if (isLayoutMode) {
          const newLayout = [...layoutPhotos, selectedUri];
          setLayoutPhotos(newLayout);
          if (newLayout.length === 4) setPreviewUri('PENDING_MERGE');
        } else { setPreviewUri(selectedUri); }
      }
    } catch (e) { Alert.alert("알림", "갤러리를 불러오지 못했습니다."); }
  };

  const toggleCameraFacing = () => setFacing((prev) => (prev === 'back' ? 'front' : 'back'));
  const retake = () => { setPreviewUri(null); setLayoutPhotos([]); };

  const confirm = async () => {
    let uriToSend = previewUri;
    if (previewUri === 'PENDING_MERGE') {
      if (viewShotRef.current?.capture) {
        try { uriToSend = await viewShotRef.current.capture(); } catch { Alert.alert('오류', '이미지 저장 실패'); return; }
      }
    }
    if (!uriToSend || uriToSend === 'PENDING_MERGE') return;
    const picked = missions[sel];
    router.push({ pathname: '/share', params: { uri: uriToSend, missionId: picked ? String(picked.missionId) : '', missionTitle: picked?.title ?? '', missionDescription: picked?.description ?? '' } });
  };

  return (
    <View style={styles.fullScreenContainer}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        
        <View style={styles.cameraFrame} onLayout={onCameraWrapLayout}>
          
          <View style={[StyleSheet.absoluteFill, { backgroundColor: '#000' }]} />

          {(!previewUri || previewUri === 'PENDING_MERGE') && (
            <CameraView
              ref={cameraRef}
              style={getCameraTransformStyle()}
              facing={facing}
              onCameraReady={() => setIsReady(true)}
            />
          )}

          {previewUri && previewUri !== 'PENDING_MERGE' && (
            <Image source={{ uri: previewUri }} style={styles.previewFrameImage} resizeMode="cover" />
          )}

          {isLayoutMode && (
            <ViewShot ref={viewShotRef} options={{ format: 'jpg', quality: 0.9 }} style={StyleSheet.absoluteFill}>
              <View style={styles.gridContainer}>
                {[0, 1, 2, 3].map((index) => {
                  const photoUri = layoutPhotos[index];
                  const isActive = index === layoutPhotos.length;
                  return (
                    <View key={index} style={[styles.gridImage, { backgroundColor: photoUri ? 'transparent' : (isActive ? 'transparent' : 'black') }]}>
                      {photoUri && <Image source={{ uri: photoUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />}
                    </View>
                  );
                })}
              </View>
              <View style={styles.gridLineVertical} />
              <View style={styles.gridLineHorizontal} />
            </ViewShot>
          )}

          {/* ---------------- UI Overlays ---------------- */}

          {previewUri && (
            <View style={[styles.topBarPreview, { top: 20 }]}>
              <Pressable onPress={retake} style={styles.topIconBtnRetake}>
                <Ionicons name="close" size={24} color="#fff" />
              </Pressable>
            </View>
          )}

          {!previewUri && (
            <View style={[styles.topHeaderContainer, { top: 20 }]}>
              <Pressable style={styles.headerBtn} onPress={() => router.back()}>
                <Ionicons name="chevron-back" size={24} color="#6198FF" />
              </Pressable>
              <View style={styles.ddayBadge}>
                <Image source={heartImg} style={styles.heartImage} />
                <AppText style={styles.ddayText}>{dday - 1}</AppText>
              </View>
              <Pressable style={[styles.headerBtn, isLayoutMode && { backgroundColor: '#6198FF' }]} onPress={toggleLayoutMode}>
                <MaterialCommunityIcons name="view-grid-plus" size={22} color={isLayoutMode ? "#fff" : "#6198FF"} />
              </Pressable>
            </View>
          )}

          {/* 미션 힌트 버블 (수정된 로딩 로직 적용) */}
          {!previewUri && layoutPhotos.length === 0 && (
            <View style={[styles.hintBubbleWrap, { top: screenHeight * 0.1 }]}>
              {isLoadingMissions ? (
                // 로딩 중일 때 표시
                <View style={styles.hintBubble}>
                  <ActivityIndicator size="small" color="#3279FF" style={{ marginRight: 8 }} />
                  <AppText style={styles.hintText}>오늘의 미션을 불러오는 중...</AppText>
                </View>
              ) : missions.length > 0 ? (
                <>
                  <View style={styles.missionDotsRow}>
                    {missions.map((_, i) => (
                      <View key={i} style={[styles.missionDot, i === sel && styles.missionDotActive]} />
                    ))}
                  </View>
                  <View style={styles.hintRow}>
                    <View style={styles.hintBubble}>
                      {missions.length > 1 && (
                        <Pressable style={styles.innerArrowArea} onPress={prevMission} hitSlop={8}>
                          <Ionicons name="caret-forward" size={20} color='rgba(50,121,255,0.7)' style={{ transform: [{ rotate: '180deg' }] }} />
                        </Pressable>
                      )}
                      <View style={styles.hintTextWrap}>
                        <AppText style={styles.hintText}>
                          {missions[sel]?.description || missions[sel]?.title}
                        </AppText>
                      </View>
                      {missions.length > 1 && (
                        <Pressable style={styles.innerArrowArea} onPress={nextMission} hitSlop={8}>
                          <Ionicons name="caret-forward" size={20} color='rgba(50,121,255,0.7)' />
                        </Pressable>
                      )}
                    </View>
                  </View>
                </>
              ) : (
                // 로딩이 끝났는데 미션이 없을 때만 완료 문구 표시
                <View style={styles.hintBubble}>
                  <AppText style={styles.hintText}>오늘의 모든 미션을 완료했습니다!</AppText>
                </View>
              )}
            </View>
          )}

          <View style={[styles.bottomOverlay, { bottom: 10 }]}>
            {previewUri ? (
              <Pressable onPress={confirm} style={styles.confirmBtn}>
                <Ionicons name="checkmark-sharp" size={36} color="#fff" />
              </Pressable>
            ) : (
              <View style={styles.bottomButtonsRow}>
                <Pressable style={styles.galleryBtn} onPress={pickFromGallery}>
                  <Image source={galleryImg} style={styles.galleryImage} />
                </Pressable>
                <Pressable onPress={takePhoto} disabled={!isReady || capturing} style={[styles.shutterOuter, (!isReady || capturing) && { opacity: 0.5 }]}>
                  {isLayoutMode ? (
                    <View style={[styles.shutterInner, { backgroundColor: '#6198FF', alignItems: 'center', justifyContent: 'center' }]}>
                      <AppText style={{ color: '#fff', fontSize: 12 }}>{layoutPhotos.length}/4</AppText>
                    </View>
                  ) : (<View style={styles.shutterInner} />)}
                </Pressable>
                <Pressable style={styles.flipBtn} onPress={toggleCameraFacing}>
                  <Image source={rotateImg} style={styles.rotateImage} />
                </Pressable>
              </View>
            )}
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  fullScreenContainer: { flex: 1, backgroundColor: '#FFFCF5' },
  safeArea: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  cameraFrame: { 
    width: screenWidth, 
    height: CAMERA_HEIGHT, 
    backgroundColor: 'black',
    overflow: 'hidden',
    position: 'relative',
  },
  previewFrameImage: { ...StyleSheet.absoluteFillObject },
  topHeaderContainer: { 
    position: 'absolute', left: 0, right: 0, 
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', 
    paddingHorizontal: 20, zIndex: 10 
  },
  topBarPreview: { position: 'absolute', left: 20, zIndex: 20 },
  topIconBtnRetake: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' },
  ddayBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 6, backgroundColor: 'rgba(77, 80, 83, 0.6)', borderRadius: 20 },
  ddayText: { marginLeft: 6, color: '#fff', fontSize: 14 },
  headerBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.7)', alignItems: 'center', justifyContent: 'center' },
  hintBubbleWrap: { position: 'absolute', width: '100%', alignItems: 'center', paddingHorizontal: 20, zIndex: 15 },
  missionDotsRow: { flexDirection: 'row', marginBottom: 8 },
  missionDot: { width: 6, height: 6, borderRadius: 3, marginHorizontal: 3, backgroundColor: 'rgba(255, 255, 255, 0.5)' },
  missionDotActive: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#3279FF' },
  hintRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  hintBubble: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4, paddingVertical: 12, backgroundColor: 'rgba(255,255,255,0.7)', borderRadius: 12, maxWidth: '90%' },
  innerArrowArea: { width: 32, alignItems: 'center', justifyContent: 'center' },
  hintTextWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  hintText: { color: '#444444', fontSize: 12, textAlign: 'center' },
  bottomOverlay: { position: 'absolute', left: 0, right: 0, alignItems: 'center', justifyContent: 'center', zIndex: 50 },
  bottomButtonsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', width: '100%', paddingHorizontal: 40 },
  galleryBtn: { width: 50, height: 50, position: 'absolute', left: 40 },
  galleryImage: { width: 50, height: 50, borderRadius: 25 },
  shutterOuter: { width: 84, height: 84, borderRadius: 42, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', borderWidth: 12, borderColor: '#FF9191' },
  shutterInner: { width: 52, height: 52, borderRadius: 99, backgroundColor: '#FF9191' },
  flipBtn: { width: 50, height: 50, position: 'absolute', right: 40 },
  rotateImage: { width: 50, height: 50, borderRadius: 25 },
  confirmBtn: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#FF9191', alignItems: 'center', justifyContent: 'center' },
  gridContainer: { flex: 1, flexDirection: 'row', flexWrap: 'wrap' },
  gridImage: { width: '50%', height: '50%' }, 
  gridLineVertical: { position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, backgroundColor: 'rgba(255,255,255,0.8)' },
  gridLineHorizontal: { position: 'absolute', top: '50%', left: 0, right: 0, height: 1, backgroundColor: 'rgba(255,255,255,0.8)' },
  loadingScreen: { flex: 1, backgroundColor: '#FFFCF5', alignItems: 'center', justifyContent: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  permissionTitle: { fontSize: 18, marginBottom: 16 },
  permBtn: { paddingHorizontal: 20, paddingVertical: 12, backgroundColor: '#6198FF', borderRadius: 12 },
  permBtnText: { color: '#fff' },
  heartImage: { width: 18, height: 18, tintColor: '#fff' },
});