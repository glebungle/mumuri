// app/(tabs)/camera.tsx
import { Feather, Ionicons } from '@expo/vector-icons';
import { CameraCapturedPicture, CameraView, useCameraPermissions } from 'expo-camera';
import * as ImageManipulator from 'expo-image-manipulator';
import * as MediaLibrary from 'expo-media-library';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
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
import AppText from '../../components/AppText';

const { height: screenHeight, width: screenWidth } = Dimensions.get('window');

type CropRect = { originX: number; originY: number; width: number; height: number };

export default function CameraHome() {
  const router = useRouter();
  const cameraRef = useRef<CameraView>(null);
  const insets = useSafeAreaInsets();

  const [camPerm, requestCamPerm] = useCameraPermissions();
  const [libPerm, requestLibPerm] = MediaLibrary.usePermissions();

  const [isReady, setIsReady] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [previewUri, setPreviewUri] = useState<string | null>(null);

  // 뷰파인더 실제 렌더 크기
  const [viewW, setViewW] = useState(0);
  const [viewH, setViewH] = useState(0);
  const onCameraWrapLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setViewW(width);
    setViewH(height);
  };

  useEffect(() => {
    (async () => {
      if (!camPerm?.granted) await requestCamPerm();
      if (!libPerm?.granted) await requestLibPerm();
    })();
  }, []);

  if (!camPerm || !libPerm) return <View style={styles.loadingScreen} />;

  if (!camPerm.granted || !libPerm.granted) {
    return (
      <View style={styles.center}>
        <Text style={styles.permissionTitle}>
          {camPerm.granted ? '사진 저장 권한이 필요해요' : '카메라 권한이 필요해요'}
        </Text>
        <Pressable
          style={styles.permBtn}
          onPress={camPerm.granted ? requestLibPerm : requestCamPerm}
        >
          <Text style={styles.permBtnText}>권한 허용하기</Text>
        </Pressable>
      </View>
    );
  }

  // 촬영 → 화면 비율에 맞춰 중앙 크롭
  const takePhoto = async () => {
    if (!cameraRef.current || capturing) return;
    setCapturing(true);

    let pic: CameraCapturedPicture | null = null;
    let finalUri: string | null = null;

    try {
      pic = (await cameraRef.current.takePictureAsync({
        quality: 1,
        skipProcessing: false,
        exif: true,
      })) as CameraCapturedPicture;

      if (!pic?.uri || !pic.width || !pic.height) {
        Alert.alert('촬영 실패', '이미지를 불러오지 못했습니다.');
        return;
      }

      // 프리뷰 프레임의 종횡비(측정 값 없으면 3:4 가정)
      const targetAspect = viewW && viewH ? viewW / viewH : 3 / 4;

      // 일부 기기에서 EXIF 회전(6/8)로 width/height가 뒤바뀌는 현상 보정
      let srcW = pic.width;
      let srcH = pic.height;
      const orientation = pic.exif?.Orientation;
      const isRotated = Platform.OS === 'android' && (orientation === 6 || orientation === 8);
      if (isRotated) {
        [srcW, srcH] = [srcH, srcW];
      }

      const srcAspect = srcW / srcH;

      // 중앙 크롭 사각형 계산
      let crop: CropRect;
      if (srcAspect > targetAspect) {
        // 가로가 더 넓음 → 좌우를 잘라냄
        const newW = Math.round(srcH * targetAspect);
        const originX = Math.max(0, Math.floor((srcW - newW) / 2));
        crop = { originX, originY: 0, width: newW, height: srcH };
      } else if (srcAspect < targetAspect) {
        // 세로가 더 김 → 위아래를 잘라냄
        const newH = Math.round(srcW / targetAspect);
        const originY = Math.max(0, Math.floor((srcH - newH) / 2));
        crop = { originX: 0, originY, width: srcW, height: newH };
      } else {
        crop = { originX: 0, originY: 0, width: srcW, height: srcH };
      }

      // 안전 클램프 (안드로이드 "x + width must be <= bitmap.width" 방지)
      crop.originX = Math.max(0, Math.min(crop.originX, srcW - 1));
      crop.originY = Math.max(0, Math.min(crop.originY, srcH - 1));
      crop.width = Math.min(crop.width, srcW - crop.originX);
      crop.height = Math.min(crop.height, srcH - crop.originY);

      const manipulated = await ImageManipulator.manipulateAsync(
        pic.uri,
        [{ crop }],
        { compress: 1, format: ImageManipulator.SaveFormat.JPEG }
      );

      finalUri = manipulated.uri;
    } catch (e) {
      console.error('크롭 실패 오류:', e);
      Alert.alert('크롭 실패', '사진 비율 조정에 실패했습니다. 원본으로 진행합니다.');
      if (pic?.uri) finalUri = pic.uri;
    } finally {
      if (finalUri) setPreviewUri(finalUri);
      setCapturing(false);
    }
  };

  const retake = () => setPreviewUri(null);

  const confirm = async () => {
    if (!previewUri) return;
    try {
      if (libPerm.granted) await MediaLibrary.saveToLibraryAsync(previewUri);
      router.push({
        pathname: './share',
        params: { uri: previewUri, mission: '상대방이 주말을 어떻게 보내고 있을지' },
      });
    } catch (e) {
      console.error('사진 저장 및 공유 실패:', e);
      Alert.alert('오류', '사진을 저장하거나 공유 화면으로 이동할 수 없습니다.');
    }
  };

  const cameraPreviewComponent = (
    <View style={styles.cameraFrame} onLayout={onCameraWrapLayout}>
      {previewUri ? (
        <Image source={{ uri: previewUri }} style={styles.previewFrameImage} resizeMode="cover" />
      ) : (
        <CameraView
          ref={cameraRef}
          style={styles.previewFrameImage}
          facing="back"
          onCameraReady={() => setIsReady(true)}
        />
      )}

      {!previewUri && (
        <View style={styles.hintBubbleWrap}>
          <View style={styles.hintBubble}>
            <AppText style={styles.hintText}>
              상대방이 주말을 어떻게 보내고 있을지 찍어 보내주세요
            </AppText>
          </View>
        </View>
      )}

      {!previewUri && (
        <View style={styles.floatingTopButtonsGroupCamera}>
          <Pressable
            style={styles.floatBtn}
            onPress={() => Alert.alert('준비중', '앨범은 다음 단계에서 연결할게요!')}
          >
            <Feather name="book" size={20} color="#6198FF" />
          </Pressable>
          <Pressable
            style={styles.floatBtn}
            onPress={() => Alert.alert('준비중', '지도는 다음 단계에서 연결할게요!')}
          >
            <Feather name="map" size={20} color="#6198FF" />
          </Pressable>
        </View>
      )}
    </View>
  );

  return (
    <View style={styles.fullScreenContainer}>
      <View style={styles.backgroundDim} />
      <SafeAreaView style={[styles.uiOverlay, { paddingTop: insets.top }]}>
        {previewUri && (
          <View style={styles.topBarPreview}>
            <Pressable onPress={retake} style={styles.topIconBtnRetake}>
              <Ionicons name="close" size={24} color="#fff" />
            </Pressable>
          </View>
        )}

        {cameraPreviewComponent}

        {/* 하단 버튼: 탭바 숨김이므로 SafeArea bottom만 고려 */}
        <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 24 }]}>
          {previewUri ? (
            <Pressable onPress={confirm} style={styles.confirmBtn}>
              <Ionicons name="checkmark-sharp" size={36} color="#fff" />
            </Pressable>
          ) : (
            <Pressable
              onPress={takePhoto}
              disabled={!isReady || capturing}
              style={[styles.shutterOuter, (!isReady || capturing) && { opacity: 0.5 }]}
            >
              <View style={styles.shutterInner} />
            </Pressable>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  loadingScreen: { flex: 1, backgroundColor: '#fff' },
  fullScreenContainer: { flex: 1, backgroundColor: '#ffffffff' },
  backgroundDim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255, 255, 255, 0.4)' },

  cameraFrame: {
    width: screenWidth * 0.9,
    height: screenHeight * 0.75,
    borderRadius: 24,
    overflow: 'hidden',
    marginTop: screenHeight * 0.02,
    position: 'relative',
    marginBottom: 8,
  },
  previewFrameImage: { ...StyleSheet.absoluteFillObject },

  uiOverlay: {
    flex: 1,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 0,
    zIndex: 1,
  },

  floatingTopButtonsGroupCamera: {
    position: 'absolute',
    top: 14,
    right: 14,
    flexDirection: 'row',
    gap: 12,
    zIndex: 2,
  },
  floatBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },

  hintBubbleWrap: {
    position: 'absolute',
    top: screenHeight * 0.15,
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  hintBubble: {
    paddingHorizontal: 30,
    paddingVertical: 10,
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderRadius: 80,
  },
  hintText: { color: '#6198FF', fontSize: 13, textAlign: 'center' },

  bottomBar: { alignItems: 'center', width: '100%', paddingTop: 30 },

  shutterOuter: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: '#6198FF',
  },
  shutterInner: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#6198FF' },

  topBarPreview: {
    position: 'absolute',
    top: Platform.select({ ios: 0, android: 10 }),
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'flex-start',
    paddingHorizontal: 14,
    zIndex: 10,
  },
  topIconBtnRetake: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  confirmBtn: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#6198FF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 4,
  },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  permissionTitle: { fontSize: 18, marginBottom: 16, fontWeight: 'bold' },
  permBtn: { paddingHorizontal: 20, paddingVertical: 12, backgroundColor: '#6198FF', borderRadius: 12 },
  permBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
