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
