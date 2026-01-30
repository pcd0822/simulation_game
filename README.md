# Classroom Sim-Game Maker

Google Spreadsheets를 DB로 사용하는, 교육용 미소녀 연애 시뮬레이션(비주얼 노벨) 제작·플레이 웹앱입니다.  
자연어로 스토리를 입력하면 AI(GPT-4o)가 게임 노드로 변환하고, 표정 이미지를 자동 매칭합니다.

## 기술 스택

- **Frontend**: React, Vite, TypeScript, Tailwind CSS, Lucide React, React Flow (@xyflow/react), React Router
- **Backend**: Google Apps Script Web App (배포된 API URL 사용)
- **AI**: OpenAI API (GPT-4o), Netlify 환경변수로 키 관리

## 데이터베이스 (Google Sheets)

- **정책**: 1 Game = 1 Sheet
- **저장**: 전체 게임 데이터(설정, 노드, 이미지 에셋 Base64)를 하나의 JSON으로 `action=save`로 전송
- **불러오기**: `action=load`로 마지막 저장 데이터 로드

## 환경 변수

프로젝트 루트에 `.env` 파일을 만들고 다음을 설정하세요.

```env
VITE_GOOGLE_SHEET_API_URL=https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec
VITE_OPENAI_API_KEY=sk-...
```

`.env.example`을 참고할 수 있습니다.

## 설치 및 실행

```bash
npm install
npm run dev
```

빌드:

```bash
npm run build
```

## Google Apps Script 배포

`google-apps-script/Code.gs` 내용을 새 Google 스프레드시트의 Apps Script 편집기에 붙여넣고,  
Web App으로 배포한 뒤 **실행 URL**을 `VITE_GOOGLE_SHEET_API_URL`에 넣으세요.

## 주요 기능

1. **설정**: 게임 제목, 캐릭터명, 표정 이미지 업로드(200px 썸네일 Base64), 라벨 매핑, 변수 정의
2. **스토리 입력**: 줄글 입력 → AI가 JSON 노드 생성 및 감정→표정 라벨 매칭
3. **에디터**: React Flow로 노드 시각화, 노드 클릭 시 대사/표정/변수 수정
4. **플레이**: 대화창, 캐릭터 스탠딩, 배경, 선택지, HUD(변수)로 미연시 플레이

## 프로젝트 구조

```
src/
  components/   AssetManager, StoryEditor, GamePlayer
  pages/        SettingsPage, StoryInputPage, EditorPage
  services/     openaiStoryParser
  utils/       GoogleSheetAPI, imageCompress
  types/       game.ts
google-apps-script/
  Code.gs       Google Sheets 백엔드 (배포용)
```
