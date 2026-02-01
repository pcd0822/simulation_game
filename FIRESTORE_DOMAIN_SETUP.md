# Firestore 도메인 설정 가이드

## ✅ Firestore는 도메인 승인이 필요 없습니다

**Firestore는 클라이언트 SDK를 통해 직접 접근하므로, 별도의 도메인 승인 설정이 필요하지 않습니다.**

학생들이 받은 게임 실행 링크(예: `https://yourdomain.com/play?id=abc123`)는 **추가 설정 없이 바로 작동**합니다.

## Firebase Console의 "승인된 도메인" 설정

Firebase Console에 "승인된 도메인" 설정이 있지만, 이는 다음 기능에만 사용됩니다:

### 1. Authentication (인증 기능)
- Google 로그인, 이메일 로그인 등 OAuth 리다이렉트 시 필요
- **현재 프로젝트는 인증을 사용하지 않으므로 불필요**

### 2. Firebase Hosting
- Firebase Hosting을 사용하는 경우에만 필요
- **현재 프로젝트는 Netlify를 사용하므로 불필요**

### 3. Dynamic Links
- Firebase Dynamic Links 기능 사용 시 필요
- **현재 프로젝트는 사용하지 않으므로 불필요**

## 현재 프로젝트 설정

### ✅ 필요한 설정
1. **Firestore 보안 규칙** - `firestore.rules` 파일의 규칙 적용
2. **Firebase 프로젝트 생성** - 이미 완료됨
3. **Firestore Database 생성** - 이미 완료됨

### ❌ 불필요한 설정
1. ~~승인된 도메인 추가~~ - **필요 없음**
2. ~~Authentication 설정~~ - **사용하지 않음**
3. ~~OAuth 리다이렉트 설정~~ - **사용하지 않음**

## 보안 규칙으로 도메인 제한 (선택사항)

만약 특정 도메인에서만 접근을 허용하고 싶다면, 보안 규칙에서 제한할 수 있습니다:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /games/{gameId} {
      // 특정 도메인에서만 읽기 허용 (선택사항)
      allow read: if request.headers.origin.matches('https://yourdomain.com');
      
      // 또는 모든 도메인에서 읽기 허용 (현재 설정)
      allow read: if true;
      
      allow write: if true;
      allow delete: if true;
    }
  }
}
```

**하지만 일반적으로는 도메인 제한이 필요 없습니다.** 보안 규칙에서 `allow read: if true`로 설정하면 모든 도메인에서 접근 가능합니다.

## 결론

**학생들이 받은 게임 실행 링크는 추가 도메인 승인 없이 바로 작동합니다!**

Firestore는 클라이언트 SDK를 통해 직접 접근하므로:
- ✅ 도메인 승인 불필요
- ✅ 추가 설정 불필요
- ✅ 바로 사용 가능

다만, Firestore 보안 규칙은 반드시 설정해야 합니다.
