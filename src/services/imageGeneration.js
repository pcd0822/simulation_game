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
    
    // 이미지 URL을 전역 변수에 저장 (오류 발생 시 사용)
    if (typeof window !== 'undefined') {
      window.lastGeneratedImageUrl = imageUrl
    }

    // CORS 문제를 우회하기 위해 Image 객체와 Canvas를 사용하여 Base64로 변환
    return new Promise((resolve, reject) => {
      const img = new Image()
      
      // CORS 문제를 우회하기 위해 crossOrigin 설정
      img.crossOrigin = 'anonymous'
      
      // 타임아웃 설정 (30초)
      const timeout = setTimeout(() => {
        reject(new Error('이미지 로드 시간이 초과되었습니다.'))
      }, 30000)
      
      img.onload = () => {
        clearTimeout(timeout)
        try {
          console.log('이미지 로드 완료, Canvas 변환 시작:', { width: img.width, height: img.height })
          
          // Canvas 생성
          const canvas = document.createElement('canvas')
          canvas.width = img.width
          canvas.height = img.height
          
          // Canvas에 이미지 그리기
          const ctx = canvas.getContext('2d')
          ctx.drawImage(img, 0, 0)
          
          // Base64로 변환
          const base64 = canvas.toDataURL('image/png')
          console.log('Base64 변환 완료')
          resolve(base64)
        } catch (canvasError) {
          console.error('Canvas 변환 오류:', canvasError)
          reject(new Error('이미지를 Base64로 변환할 수 없습니다: ' + canvasError.message))
        }
      }
      
      img.onerror = (error) => {
        clearTimeout(timeout)
        console.error('이미지 로드 오류:', error)
        
        // CORS 오류인 경우, 여러 프록시를 순차적으로 시도
        console.warn('직접 로드 실패, 프록시를 통한 다운로드 시도...')
        
        // 여러 CORS 프록시 서비스 목록
        const proxyServices = [
          {
            name: 'allorigins',
            url: `https://api.allorigins.win/raw?url=${encodeURIComponent(imageUrl)}`
          },
          {
            name: 'corsproxy',
            url: `https://corsproxy.io/?${encodeURIComponent(imageUrl)}`
          },
          {
            name: 'cors-anywhere',
            url: `https://cors-anywhere.herokuapp.com/${imageUrl}`
          }
        ]
        
        // 프록시를 순차적으로 시도
        let proxyIndex = 0
        
        const tryNextProxy = () => {
          if (proxyIndex >= proxyServices.length) {
            // 모든 프록시 실패 시, 이미지 URL을 포함한 오류 메시지 반환
            console.warn('모든 프록시 실패, 이미지 URL 제공:', imageUrl)
            const error = new Error(
              '이미지를 자동으로 다운로드할 수 없습니다 (CORS 문제).\n\n' +
              '이미지 URL: ' + imageUrl + '\n\n' +
              '해결 방법:\n' +
              '1. 위 URL을 복사하여 새 탭에서 열기\n' +
              '2. 이미지를 우클릭하여 "이미지로 저장"\n' +
              '3. 저장한 이미지를 다시 업로드\n\n' +
              '또는 CORS 비활성화 브라우저 확장 프로그램을 사용하세요.'
            )
            // 이미지 URL을 error 객체에 저장
            error.imageUrl = imageUrl
            reject(error)
            return
          }
          
          const proxy = proxyServices[proxyIndex]
          console.log(`프록시 시도 ${proxyIndex + 1}/${proxyServices.length}: ${proxy.name}`)
          
          fetch(proxy.url, {
            method: 'GET',
            headers: {
              'X-Requested-With': 'XMLHttpRequest'
            }
          })
            .then(response => {
              if (!response.ok) {
                throw new Error(`프록시 요청 실패: ${response.status}`)
              }
              return response.blob()
            })
            .then(blob => {
              if (!blob || blob.size === 0) {
                throw new Error('빈 응답을 받았습니다.')
              }
              
              const reader = new FileReader()
              reader.onloadend = () => {
                console.log(`${proxy.name} 프록시를 통한 Base64 변환 완료`)
                resolve(reader.result)
              }
              reader.onerror = () => {
                console.error(`${proxy.name} 프록시: 이미지 변환 실패`)
                proxyIndex++
                tryNextProxy()
              }
              reader.readAsDataURL(blob)
            })
            .catch(proxyError => {
              console.warn(`${proxy.name} 프록시 실패:`, proxyError.message)
              proxyIndex++
              tryNextProxy()
            })
        }
        
        // 첫 번째 프록시 시도
        tryNextProxy()
      }
      
      // 이미지 로드 시작
      img.src = imageUrl
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
