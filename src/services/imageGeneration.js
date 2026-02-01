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
    throw new Error('OpenAI API 키가 설정되지 않았습니다.')
  }

  // 프롬프트 생성
  const prompt = `Create an illustration showing ${protagonistName || 'the character'} with a ${imageLabel} expression, matching the scene: "${slideText.substring(0, 200)}". 
Style: clean, simple, cartoon-style character illustration suitable for an interactive story game. 
Background: simple and uncluttered. 
Focus on the character's ${imageLabel} expression and emotion.`

  try {
    // DALL-E API 호출
    // DALL-E 3는 URL 형식만 지원하므로, URL을 받아서 Base64로 변환
    const response = await fetch(OPENAI_IMAGE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'dall-e-3',
        prompt: prompt,
        n: 1,
        size: '1024x1024',
        quality: 'standard'
      })
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error?.message || `API 오류: ${response.status}`)
    }

    const data = await response.json()
    const imageUrl = data.data[0]?.url

    if (!imageUrl) {
      throw new Error('이미지 생성에 실패했습니다.')
    }

    // URL에서 이미지를 가져와서 Base64로 변환
    const imageResponse = await fetch(imageUrl)
    const blob = await imageResponse.blob()
    
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => {
        resolve(reader.result)
      }
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  } catch (error) {
    console.error('이미지 생성 오류:', error)
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
