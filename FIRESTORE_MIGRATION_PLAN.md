# Firestore 전환 계획

## 현재 문제 분석

### 1. 공유 링크 문제
- **원인**: 1920x1080 이미지가 여러 개 포함되면 Base64 데이터가 매우 커짐
- **결과**: URL 길이 제한(1000자) 초과로 공유 링크 생성 실패
- **현재 해결책**: 파일 다운로드 방식 (불편함)

### 2. Google Script 저장 실패
- **원인**: CORS 정책 문제로 Google Apps Script와 통신 불가
- **결과**: 시트 URL 기반 공유 링크도 작동하지 않음
- **현재 해결책**: 로컬 저장만 작동 (공유 불가)

## Firestore 전환의 장점

### ✅ 해결되는 문제들
1. **CORS 문제 없음**: Firestore는 클라이언트 SDK를 통해 직접 접근 가능
2. **URL 길이 제한 없음**: 게임 ID만 URL에 포함 (예: `/play?id=abc123`)
3. **실시간 동기화**: 교사가 수정하면 학생들이 즉시 반영 가능
4. **확장성**: 이미지와 데이터 크기 제한 없음
5. **안정성**: Google의 인프라 사용

### ⚠️ 고려사항
1. **Firebase 프로젝트 설정 필요**: Firebase Console에서 프로젝트 생성
2. **인증 설정**: 익명 인증 또는 공개 읽기 권한 설정 필요
3. **비용**: 무료 티어 있음 (일일 읽기 50,000회, 쓰기 20,000회)
4. **학습 곡선**: Firebase SDK 학습 필요

## 구현 계획

### 단계 1: Firebase 프로젝트 설정
1. Firebase Console에서 프로젝트 생성
2. Firestore Database 생성
3. 보안 규칙 설정 (공개 읽기, 작성자만 쓰기)
4. 웹 앱 등록 및 설정 복사

### 단계 2: 코드 구조
```
src/
  services/
    firestore.js      # Firestore 저장/불러오기
    googleScript.js    # 기존 코드 유지 (점진적 전환)
```

### 단계 3: 데이터 구조
```javascript
// Firestore 컬렉션: games
{
  id: "abc123",  // 자동 생성 또는 사용자 지정
  gameTitle: "게임 제목",
  protagonistName: "주인공 이름",
  synopsis: "시놉시스",
  variables: [...],
  slides: [...],
  characterImages: [...],
  createdAt: timestamp,
  updatedAt: timestamp,
  createdBy: "user-id" // 선택사항
}
```

### 단계 4: 공유 링크 생성
```javascript
// 기존: /play?data=very-long-base64-string
// 변경: /play?id=abc123
```

### 단계 5: 점진적 전환
- Firestore 저장 성공 시 Firestore 사용
- 실패 시 기존 방식(로컬 저장)으로 폴백
- 사용자가 선택할 수 있도록 설정

## 비용 예상

### 무료 티어 (Spark Plan)
- 일일 읽기: 50,000회
- 일일 쓰기: 20,000회
- 일일 삭제: 20,000회
- 저장 공간: 1GB

### 사용량 예상 (교실 환경)
- 교사 1명이 게임 1개 저장: 1회 쓰기
- 학생 30명이 게임 1개 플레이: 30회 읽기
- **결론**: 무료 티어로 충분함

## 보안 규칙 예시

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // 게임 데이터는 누구나 읽을 수 있음
    match /games/{gameId} {
      allow read: if true;
      // 쓰기는 인증된 사용자만 (또는 공개 쓰기)
      allow write: if true; // 또는 request.auth != null;
    }
  }
}
```

## 마이그레이션 전략

### 옵션 1: 완전 전환
- Google Script 완전 제거
- Firestore만 사용
- **장점**: 단순함
- **단점**: 기존 데이터 마이그레이션 필요

### 옵션 2: 하이브리드 (권장)
- Firestore 우선 시도
- 실패 시 Google Script 시도
- 둘 다 실패 시 로컬 저장
- **장점**: 안정성, 점진적 전환
- **단점**: 코드 복잡도 증가

## 다음 단계

1. Firebase 프로젝트 생성 여부 확인
2. Firestore 서비스 구현
3. 기존 코드와 통합
4. 테스트 및 배포
