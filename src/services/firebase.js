/**
 * Firebase 초기화 및 설정
 */
import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'

// 환경 변수에서 Firebase 설정 가져오기
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
}

// Firebase 초기화
let app = null
let db = null

try {
  // 필수 환경 변수 확인
  if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
    console.warn('Firebase 설정이 완료되지 않았습니다. .env 파일을 확인하세요.')
  } else {
    app = initializeApp(firebaseConfig)
    db = getFirestore(app)
    console.log('Firebase 초기화 완료')
  }
} catch (error) {
  console.error('Firebase 초기화 실패:', error)
}

export { db }
export default app
