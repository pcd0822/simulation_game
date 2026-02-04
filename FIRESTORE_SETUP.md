# Firestore 설정 가이드

## 1. Firebase 프로젝트 생성

1. [Firebase Console](https://console.firebase.google.com/) 접속
2. "프로젝트 추가" 클릭
3. 프로젝트 이름 입력 (예: "interactive-story-game")
4. Google Analytics 설정 (선택사항)
5. 프로젝트 생성 완료

## 2. Firestore Database 생성

1. Firebase Console에서 "Firestore Database" 메뉴 클릭
2. "데이터베이스 만들기" 클릭
3. **프로덕션 모드** 선택 (보안 규칙 적용)
4. 위치 선택 (예: `asia-northeast3` - 서울)
5. "사용 설정" 클릭

## 3. 보안 규칙 설정

1. Firestore Database 페이지에서 "규칙" 탭 클릭
2. `firestore.rules` 파일의 내용을 복사하여 붙여넣기
3. "게시" 클릭

### 보안 규칙 설명

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /games/{gameId} {
      // 읽기: 누구나 읽을 수 있음 (공개 게임)
      allow read: if true;
      
      // 쓰기: 누구나 쓸 수 있음 (익명 사용자도 게임 생성 가능)
      allow write: if true;
      
      // 삭제: 누구나 삭제 가능
      allow delete: if true;
      
      // 게임 결과 서브컬렉션
      match /results/{resultId} {
        // 읽기: 누구나 읽을 수 있음 (결과 대시보드 공개)
        allow read: if true;
        
        // 쓰기: 누구나 쓸 수 있음 (학생들이 결과 제출)
        allow write: if true;
        
        // 삭제: 누구나 삭제 가능
        allow delete: if true;
      }
    }
  }
}
```

**주의**: 현재 규칙은 완전히 공개되어 있습니다. 프로덕션 환경에서는 다음을 고려하세요:
- 인증된 사용자만 쓰기 허용
- 작성자만 삭제 허용
- 읽기 제한 (특정 사용자만)

## 4. 웹 앱 등록

1. Firebase Console에서 "프로젝트 설정" (톱니바퀴 아이콘) 클릭
2. "내 앱" 섹션에서 "웹" 아이콘 클릭
3. 앱 닉네임 입력 (예: "Interactive Story Game")
4. "Firebase Hosting도 설정" 체크 해제 (Netlify 사용 중)
5. "앱 등록" 클릭
6. **설정 정보 복사**:
   ```javascript
   const firebaseConfig = {
     apiKey: "YOUR_API_KEY",
     authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
     projectId: "YOUR_PROJECT_ID",
     storageBucket: "YOUR_PROJECT_ID.appspot.com",
     messagingSenderId: "YOUR_SENDER_ID",
     appId: "YOUR_APP_ID"
   };
   ```

## 5. 환경 변수 설정

`.env` 파일에 Firebase 설정 추가:

```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

또는 `.env.local` 파일 사용 (Git에 커밋하지 않음)

## 6. Firebase SDK 설치

```bash
npm install firebase
```

## 7. 데이터 구조

### 컬렉션: `games`

```javascript
{
  id: "abc123",  // 문서 ID
  gameTitle: "게임 제목",
  protagonistName: "주인공 이름",
  synopsis: "시놉시스",
  variables: [
    { name: "호감도", initial: 0 },
    { name: "체력", initial: 100 }
  ],
  slides: [
    {
      id: "slide1",
      text: "대사/지문",
      imageLabel: "기쁨",
      choices: [...]
    }
  ],
  characterImages: [
    {
      id: "img1",
      label: "기쁨",
      base64: "data:image/jpeg;base64,...",
      name: "joy.jpg"
    }
  ],
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

## 8. 공유 링크 형식

### 기존 방식
```
/play?data=very-long-base64-string  // ❌ URL 길이 제한
/play?sheet=google-sheet-url        // ❌ CORS 문제
```

### Firestore 방식
```
/play?id=abc123  // ✅ 간단하고 안정적
```

## 9. 비용 예상

### 무료 티어 (Spark Plan)
- 일일 읽기: 50,000회
- 일일 쓰기: 20,000회
- 일일 삭제: 20,000회
- 저장 공간: 1GB

### 사용량 예상
- 교사 1명이 게임 1개 저장: 1회 쓰기
- 학생 30명이 게임 1개 플레이: 30회 읽기
- **결론**: 무료 티어로 충분함

## 10. 보안 고려사항

### 현재 설정 (개발/테스트용)
- 완전 공개: 누구나 읽기/쓰기/삭제 가능
- 빠른 테스트에 적합

### 프로덕션 권장 설정
```javascript
match /games/{gameId} {
  // 읽기: 공개 (학생들이 게임 플레이)
  allow read: if true;
  
  // 쓰기: 인증된 사용자만 (교사만 게임 생성)
  allow write: if request.auth != null;
  
  // 삭제: 작성자만
  allow delete: if request.auth != null && 
                 resource.data.createdBy == request.auth.uid;
}
```

## 다음 단계

1. Firebase 프로젝트 생성 완료
2. Firestore Database 생성 완료
3. 보안 규칙 설정 완료
4. 웹 앱 등록 및 설정 복사 완료
5. 코드 구현 시작
