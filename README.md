# 교실용 인터랙티브 스토리 게임 메이커

교사가 코딩 없이 줄글 스토리와 이미지를 입력하여 인터랙티브 게임을 만들고, 학생이 링크를 통해 플레이할 수 있는 웹 애플리케이션입니다.

## 기술 스택

- **Frontend**: React, Vite, Tailwind CSS, Framer Motion
- **Backend**: Firebase Firestore
- **AI**: OpenAI API (GPT-4o)
- **State Management**: Zustand
- **Database**: Firebase Firestore

## 주요 기능

### 1. 초기 설정 대시보드 (Setup Wizard)
- Google 시트 연동
- 게임 메타 데이터 입력 (제목, 주인공 이름, 시놉시스)
- 캐릭터 이미지 업로드 및 라벨링 (자동 압축 및 Base64 변환)
- 게임 변수 설정

### 2. AI 스토리 생성기
- 줄글 스토리를 입력하면 AI가 자동으로:
  - 장면(Scene/Slide) 단위로 분할
  - 각 장면에 적절한 이미지 라벨 매칭
  - 선택지(Choice) 생성
  - 변수 변화 로직 제안

### 3. 슬라이드 기반 에디터
- PPT 스타일 UI (좌측 썸네일, 중앙 편집 화면)
- 대사/지문 수정
- 이미지 변경
- 선택지 및 변수 로직 수정
- 슬라이드 추가/삭제

### 4. 저장 및 배포
- Google 시트에 데이터 저장
- 공유 링크 및 QR 코드 생성

## 설치 및 실행

### 1. 의존성 설치

```bash
npm install
```

### 2. 환경 변수 설정

`.env` 파일을 생성하고 다음 내용을 입력하세요:

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

자세한 설정 방법은 [FIRESTORE_SETUP.md](./FIRESTORE_SETUP.md)를 참고하세요.

### 3. 개발 서버 실행

```bash
npm run dev
```

### 4. 빌드

```bash
npm run build
```

## 배포 가이드

다른 사람이 이 프로젝트를 사용할 수 있도록 배포하는 방법은 **[DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)**를 참고하세요.

배포 과정 요약:
1. GitHub에 코드 업로드
2. Firebase 프로젝트 설정
3. 로컬 환경 변수 설정 (`.env` 파일)
4. Netlify 환경 변수 설정
5. Netlify 배포

## 아키텍처

### 마스터 프록시 패턴

사용자마다 Google Apps Script를 설치하는 것이 아닌, 하나의 마스터 스크립트로 모든 요청을 처리합니다.

- 클라이언트는 `VITE_GOOGLE_SCRIPT_URL`로 모든 요청 전송
- 요청 시 `targetSheetUrl` 파라미터에 사용자의 시트 주소 포함
- 스크립트는 `openByUrl()`로 해당 시트를 열어 데이터 읽기/쓰기

### 데이터 구조

게임 데이터는 JSON 형식으로 Google 시트에 저장됩니다:

```json
{
  "gameTitle": "게임 제목",
  "protagonistName": "주인공 이름",
  "synopsis": "시놉시스",
  "variables": [
    {"name": "호감도", "initial": 50}
  ],
  "characterImages": [
    {"id": "...", "label": "기쁨", "base64": "data:image/jpeg;base64,..."}
  ],
  "slides": [
    {
      "id": "slide_1",
      "text": "대사/지문",
      "imageLabel": "기쁨",
      "choices": [
        {
          "id": "choice_1",
          "text": "선택지 텍스트",
          "variableChanges": {"호감도": 10},
          "nextSlideId": "slide_2"
        }
      ]
    }
  ]
}
```

## 사용 방법

### 교사 (게임 제작)

1. `/` 경로에서 초기 설정 진행
2. Google 시트 URL 입력 및 기본 정보 설정
3. 캐릭터 이미지 업로드 (5~10장 권장)
4. 게임 변수 설정
5. `/editor`에서 스토리 입력 및 AI 생성
6. 슬라이드 편집 및 저장
7. 공유 링크 생성

### 학생 (게임 플레이)

1. 교사가 제공한 공유 링크 접속
2. 게임 플레이 및 선택지 선택
3. 변수 변화 확인하며 스토리 진행

## Google Apps Script 설정

마스터 프록시 스크립트는 다음 기능을 제공해야 합니다:

- `doPost(e)`: POST 요청 처리
- `action` 파라미터에 따라:
  - `save`: 게임 데이터 저장
  - `load`: 게임 데이터 불러오기
- `targetSheetUrl`로 시트 열기 및 데이터 읽기/쓰기

## 배포 (Netlify)

### Netlify 배포 설정

프로젝트에는 Netlify 배포를 위한 설정 파일이 포함되어 있습니다:

- `netlify.toml`: Netlify 빌드 및 리다이렉트 설정
- `public/_redirects`: SPA 라우팅을 위한 리다이렉트 규칙

### 배포 방법

1. GitHub에 코드 푸시
2. Netlify에서 "New site from Git" 선택
3. 저장소 연결 및 빌드 설정:
   - Build command: `npm run build`
   - Publish directory: `dist`
4. 환경 변수 설정:
   - `VITE_OPENAI_API_KEY`: OpenAI API 키
   - `VITE_GOOGLE_SCRIPT_URL`: Google Apps Script URL

### SPA 라우팅 문제 해결

페이지를 새로고침하면 404 오류가 발생하는 경우, `public/_redirects` 파일이 제대로 배포되었는지 확인하세요. 이 파일은 모든 경로를 `index.html`로 리다이렉트하여 React Router가 정상 작동하도록 합니다.

## 라이선스

MIT