/**
 * Google Apps Script 마스터 프록시와의 통신 유틸리티
 */

const GOOGLE_SCRIPT_URL = import.meta.env.VITE_GOOGLE_SCRIPT_URL

/**
 * Google Apps Script에 POST 요청 전송
 * @param {string} targetSheetUrl - 대상 시트 URL
 * @param {string} action - 수행할 액션 (save, load 등)
 * @param {Object} data - 전송할 데이터
 * @returns {Promise<Object>} 응답 데이터
 */
export async function sendToGoogleScript(targetSheetUrl, action, data = {}) {
  try {
    const response = await fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        targetSheetUrl,
        action,
        ...data
      })
    })
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    
    const result = await response.json()
    
    if (result.status === 'error') {
      throw new Error(result.message || '알 수 없는 오류가 발생했습니다.')
    }
    
    return result
  } catch (error) {
    console.error('Google Script 통신 오류:', error)
    throw error
  }
}

/**
 * 게임 데이터 저장
 * @param {string} targetSheetUrl - 대상 시트 URL
 * @param {Object} gameData - 저장할 게임 데이터
 * @returns {Promise<Object>}
 */
export async function saveGameData(targetSheetUrl, gameData) {
  return sendToGoogleScript(targetSheetUrl, 'save', {
    gameData: JSON.stringify(gameData)
  })
}

/**
 * 게임 데이터 불러오기
 * @param {string} targetSheetUrl - 대상 시트 URL
 * @returns {Promise<Object>}
 */
export async function loadGameData(targetSheetUrl) {
  const result = await sendToGoogleScript(targetSheetUrl, 'load')
  
  if (result.data) {
    try {
      return typeof result.data === 'string' 
        ? JSON.parse(result.data) 
        : result.data
    } catch (e) {
      console.error('데이터 파싱 오류:', e)
      throw new Error('데이터 형식이 올바르지 않습니다.')
    }
  }
  
  return null
}

/**
 * 시트 URL 유효성 검사
 * @param {string} url - 시트 URL
 * @returns {boolean}
 */
export function validateSheetUrl(url) {
  if (!url) return false
  
  // Google Sheets URL 패턴 확인
  const patterns = [
    /^https:\/\/docs\.google\.com\/spreadsheets\/d\/[a-zA-Z0-9_-]+/,
    /^https:\/\/docs\.google\.com\/spreadsheets\/d\/[a-zA-Z0-9_-]+\/edit/
  ]
  
  return patterns.some(pattern => pattern.test(url))
}

/**
 * 시트 URL 정규화 (공유 링크에서 편집 가능한 URL로 변환)
 * @param {string} url - 시트 URL
 * @returns {string}
 */
export function normalizeSheetUrl(url) {
  if (!url) return ''
  
  // URL에서 ID 추출
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/)
  if (match) {
    return `https://docs.google.com/spreadsheets/d/${match[1]}/edit`
  }
  
  return url
}
