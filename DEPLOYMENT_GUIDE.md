# 배포 가이드 (Deployment Guide)

이 문서는 "교실용 인터랙티브 스토리 게임 메이커"를 다른 사람이 사용할 수 있도록 배포하는 방법을 안내합니다.

## 📋 목차

1. [사전 준비사항](#사전-준비사항)
2. [GitHub에 코드 업로드](#1-github에-코드-업로드)
3. [Firebase 프로젝트 설정](#2-firebase-프로젝트-설정)
4. [로컬 환경 변수 설정](#3-로컬-환경-변수-설정)
5. [Netlify 배포](#4-netlify-배포)
6. [배포 검증](#5-배포-검증)
7. [문제 해결](#문제-해결)

---

## 사전 준비사항

다음 항목들이 준비되어 있어야 합니다:

- ✅ GitHub 계정
- ✅ Firebase 계정 (Google 계정)
- ✅ OpenAI API 키 ([OpenAI Platform](https://platform.openai.com/api-keys)에서 발급)
- ✅ Netlify 계정 ([Netlify](https://app.netlify.com)에서 무료 가입 가능)

---

## 1. GitHub에 코드 업로드

### 1.1 새 저장소 생성

1. [GitHub](https://github.com)에 로그인
2. 우측 상단의 "+" 버튼 클릭 → "New repository" 선택
3. 저장소 이름 입력 (예: `interactive-story-game-maker`)
4. "Public" 또는 "Private" 선택
5. **"Initialize this repository with a README" 체크 해제** (이미 코드가 있으므로)
6. "Create repository" 클릭

### 1.2 코드 업로드

터미널에서 프로젝트 폴더로 이동 후 다음 명령어 실행:

```bash
# Git 초기화 (이미 초기화되어 있다면 생략)
git init

# 모든 파일 추가
git add .

# 첫 커밋
git commit -m "Initial commit: Interactive Story Game Maker"

# GitHub 저장소 연결 (YOUR_USERNAME과 YOUR_REPO_NAME을 실제 값으로 변경)
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git

# 메인 브랜치로 푸시
git branch -M main
git push -u origin main
```

**주의사항:**
- `.env` 파일은 `.gitignore`에 포함되어 있어 자동으로 제외됩니다.
- 하드코딩된 API 키나 개인 정보가 코드에 남아있지 않은지 확인하세요.

---

## 2. Firebase 프로젝트 설정

### 2.1 Firebase 프로젝트 생성

1. [Firebase Console](https://console.firebase.google.com/) 접속
2. "프로젝트 추가" 클릭
3. 프로젝트 이름 입력 (예: `my-story-game`)
4. Google Analytics 설정 (선택사항, 권장: 비활성화)
5. "프로젝트 만들기" 클릭

### 2.2 Firestore Database 생성

1. Firebase Console 좌측 메뉴에서 "Firestore Database" 클릭
2. "데이터베이스 만들기" 클릭
3. **"프로덕션 모드에서 시작"** 선택
4. 위치 선택 (권장: `asia-northeast3` - 서울)
5. "사용 설정" 클릭

### 2.3 보안 규칙 설정

1. Firestore Database 페이지에서 "규칙" 탭 클릭
2. 프로젝트의 `firestore.rules` 파일 내용을 복사하여 붙여넣기:

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

3. "게시" 클릭

**보안 참고:**
- 현재 규칙은 완전히 공개되어 있습니다 (개발/테스트용).
- 프로덕션 환경에서는 인증 기반 규칙 적용을 권장합니다 (자세한 내용은 `FIRESTORE_SETUP.md` 참고).

### 2.4 웹 앱 등록 및 설정 정보 복사

1. Firebase Console에서 "프로젝트 설정" (톱니바퀴 아이콘) 클릭
2. "내 앱" 섹션에서 "웹" 아이콘 (</>) 클릭
3. 앱 닉네임 입력 (예: "Story Game Maker")
4. **"Firebase Hosting도 설정" 체크 해제** (Netlify 사용 중)
5. "앱 등록" 클릭
6. **설정 정보 복사** (다음 단계에서 사용):

```javascript
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123..."
};
```

---

## 3. 로컬 환경 변수 설정

로컬에서 개발/테스트할 때 사용할 `.env` 파일을 생성합니다.

### 3.1 .env 파일 생성

프로젝트 루트 디렉토리에 `.env` 파일을 생성하고 다음 내용을 추가:

```env
# Firebase 설정
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id

# OpenAI API 키
VITE_OPENAI_API_KEY=your_openai_api_key_here
```

**주의:**
- `your_firebase_api_key` 등의 값을 2.4단계에서 복사한 실제 값으로 교체하세요.
- OpenAI API 키는 [OpenAI Platform](https://platform.openai.com/api-keys)에서 발급받으세요.
- `.env` 파일은 Git에 커밋되지 않습니다 (`.gitignore`에 포함됨).

### 3.2 로컬 테스트

```bash
# 의존성 설치
npm install

# 개발 서버 실행
npm run dev
```

브라우저에서 `http://localhost:3000` 접속하여 정상 작동 확인.

---

## 4. Netlify 배포

### 4.1 Netlify 계정 연결

1. [Netlify](https://app.netlify.com)에 로그인
2. "Add new site" → "Import an existing project" 클릭
3. "GitHub" 선택하여 GitHub 계정 연결
4. 방금 업로드한 저장소 선택
5. "Import" 클릭

### 4.2 빌드 설정

Netlify가 자동으로 다음 설정을 감지합니다:

- **Build command**: `npm run build`
- **Publish directory**: `dist`

**확인 사항:**
- `netlify.toml` 파일이 프로젝트에 포함되어 있어야 합니다.
- Node.js 버전이 18 이상인지 확인 (필요시 `.nvmrc` 파일 추가).

### 4.3 환경 변수 설정

**중요:** Netlify에서 환경 변수를 설정해야 Firebase와 OpenAI API가 작동합니다.

1. Netlify 대시보드에서 "Site settings" 클릭
2. 좌측 메뉴에서 "Environment variables" 클릭
3. "Add a variable" 클릭하여 다음 변수들을 추가:

#### Firebase 환경 변수

```
VITE_FIREBASE_API_KEY = your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN = your-project-id.firebaseapp.com
VITE_FIREBASE_PROJECT_ID = your-project-id
VITE_FIREBASE_STORAGE_BUCKET = your-project-id.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID = your_sender_id
VITE_FIREBASE_APP_ID = your_app_id
```

#### OpenAI 환경 변수

```
VITE_OPENAI_API_KEY = your_openai_api_key_here
```

**주의:**
- 각 변수명 앞에 `VITE_` 접두사가 있어야 합니다 (Vite의 환경 변수 규칙).
- 값은 2.4단계와 3.1단계에서 사용한 실제 값으로 입력하세요.

### 4.4 배포 실행

1. 환경 변수 설정 완료 후 "Deploy site" 클릭
2. 빌드가 완료될 때까지 대기 (약 1-2분)
3. 배포 완료 후 제공되는 URL 확인 (예: `https://your-site-name.netlify.app`)

### 4.5 Firebase 승인된 도메인 추가 (선택사항)

Firebase Console에서 승인된 도메인에 Netlify URL을 추가할 수 있지만, **필수는 아닙니다.**

- Firestore는 공개 API이므로 도메인 등록 없이도 작동합니다.
- Firebase Authentication을 사용하는 경우에만 필요합니다.

---

## 5. 배포 검증

배포가 완료된 후 다음을 확인하세요:

### 5.1 기본 기능 테스트

1. **홈 화면 접속**
   - Netlify URL로 접속
   - "새로운 스토리 만들기" 버튼이 보이는지 확인

2. **게임 생성 테스트**
   - 게임 정보 입력 (제목, 주인공 이름, 시놉시스)
   - 이미지 업로드
   - 변수 설정
   - 퀘스트 설정 (선택사항)
   - "완료 및 에디터로 이동" 클릭

3. **AI 스토리 생성 테스트**
   - "AI로 스토리 생성하기" 버튼 클릭
   - 스토리 텍스트 입력
   - 생성 완료 확인

4. **Firestore 저장 테스트**
   - StoryEditor에서 "Firestore에 저장" 클릭
   - 게임 ID가 생성되는지 확인
   - Firebase Console에서 `games` 컬렉션에 데이터가 저장되었는지 확인

5. **게임 플레이 테스트**
   - 생성된 게임 링크로 접속
   - 닉네임 입력 후 게임 시작
   - 스코어보드, 퀘스트보드 표시 확인
   - 선택지 선택 및 변수 변화 확인

6. **결과 제출 테스트**
   - 게임 완료 후 결과 제출
   - 결과 대시보드 접속 (`/results?id=게임ID`)
   - 제출된 결과 확인

### 5.2 콘솔 오류 확인

브라우저 개발자 도구 (F12)에서 다음을 확인:

- ❌ `Firebase 초기화 실패` 오류가 없어야 함
- ❌ `OpenAI API 키가 설정되지 않았습니다` 오류가 없어야 함
- ❌ `Missing or insufficient permissions` 오류가 없어야 함

---

## 문제 해결

### 문제 1: Firebase 초기화 실패

**증상:** 콘솔에 "Firebase 초기화 실패" 오류

**해결 방법:**
1. Netlify 환경 변수가 올바르게 설정되었는지 확인
2. Firebase 설정 값이 정확한지 확인 (특히 `VITE_FIREBASE_PROJECT_ID`)
3. Netlify에서 "Clear cache and deploy site" 실행

### 문제 2: OpenAI API 오류

**증상:** "OpenAI API 키가 설정되지 않았습니다" 오류

**해결 방법:**
1. Netlify 환경 변수에 `VITE_OPENAI_API_KEY`가 설정되었는지 확인
2. OpenAI API 키가 유효한지 확인 ([OpenAI Platform](https://platform.openai.com/api-keys))
3. API 키에 충분한 크레딧이 있는지 확인

### 문제 3: Firestore 권한 오류

**증상:** "Missing or insufficient permissions" 오류

**해결 방법:**
1. Firebase Console에서 Firestore 보안 규칙 확인
2. `firestore.rules` 파일의 내용이 올바르게 배포되었는지 확인
3. "규칙" 탭에서 "게시" 버튼을 다시 클릭

### 문제 4: 빌드 실패

**증상:** Netlify 빌드가 실패함

**해결 방법:**
1. 로컬에서 `npm run build` 실행하여 오류 확인
2. `package.json`의 빌드 스크립트 확인
3. Node.js 버전 확인 (`.nvmrc` 파일 추가 권장)

### 문제 5: 페이지 새로고침 시 404 오류

**증상:** Netlify에서 페이지 새로고침 시 "Page not found" 오류

**해결 방법:**
- `netlify.toml` 파일이 프로젝트 루트에 있는지 확인
- `public/_redirects` 파일이 있는지 확인
- Netlify의 "Site settings" → "Build & deploy" → "Post processing"에서 SPA 리다이렉트 활성화 확인

---

## ✅ 배포 완료 체크리스트

배포가 성공적으로 완료되었는지 확인:

- [ ] GitHub에 코드 업로드 완료
- [ ] Firebase 프로젝트 생성 및 Firestore 설정 완료
- [ ] Firestore 보안 규칙 배포 완료
- [ ] Netlify에 저장소 연결 완료
- [ ] Netlify 환경 변수 설정 완료 (Firebase 6개 + OpenAI 1개)
- [ ] Netlify 배포 성공
- [ ] 홈 화면 접속 확인
- [ ] 게임 생성 테스트 성공
- [ ] AI 스토리 생성 테스트 성공
- [ ] Firestore 저장 테스트 성공
- [ ] 게임 플레이 테스트 성공
- [ ] 결과 제출 및 대시보드 확인 성공

---

## 📝 추가 참고사항

### 환경 변수 명명 규칙

Vite에서는 환경 변수에 `VITE_` 접두사가 필요합니다:
- ✅ `VITE_FIREBASE_API_KEY`
- ✅ `VITE_OPENAI_API_KEY`
- ❌ `FIREBASE_API_KEY` (작동하지 않음)

### 보안 고려사항

현재 설정은 **개발/테스트용**입니다:

1. **Firestore 보안 규칙**: 완전히 공개되어 있음
   - 프로덕션에서는 인증 기반 규칙 적용 권장
   - 자세한 내용은 `FIRESTORE_SETUP.md` 참고

2. **환경 변수**: Netlify에서 공개되지 않도록 설정됨
   - 환경 변수는 빌드 시에만 사용되며, 클라이언트 코드에 포함됨
   - 민감한 정보는 서버 사이드에서만 사용해야 함

### 비용 예상

- **Firebase (Firestore)**: 무료 티어로 충분 (일일 읽기 50,000회, 쓰기 20,000회)
- **Netlify**: 무료 티어로 충분 (월 100GB 대역폭, 300분 빌드 시간)
- **OpenAI API**: 사용량에 따라 과금 (GPT-4o 모델 사용)

---

## 🎉 완료!

이제 다른 사람들도 이 가이드를 따라 자신만의 인터랙티브 스토리 게임을 만들 수 있습니다!

질문이나 문제가 있으면 GitHub Issues에 등록해주세요.
