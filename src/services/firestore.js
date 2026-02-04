/**
 * Firestore 데이터베이스 서비스
 * 게임 데이터 저장 및 불러오기
 */
import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  addDoc,
  query,
  orderBy,
  limit,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore'
import { db } from './firebase'

const GAMES_COLLECTION = 'games'

/**
 * 게임 데이터를 Firestore에 저장
 * @param {Object} gameData - 게임 데이터
 * @param {string} gameId - 기존 게임 ID (없으면 새로 생성)
 * @returns {Promise<string>} 게임 ID
 */
export async function saveGameToFirestore(gameData, gameId = null) {
  if (!db) {
    throw new Error('Firebase가 초기화되지 않았습니다. .env 파일을 확인하세요.')
  }

  try {
    const gameDataWithTimestamp = {
      ...gameData,
      updatedAt: serverTimestamp()
    }

    // 기존 게임 ID가 있으면 업데이트, 없으면 새로 생성
    if (gameId) {
      const gameRef = doc(db, GAMES_COLLECTION, gameId)
      await setDoc(gameRef, gameDataWithTimestamp, { merge: true })
      return gameId
    } else {
      // 새 게임 생성
      const gameDataWithCreateTime = {
        ...gameDataWithTimestamp,
        createdAt: serverTimestamp()
      }
      const docRef = await addDoc(collection(db, GAMES_COLLECTION), gameDataWithCreateTime)
      return docRef.id
    }
  } catch (error) {
    console.error('Firestore 저장 오류:', error)
    throw new Error(`게임 저장 실패: ${error.message}`)
  }
}

/**
 * Firestore에서 게임 데이터 불러오기
 * @param {string} gameId - 게임 ID
 * @returns {Promise<Object|null>} 게임 데이터
 */
export async function loadGameFromFirestore(gameId) {
  if (!db) {
    throw new Error('Firebase가 초기화되지 않았습니다. .env 파일을 확인하세요.')
  }

  if (!gameId) {
    throw new Error('게임 ID가 필요합니다.')
  }

  try {
    const gameRef = doc(db, GAMES_COLLECTION, gameId)
    const gameSnap = await getDoc(gameRef)

    if (!gameSnap.exists()) {
      return null
    }

    const data = gameSnap.data()

    // Timestamp를 Date로 변환
    const convertedData = {
      ...data,
      createdAt: data.createdAt?.toDate?.() || data.createdAt,
      updatedAt: data.updatedAt?.toDate?.() || data.updatedAt
    }

    return convertedData
  } catch (error) {
    console.error('Firestore 불러오기 오류:', error)
    throw new Error(`게임 불러오기 실패: ${error.message}`)
  }
}

/**
 * Firestore에서 게임 목록 불러오기 (최신순)
 * @param {number} maxResults - 최대 결과 수 (기본값: 50)
 * @returns {Promise<Array>} 게임 목록 (id, title, thumbnail, updatedAt 포함)
 */
export async function getGamesList(maxResults = 50) {
  if (!db) {
    throw new Error('Firebase가 초기화되지 않았습니다. .env 파일을 확인하세요.')
  }

  try {
    const gamesRef = collection(db, GAMES_COLLECTION)
    const q = query(
      gamesRef,
      orderBy('updatedAt', 'desc'),
      limit(maxResults)
    )
    const querySnapshot = await getDocs(q)

    const games = []
    querySnapshot.forEach((doc) => {
      const data = doc.data()
      games.push({
        id: doc.id,
        firestoreId: doc.id,
        title: data.gameTitle || '제목 없음',
        thumbnail: data.characterImages?.[0]?.base64 || null,
        updatedAt: data.updatedAt?.toDate?.() || data.updatedAt || new Date(),
        createdAt: data.createdAt?.toDate?.() || data.createdAt || new Date()
      })
    })

    return games
  } catch (error) {
    console.error('Firestore 목록 조회 오류:', error)
    throw new Error(`게임 목록 불러오기 실패: ${error.message}`)
  }
}

/**
 * Firestore 사용 가능 여부 확인
 * @returns {boolean}
 */
export function isFirestoreAvailable() {
  return db !== null
}
