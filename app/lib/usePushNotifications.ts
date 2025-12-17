// import * as Notifications from 'expo-notifications';
// import * as Device from 'expo-device';
// import Constants from 'expo-constants';
// import { Platform } from 'react-native';

// // 1. 알림 수신 시 행동 설정 (앱이 켜져 있을 때도 알림을 띄울지)
// Notifications.setNotificationHandler({
//   handleNotification: async () => ({
//     shouldShowAlert: true,
//     shouldPlaySound: true,
//     shouldSetBadge: false,
//   }),
// });

// export async function registerForPushNotificationsAsync() {
//   let token;

//   // 2. 안드로이드 전용 알림 채널 설정
//   if (Platform.OS === 'android') {
//     await Notifications.setNotificationChannelAsync('default', {
//       name: 'default',
//       importance: Notifications.AndroidImportance.MAX,
//       vibrationPattern: [0, 250, 250, 250],
//       lightColor: '#FF231F7C',
//     });
//   }

//   // 3. 실제 기기인지 확인 및 권한 요청
//   if (Device.isDevice) {
//     const { status: existingStatus } = await Notifications.getPermissionsAsync();
//     let finalStatus = existingStatus;
//     if (existingStatus !== 'granted') {
//       const { status } = await Notifications.requestPermissionsAsync();
//       finalStatus = status;
//     }
//     if (finalStatus !== 'granted') {
//       console.log('푸시 권한 거부됨');
//       return;
//     }
    
//     // 4. Expo 푸시 토큰 발급 
//     try {
//       const projectId = Constants.expoConfig?.extra?.eas?.projectId;
//       token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
//       console.log("내 푸시 토큰:", token);
//     } catch (e) {
//       console.log("토큰 발급 에러:", e);
//     }
//   } else {
//     console.log('실제 기기에서만 작동합니다.');
//   }

//   return token;
// }