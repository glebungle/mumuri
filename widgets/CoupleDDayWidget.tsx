// widgets/CoupleDDayWidget.tsx
import React from 'react';
import { FlexWidget, TextWidget } from 'react-native-android-widget';

const CoupleDDayWidget = () => {
  const dday = 100;
  return (
    <FlexWidget
      style={{
        height: 'match_parent',
        width: 'match_parent',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#FFFCF5',
      }}
    >
      <TextWidget
        text="무무리 D-DAY"
        style={{ fontSize: 12, color: '#333' }}
      />
      <TextWidget
        text={`D-${dday}`}
        style={{ fontSize: 28, color: '#FF9191' }}
      />
    </FlexWidget>
  );
};

export default CoupleDDayWidget;
