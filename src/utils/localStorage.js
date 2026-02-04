/**
 * 로컬스토리지 유틸리티
 * 게임 데이터를 로컬에 자동 저장/불러오기
 */

const STORAGE_KEY = 'interactive_story_game_data'

/**
 * 게임 데이터를 로컬스토리지에 저장
 * @param {Object} gameData - 저장할 게임 데이터
 */
export function saveToLocalStorage(gameData) {
  try {
    const dataToSave = {
      ...gameData,
      savedAt: new Date().toISOString()
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave))
    console.log('로컬스토리지에 저장 완료:', dataToSave)
  } catch (error) {
    console.error('로컬스토리지 저장 오류:', error)
  }
}

/**
 * 로컬스토리지에서 게임 데이터 불러오기
 * @returns {Object|null}
 */
export function loadFromLocalStorage() {
  try {
    const data = localStorage.getItem(STORAGE_KEY)
    if (data) {
      const parsed = JSON.parse(data)
      console.log('로컬스토리지에서 불러옴:', parsed)
      return parsed
    }
  } catch (error) {
    console.error('로컬스토리지 불러오기 오류:', error)
  }
  return null
}

/**
 * 로컬스토리지 데이터 삭제
 */
export function clearLocalStorage() {
  try {
    localStorage.removeItem(STORAGE_KEY)
    console.log('로컬스토리지 삭제 완료')
  } catch (error) {
    console.error('로컬스토리지 삭제 오류:', error)
  }
}

/**
 * 로컬스토리지에 저장된 시간 확인
 * @returns {Date|null}
 */
export function getLastSavedTime() {
  try {
    const data = localStorage.getItem(STORAGE_KEY)
    if (data) {
      const parsed = JSON.parse(data)
      return parsed.savedAt ? new Date(parsed.savedAt) : null
    }
  } catch (error) {
    console.error('저장 시간 확인 오류:', error)
  }
  return null
}


const HISTORY_KEY = 'interactive_story_game_history'

/**
 * 게임 히스토리 저장 (목록 관리)
 * @param {Object} gameData - 게임 데이터 (id, title, thumbnail 등 포함)
 */
export function saveGameHistory(gameData) {
  try {
    const history = getGameHistory()

    // 필수 정보만 추출하여 저장
    const gameInfo = {
      id: gameData.firestoreGameId || `local_${Date.now()}`,
      title: gameData.gameTitle || '제목 없음',
      thumbnail: gameData.characterImages?.[0]?.base64 || null,
      updatedAt: new Date().toISOString(),
      firestoreId: gameData.firestoreGameId
    }

    // 이미 존재하는 게임이면 업데이트, 아니면 추가
    const existingIndex = history.findIndex(g =>
      (gameInfo.firestoreId && g.firestoreId === gameInfo.firestoreId) ||
      (g.title === gameInfo.title) // 제목이 같으면 같은 게임으로 간주 (간단한 로직)
    )

    let newHistory
    if (existingIndex >= 0) {
      newHistory = [...history]
      newHistory[existingIndex] = { ...newHistory[existingIndex], ...gameInfo }
    } else {
      newHistory = [gameInfo, ...history]
    }

    localStorage.setItem(HISTORY_KEY, JSON.stringify(newHistory))
  } catch (error) {
    console.error('히스토리 저장 오류:', error)
  }
}

/**
 * 저장된 게임 목록 불러오기
 * @returns {Array} 게임 정보 목록
 */
export function getGameHistory() {
  try {
    const data = localStorage.getItem(HISTORY_KEY)
    return data ? JSON.parse(data) : []
  } catch (error) {
    console.error('히스토리 불러오기 오류:', error)
    return []
  }
}

/**
 * 히스토리에서 게임 삭제
 * @param {string} gameId - 게임 ID (firestoreId 또는 id)
 */
export function removeGameFromHistory(gameId) {
  try {
    const history = getGameHistory()
    const newHistory = history.filter(g => 
      g.firestoreId !== gameId && g.id !== gameId
    )
    localStorage.setItem(HISTORY_KEY, JSON.stringify(newHistory))
    console.log('히스토리에서 게임 삭제 완료:', gameId)
  } catch (error) {
    console.error('히스토리 삭제 오류:', error)
  }
}
