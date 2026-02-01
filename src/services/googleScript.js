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
  if (!GOOGLE_SCRIPT_URL) {
    throw new Error('Google Script URL이 설정되지 않았습니다.')
  }

  const payload = {
    targetSheetUrl,
    action,
    ...data
  }

  // Google Apps Script Web App은 CORS 제한이 있을 수 있으므로
  // 여러 방법을 순차적으로 시도
  
  // 방법 1: POST with JSON (기본)
  try {
    const response = await fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      mode: 'cors',
      credentials: 'omit',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    })
    
    if (response.ok) {
      const contentType = response.headers.get('content-type')
      let result
      
      if (contentType && contentType.includes('application/json')) {
        result = await response.json()
      } else {
        const text = await response.text()
        try {
          result = JSON.parse(text)
        } catch (e) {
          const jsonMatch = text.match(/\{[\s\S]*\}/)
          if (jsonMatch) {
            result = JSON.parse(jsonMatch[0])
          } else {
            throw new Error('JSON 응답을 찾을 수 없습니다.')
          }
        }
      }
      
      if (result.status === 'error') {
        throw new Error(result.message || '서버 오류가 발생했습니다.')
      }
      
      return result
    } else {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
  } catch (postError) {
    console.warn('POST 요청 실패:', postError.message)
    
    // 방법 2: GET 방식으로 재시도 (URL 길이 제한 주의)
    try {
      // 데이터가 너무 크면 GET 방식 사용 불가
      const dataString = JSON.stringify(data)
      if (dataString.length > 2000) {
        throw new Error('데이터가 너무 커서 GET 방식으로 전송할 수 없습니다.')
      }

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
        mode: 'cors',
        credentials: 'omit'
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const contentType = response.headers.get('content-type')
      let result
      
      if (contentType && contentType.includes('application/json')) {
        result = await response.json()
      } else {
        const text = await response.text()
        try {
          result = JSON.parse(text)
        } catch (e) {
          const jsonMatch = text.match(/\{[\s\S]*\}/)
          if (jsonMatch) {
            result = JSON.parse(jsonMatch[0])
          } else {
            throw new Error('응답을 파싱할 수 없습니다.')
          }
        }
      }
      
      if (result.status === 'error') {
        throw new Error(result.message || '서버 오류가 발생했습니다.')
      }
      
      return result
    } catch (getError) {
      console.warn('GET 요청도 실패:', getError.message)
      // 최종 실패 - CORS 또는 네트워크 문제
      throw new Error(
        'Google Apps Script에 연결할 수 없습니다. ' +
        '가능한 원인:\n' +
        '1. Google Apps Script가 "웹 앱으로 배포"되어 있지 않음\n' +
        '2. CORS 설정 문제 (doGet/doPost에서 CORS 헤더 설정 필요)\n' +
        '3. 네트워크 연결 문제\n\n' +
        '로컬 저장은 정상적으로 작동합니다.'
      )
    }
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
