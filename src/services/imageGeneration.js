/**
 * AI 이미지 생성 서비스
 * OpenAI DALL-E API를 사용하여 스토리에 맞는 이미지 생성
 */

const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY
const OPENAI_IMAGE_API_URL = 'https://api.openai.com/v1/images/generations'

/**
 * 기본 이미지를 참고하여 스토리에 맞는 이미지 생성
 * @param {string} slideText - 슬라이드의 대사/지문
 * @param {string} baseImageBase64 - 기본 이미지 (Base64)
 * @param {string} imageLabel - 이미지 라벨 (예: "기쁨", "슬픔")
 * @param {string} protagonistName - 주인공 이름
 * @returns {Promise<string>} 생성된 이미지의 Base64 문자열
 */
export async function generateImageForSlide(slideText, baseImageBase64, imageLabel, protagonistName) {
  if (!OPENAI_API_KEY || OPENAI_API_KEY === 'your_openai_api_key_here') {
    throw new Error('OpenAI API 키가 설정되지 않았습니다. .env 파일에 VITE_OPENAI_API_KEY를 설정해주세요.')
  }

  // 프롬프트 생성 (DALL-E 3는 최대 4000자 제한)
  const sceneDescription = slideText.substring(0, 150).trim()
  const prompt = `A clean, simple cartoon-style character illustration for an interactive story game. 
Character: ${protagonistName || 'a character'} with a ${imageLabel} expression.
Scene: ${sceneDescription || 'a simple scene'}
Style: cartoon, clean lines, suitable for children's story game.
Background: simple and uncluttered.
Focus: character's ${imageLabel} facial expression and emotion.`

  console.log('이미지 생성 시작:', { promptLength: prompt.length, imageLabel, protagonistName })

  try {
    // DALL-E API 호출
    const requestBody = {
      model: 'dall-e-3',
      prompt: prompt,
      n: 1,
      size: '1024x1024',
      quality: 'standard'
    }

    console.log('API 요청:', { url: OPENAI_IMAGE_API_URL, hasKey: !!OPENAI_API_KEY })

    const response = await fetch(OPENAI_IMAGE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify(requestBody)
    })

    console.log('API 응답 상태:', response.status, response.statusText)

    if (!response.ok) {
      let errorMessage = `HTTP 오류: ${response.status}`
      try {
        const errorData = await response.json()
        console.error('API 오류 응답:', errorData)
        errorMessage = errorData.error?.message || errorData.error?.code || errorMessage
        
        // 특정 오류 코드에 대한 친화적인 메시지
        if (errorData.error?.code === 'rate_limit_exceeded') {
          errorMessage = 'API 사용량이 초과되었습니다. 잠시 후 다시 시도해주세요.'
        } else if (errorData.error?.code === 'invalid_api_key') {
          errorMessage = 'OpenAI API 키가 유효하지 않습니다. .env 파일을 확인해주세요.'
        } else if (errorData.error?.code === 'content_policy_violation') {
          errorMessage = '프롬프트가 콘텐츠 정책에 위배됩니다. 다른 내용으로 시도해주세요.'
        }
      } catch (parseError) {
        console.error('오류 응답 파싱 실패:', parseError)
        const text = await response.text().catch(() => '')
        errorMessage = `API 오류 (${response.status}): ${text.substring(0, 200)}`
      }
      throw new Error(errorMessage)
    }

    const data = await response.json()
    console.log('API 응답 데이터:', data)

    const imageUrl = data.data?.[0]?.url

    if (!imageUrl) {
      console.error('이미지 URL이 없음:', data)
      throw new Error('이미지 생성에 실패했습니다. 응답에 이미지 URL이 없습니다.')
    }

    console.log('이미지 URL 받음, 다운로드 시작:', imageUrl)

    // URL에서 이미지를 가져와서 Base64로 변환
    const imageResponse = await fetch(imageUrl, {
      method: 'GET',
      mode: 'cors'
    })

    if (!imageResponse.ok) {
      throw new Error(`이미지 다운로드 실패: ${imageResponse.status}`)
    }

    const blob = await imageResponse.blob()
    console.log('이미지 다운로드 완료, Base64 변환 시작')
    
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => {
        console.log('Base64 변환 완료')
        resolve(reader.result)
      }
      reader.onerror = (error) => {
        console.error('FileReader 오류:', error)
        reject(new Error('이미지 변환에 실패했습니다.'))
      }
      reader.readAsDataURL(blob)
    })
  } catch (error) {
    console.error('이미지 생성 오류 상세:', {
      error,
      message: error.message,
      name: error.name,
      stack: error.stack
    })
    
    // 네트워크 오류인 경우
    if (error.message.includes('Failed to fetch') || error.name === 'TypeError') {
      throw new Error(
        '네트워크 오류가 발생했습니다. ' +
        '가능한 원인:\n' +
        '1. 인터넷 연결 확인\n' +
        '2. OpenAI API 서버 문제\n' +
        '3. CORS 설정 문제 (브라우저 콘솔 확인)\n\n' +
        '원본 오류: ' + error.message
      )
    }
    
    throw error
  }
}

/**
 * 이미지를 압축하여 Base64로 변환 (기존 유틸리티와 동일한 방식)
 * @param {string} dataUrl - 이미지 데이터 URL
 * @param {number} maxWidth - 최대 너비 (기본값: 300)
 * @returns {Promise<string>} 압축된 Base64 이미지
 */
export async function compressImageDataUrl(dataUrl, maxWidth = 300) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    
    img.onload = () => {
      const canvas = document.createElement('canvas')
      let width = img.width
      let height = img.height
      
      if (width > maxWidth) {
        height = (height * maxWidth) / width
        width = maxWidth
      }
      
      canvas.width = width
      canvas.height = height
      
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0, width, height)
      
      const base64 = canvas.toDataURL('image/jpeg', 0.8)
      resolve(base64)
    }
    
    img.onerror = () => {
      reject(new Error('이미지 로드 실패'))
    }
    
    img.src = dataUrl
  })
}
