import { defineWidget } from 'react-native-android-widget';

const ANNIVERSARY_DATE = '2025-01-01';

function calcDDay() {
  const today = new Date();
  const base = new Date(ANNIVERSARY_DATE);
  const diff = today.getTime() - base.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export const CoupleDDayWidget = defineWidget(() => {
  const d = calcDDay();

  return {
    layout: 'app_widget_layout',   // <-- xml 이름
    views: {
      txtDday: {
        text: `D+${d}`,
      },
    },
  };
});
