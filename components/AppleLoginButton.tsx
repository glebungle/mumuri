import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import * as AppleAuthentication from "expo-apple-authentication";
import { router } from "expo-router";
import React from "react";
import { Alert, StyleSheet, View } from "react-native";

const BASE_URL = "https://mumuri.shop";

export default function AppleLoginButton() {
  const handleAppleLogin = async () => {
    try {
      // 1. 애플 시스템 인증 시작
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      // 2. 서버로 전송
      const response = await axios.post(
        `${BASE_URL}/api/auth/apple/callback`,
        {},
        {
          params: {
            code: credential.authorizationCode,
          },
        },
      );

      if (response.status === 200 || response.status === 201) {
        const { accessToken, refreshToken, isNew, roomId } = response.data;

        // 3. AsyncStorage에 데이터 저장
        await AsyncStorage.setItem("token", String(accessToken));
        if (refreshToken)
          await AsyncStorage.setItem("refreshToken", String(refreshToken));
        if (roomId && roomId !== "0")
          await AsyncStorage.setItem("roomId", String(roomId));

        if (credential.email)
          await AsyncStorage.setItem("email", String(credential.email));

        if (credential.fullName) {
          const familyName = credential.fullName.familyName || "";
          const givenName = credential.fullName.givenName || "";
          const fullName = `${familyName}${givenName}`.trim();

          if (fullName) {
            await AsyncStorage.setItem("temp_apple_name", fullName);
          }
        }

        // 4. 페이지 이동
        if (isNew === true || isNew === "true") {
          router.replace("/signup");
        } else {
          router.replace("/(tabs)/home");
        }
      }
    } catch (e: any) {
      if (e.code === "ERR_REQUEST_CANCELED") {
      } else {
        const errorDetail = e.response
          ? `서버에러(${e.response.status}): ${JSON.stringify(e.response.data)}`
          : e.message;
        Alert.alert("❌ 에러 발생", errorDetail);
        console.error("Apple Login Error:", e);
      }
    }
  };

  return (
    <View style={styles.container}>
      <AppleAuthentication.AppleAuthenticationButton
        buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
        buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
        cornerRadius={8}
        style={styles.button}
        onPress={handleAppleLogin}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: "100%", height: 48, marginTop: 12 },
  button: { width: "100%", height: "100%" },
});
