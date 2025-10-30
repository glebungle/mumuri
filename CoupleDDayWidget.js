/**
 * 안드로이드 위젯 로직 파일 (JavaScript)
 * EAS Build가 이 파일을 네이티브 코드로 변환하여 위젯 제공자로 사용합니다.
 */
// 커플이 만난 날짜를 하드코딩 (YYYY-MM-DD)
const ANNIVERSARY_DATE = "2025-01-01"; 

function calculateDDay() {
    const today = new Date();
    const anniversary = new Date(ANNIVERSARY_DATE);
    
    // 타임스탬프 차이 (밀리초)
    const diffTime = today.getTime() - anniversary.getTime();
    
    // 일(day)로 변환
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays;
}

// 위젯에서 데이터를 요청할 때 호출되는 메인 함수
export default function CoupleDDayWidget() {
    const dDay = calculateDDay();
    
    // 네이티브 레이아웃 파일과 데이터를 연결하여 반환
    return {
        // [필수] 레이아웃 파일 이름 (확장자 제외)
        layout: 'app_widget_layout', 
        
        // 레이아웃 파일의 View ID에 데이터를 연결
        // AppWidgetManager가 View ID를 찾아 텍스트를 업데이트합니다.
        views: {
            "dday_text": {
                text: `D + ${dDay}`,
            },
            "anniversary_label": {
                text: "그때부터",
            },
        },
    };
}
