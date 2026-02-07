import React from 'react';
import { StyleSheet, Text, TextProps } from 'react-native';

interface AppTextProps extends TextProps {
    type?: 'bold' | 'medium' | 'regular'|'semibold'|'extrabold'|'light'|'extralight'|'thin'|'pretendard-r'|'pretendard-m'|'pretendard-s'|'pretendard-b'; 
}

const AppText: React.FC<AppTextProps> = ({ type = 'bold', style, children, ...rest }) => {
    let fontFamilyName = ''; 

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
        <Text style={[{ fontFamily: fontFamilyName }, styles.base, style]} {...rest}>
            {children}
        </Text>
    );
};

const styles = StyleSheet.create({
    base: {

        fontSize: 16,
        color: '#333333',
    },
});

export default AppText;