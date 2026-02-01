/**
 * 게임 데이터 내보내기/가져오기 유틸리티
 * URL 파라미터 또는 파일로 데이터 공유
 */

/**
 * 게임 데이터를 Base64로 인코딩
 * @param {Object} gameData - 게임 데이터
 * @returns {string} Base64 인코딩된 문자열
 */
export function encodeGameData(gameData) {
  try {
    const jsonString = JSON.stringify(gameData)
    return btoa(encodeURIComponent(jsonString))
  } catch (error) {
    console.error('데이터 인코딩 오류:', error)
    throw new Error('데이터 인코딩에 실패했습니다.')
  }
}

/**
 * Base64로 인코딩된 게임 데이터 디코딩
 * @param {string} encodedData - Base64 인코딩된 문자열
 * @returns {Object} 게임 데이터
 */
export function decodeGameData(encodedData) {
  try {
    const jsonString = decodeURIComponent(atob(encodedData))
    return JSON.parse(jsonString)
  } catch (error) {
    console.error('데이터 디코딩 오류:', error)
    throw new Error('데이터 디코딩에 실패했습니다.')
  }
}

/**
 * 게임 데이터를 파일로 다운로드
 * @param {Object} gameData - 게임 데이터
 * @param {string} filename - 파일명 (기본값: game-data.json)
 */
export function downloadGameData(gameData, filename = 'game-data.json') {
  try {
    const jsonString = JSON.stringify(gameData, null, 2)
    const blob = new Blob([jsonString], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  } catch (error) {
    console.error('파일 다운로드 오류:', error)
    throw new Error('파일 다운로드에 실패했습니다.')
  }
}

/**
 * 파일에서 게임 데이터 불러오기
 * @param {File} file - 업로드할 파일
 * @returns {Promise<Object>} 게임 데이터
 */
export function loadGameDataFromFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    
    reader.onload = (e) => {
      try {
        const gameData = JSON.parse(e.target.result)
        resolve(gameData)
      } catch (error) {
        reject(new Error('파일 형식이 올바르지 않습니다.'))
      }
    }
    
    reader.onerror = () => {
      reject(new Error('파일 읽기에 실패했습니다.'))
    }
    
    reader.readAsText(file)
  })
}

/**
 * 공유 URL 생성 (데이터 포함)
 * @param {Object} gameData - 게임 데이터
 * @param {string} baseUrl - 기본 URL
 * @returns {string} 공유 URL
 */
export function generateShareUrlWithData(gameData, baseUrl) {
  try {
    const encodedData = encodeGameData(gameData)
    // URL 길이 제한을 고려하여 데이터 포함
    return `${baseUrl}/play?data=${encodedData}`
  } catch (error) {
    console.error('URL 생성 오류:', error)
    // 데이터가 너무 크면 파일 다운로드 방식으로 안내
    throw new Error('데이터가 너무 커서 URL에 포함할 수 없습니다. 파일 다운로드를 사용해주세요.')
  }
}

/**
 * 공유 URL 생성 (시트 URL 기반)
 * @param {string} sheetUrl - 시트 URL
 * @param {string} baseUrl - 기본 URL
 * @returns {string} 공유 URL
 */
export function generateShareUrlWithSheet(sheetUrl, baseUrl) {
  const encodedUrl = encodeURIComponent(sheetUrl)
  return `${baseUrl}/play?sheet=${encodedUrl}`
}
