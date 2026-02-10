import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import { Dimensions, Image, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AppText from "../components/AppText";

const { width } = Dimensions.get("window");
const BASE_URL = "https://mumuri.shop";

export default function SignupFinish() {
  const [userName, setUserName] = useState("00");

  useEffect(() => {
    const fetchUserName = async () => {
      try {
        const token = await AsyncStorage.getItem("token");
        if (!token) return;

        // 이름 가져오기
        const res = await fetch(`${BASE_URL}/api/mypage`, {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
        });

        if (res.ok) {
          const data = await res.json();
          if (data.name) {
            setUserName(data.name);
          }
        }
      } catch (e) {
        console.error("사용자 닉네임 로드 실패:", e);
      }
    };

    fetchUserName();
  }, []);

  return (
    <SafeAreaView
      style={{
        flex: 1,
        backgroundColor: "#FFFCF5",
        padding: 24,
        justifyContent: "space-between",
      }}
    >
      {/* 상단 인사 */}
      <View style={{ marginTop: 40, alignItems: "center" }}>
        <Image
          style={{ width: 24, height: 24 }}
          source={require("../assets/images/BlueHeart.png")}
        />
        <AppText
          style={{
            margin: 30,
            fontSize: 22,
            color: "#3B82F6",
            textAlign: "center",
          }}
        >
          안녕하세요, {userName}님!
        </AppText>
      </View>

      {/* 시작 버튼 */}
      <TouchableOpacity
        onPress={() => router.replace("/(tabs)/home")}
        style={{
          backgroundColor: "#FF9191",
          borderRadius: 28,
          height: 56,
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 8,
        }}
      >
        <AppText style={{ color: "#fff", fontSize: 14 }}>시작하기</AppText>
      </TouchableOpacity>
    </SafeAreaView>
  );
}
