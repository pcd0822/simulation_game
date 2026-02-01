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
    // Google Apps Script는 CORS 제한이 있으므로 여러 방법 시도
    const payload = {
      targetSheetUrl,
      action,
      ...data
    }

    // 방법 1: POST with JSON (기본 시도)
    try {
      const response = await fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        mode: 'cors',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      })
      
      if (response.ok) {
        const result = await response.json()
        
        if (result.status === 'error') {
          throw new Error(result.message || '알 수 없는 오류가 발생했습니다.')
        }
        
        return result
      }
    } catch (postError) {
      console.warn('POST 요청 실패, GET 방식으로 재시도:', postError)
    }

    // 방법 2: GET 방식으로 URL 파라미터 전송 (CORS 문제 회피)
    const params = new URLSearchParams({
      targetSheetUrl: encodeURIComponent(targetSheetUrl),
      action,
      ...Object.entries(data).reduce((acc, [key, value]) => {
        acc[key] = typeof value === 'string' ? value : JSON.stringify(value)
        return acc
      }, {})
    })

    const getUrl = `${GOOGLE_SCRIPT_URL}?${params.toString()}`
    const response = await fetch(getUrl, {
      method: 'GET',
      mode: 'cors'
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    // Google Apps Script는 text/html로 응답할 수 있으므로 처리
    const contentType = response.headers.get('content-type')
    let result
    
    if (contentType && contentType.includes('application/json')) {
      result = await response.json()
    } else {
      const text = await response.text()
      try {
        result = JSON.parse(text)
      } catch (e) {
        // HTML 응답인 경우 JSON 추출 시도
        const jsonMatch = text.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          result = JSON.parse(jsonMatch[0])
        } else {
          throw new Error('응답을 파싱할 수 없습니다.')
        }
      }
    }
    
    if (result.status === 'error') {
      throw new Error(result.message || '알 수 없는 오류가 발생했습니다.')
    }
    
    return result
  } catch (error) {
    console.error('Google Script 통신 오류:', error)
    // CORS 오류인 경우 더 명확한 메시지 제공
    if (error.message.includes('Failed to fetch') || error.name === 'TypeError') {
      throw new Error('Google Apps Script 서버에 연결할 수 없습니다. CORS 설정을 확인하거나 네트워크 연결을 확인해주세요.')
    }
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
