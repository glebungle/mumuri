import React from 'react';
import { StyleSheet, Text, TextProps } from 'react-native';

interface AppTextProps extends TextProps {
    // 💡 기본값을 'bold'로 지정
    type?: 'bold' | 'medium' | 'regular'|'semibold'|'extrabold'|'light'|'extralight'|'thin'; 
}

// 🚨 type의 기본값을 'bold'로 설정합니다.
const AppText: React.FC<AppTextProps> = ({ type = 'bold', style, children, ...rest }) => {
    let fontFamilyName = ''; // 초기화만 합니다.

    switch (type) {
        case 'bold':
            fontFamilyName = 'Pretendard-Bold';
            break;
        case 'medium':
            fontFamilyName = 'Pretendard-Medium';
            break;
        case 'regular':
            fontFamilyName = 'Pretendard-Regular';
            break;
        case 'semibold':
            fontFamilyName = 'Pretendard-SemiBold';
            break;
        case 'extrabold':
            fontFamilyName = 'Pretendard-ExtraBold';
            break;
        case 'light':
            fontFamilyName = 'Pretendard-Light';
            break;
        case 'extralight':
            fontFamilyName = 'Pretendard-ExtraLight';
            break;
        case 'thin':
            fontFamilyName = 'Pretendard-Thin';
            break;
        // default 케이스는 'bold'가 default 값으로 설정되었으므로 사실상 불필요하지만, 
        // 방어를 위해 'bold'로 지정할 수 있습니다. (여기서는 제거)
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