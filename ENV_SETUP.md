# 환경 변수 설정 가이드

## .env.local 파일 생성

프로젝트 루트 디렉토리에 `.env.local` 파일을 생성하고 다음 내용을 추가하세요:

```env
# Firebase 설정
VITE_FIREBASE_API_KEY=AIzaSyBr4xQGn667Wah6neQc6vmjhrtdi5kIK08
VITE_FIREBASE_AUTH_DOMAIN=simulation-game-8f449.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=simulation-game-8f449
VITE_FIREBASE_STORAGE_BUCKET=simulation-game-8f449.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=790879775390
VITE_FIREBASE_APP_ID=1:790879775390:web:0d4c581de26cf778a3698f

# Google Apps Script (선택사항 - Firestore 사용 시 불필요)
# VITE_GOOGLE_SCRIPT_URL=your_google_script_url
```

## 중요 사항

1. **`.env.local` 파일은 Git에 커밋되지 않습니다** (`.gitignore`에 포함됨)
2. **개발 서버 재시작 필요**: `.env.local` 파일을 생성하거나 수정한 후에는 개발 서버를 재시작해야 합니다
3. **기본값 제공**: 코드에 기본값이 포함되어 있어 `.env.local` 파일이 없어도 작동하지만, 보안을 위해 환경 변수 사용을 권장합니다

## Netlify 배포 시

Netlify 대시보드에서 환경 변수를 설정해야 합니다:

1. Netlify 대시보드 → Site settings → Environment variables
2. 다음 변수들을 추가:
   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_AUTH_DOMAIN`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_STORAGE_BUCKET`
   - `VITE_FIREBASE_MESSAGING_SENDER_ID`
   - `VITE_FIREBASE_APP_ID`

## 확인 방법

브라우저 콘솔에서 다음 메시지가 보이면 정상 작동:
```
Firebase 초기화 완료
```
