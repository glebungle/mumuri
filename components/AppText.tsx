import React from 'react';
import { StyleSheet, Text, TextProps } from 'react-native';

interface AppTextProps extends TextProps {
    // 💡 기본값을 'bold'로 지정
    type?: 'bold' | 'medium' | 'regular'|'semibold'|'extrabold'|'light'|'extralight'|'thin'|'pretendard-r'|'pretendard-m'|'pretendard-s'|'pretendard-b'; 
}

// 🚨 type의 기본값을 'bold'로 설정합니다.
const AppText: React.FC<AppTextProps> = ({ type = 'bold', style, children, ...rest }) => {
    let fontFamilyName = ''; // 초기화만 합니다.

    switch (type) {
        case 'bold':
            fontFamilyName = 'Paperlogy-7Bold';
            break;
        case 'medium':
            fontFamilyName = 'Paperlogy-5Medium';
            break;
        case 'regular':
            fontFamilyName = 'Paperlogy-4Regular';
            break;
        case 'semibold':
            fontFamilyName = 'Paperlogy-6SemiBold';
            break;
        case 'extrabold':
            fontFamilyName = 'Paperlogy-8ExtraBold';
            break;
        case 'light':
            fontFamilyName = 'Paperlogy-3Light';
            break;
        case 'extralight':
            fontFamilyName = 'Paperlogy-2ExtraLight';
            break;
        case 'thin':
            fontFamilyName = 'Paperlogy-1Thin';
            break;
        case 'pretendard-r':
            fontFamilyName = 'Pretendard-Regular';
            break;
        case 'pretendard-m':
            fontFamilyName = 'Pretendard-Medium';
            break;
        case 'pretendard-s':
            fontFamilyName = 'Pretendard-SemiBold';
            break;
        case 'pretendard-b':
            fontFamilyName = 'Pretendard-Bold';
            break;
    }

    return (
        // style 적용 시 fontFamilyName이 가장 앞에 오도록 하여 다른 스타일을 덮어쓰지 않도록 합니다.
        <Text style={[{ fontFamily: fontFamilyName }, styles.base, style]} {...rest}>
            {children}
        </Text>
    );
};

const styles = StyleSheet.create({
    base: {
        // 여기에 앱의 기본 텍스트 스타일을 설정합니다 (크기, 색상 등)
        fontSize: 16,
        color: '#333333',
    },
});

export default AppText;