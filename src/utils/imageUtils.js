/**
 * 이미지를 Base64로 변환하고 리사이징하는 유틸리티
 */

/**
 * 이미지 파일을 Base64 문자열로 변환하고 리사이징
 * @param {File} file - 이미지 파일
 * @param {number} maxWidth - 최대 너비 (기본값: 300)
 * @returns {Promise<string>} Base64 인코딩된 이미지 문자열
 */
export async function compressAndConvertToBase64(file, maxWidth = 300) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    
    reader.onload = (e) => {
      const img = new Image()
      
      img.onload = () => {
        // 캔버스 생성
        const canvas = document.createElement('canvas')
        let width = img.width
        let height = img.height
        
        // 비율 유지하며 리사이징
        if (width > maxWidth) {
          height = (height * maxWidth) / width
          width = maxWidth
        }
        
        canvas.width = width
        canvas.height = height
        
        // 이미지 그리기
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, width, height)
        
        // Base64로 변환 (JPEG 포맷, 품질 0.8)
        const base64 = canvas.toDataURL('image/jpeg', 0.8)
        resolve(base64)
      }
      
      img.onerror = () => {
        reject(new Error('이미지 로드 실패'))
      }
      
      img.src = e.target.result
    }
    
    reader.onerror = () => {
      reject(new Error('파일 읽기 실패'))
    }
    
    reader.readAsDataURL(file)
  })
}

/**
 * 이미지를 1920x1080 해상도로 리사이징
 * 비율을 유지하면서 1920x1080에 맞게 크롭 또는 리사이징
 * @param {File} file - 이미지 파일
 * @returns {Promise<string>} Base64 인코딩된 이미지 문자열 (1920x1080)
 */
export async function resizeTo1920x1080(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    
    reader.onload = (e) => {
      const img = new Image()
      
      img.onload = () => {
        const targetWidth = 1920
        const targetHeight = 1080
        const targetAspectRatio = targetWidth / targetHeight // 16:9
        
        // 원본 이미지의 비율 계산
        const sourceAspectRatio = img.width / img.height
        
        // 캔버스 생성
        const canvas = document.createElement('canvas')
        canvas.width = targetWidth
        canvas.height = targetHeight
        
        const ctx = canvas.getContext('2d')
        
        // 배경을 흰색으로 채우기 (선택사항)
        ctx.fillStyle = '#FFFFFF'
        ctx.fillRect(0, 0, targetWidth, targetHeight)
        
        let drawWidth, drawHeight, drawX, drawY
        
        if (sourceAspectRatio > targetAspectRatio) {
          // 원본이 더 넓은 경우: 높이를 1080에 맞추고 너비를 조정
          drawHeight = targetHeight
          drawWidth = targetHeight * sourceAspectRatio
          drawX = (targetWidth - drawWidth) / 2 // 중앙 정렬
          drawY = 0
        } else {
          // 원본이 더 높은 경우: 너비를 1920에 맞추고 높이를 조정
          drawWidth = targetWidth
          drawHeight = targetWidth / sourceAspectRatio
          drawX = 0
          drawY = (targetHeight - drawHeight) / 2 // 중앙 정렬
        }
        
        // 이미지 그리기 (비율 유지)
        ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight)
        
        // Base64로 변환 (JPEG 포맷, 품질 0.9 - 고해상도이므로 품질 높임)
        const base64 = canvas.toDataURL('image/jpeg', 0.9)
        resolve(base64)
      }
      
      img.onerror = () => {
        reject(new Error('이미지 로드 실패'))
      }
      
      img.src = e.target.result
    }
    
    reader.onerror = () => {
      reject(new Error('파일 읽기 실패'))
    }
    
    reader.readAsDataURL(file)
  })
}

/**
 * 여러 이미지 파일을 일괄 처리
 * @param {File[]} files - 이미지 파일 배열
 * @param {number} maxWidth - 최대 너비
 * @returns {Promise<Array<{file: File, base64: string}>>}
 */
export async function processMultipleImages(files, maxWidth = 300) {
  const promises = Array.from(files).map(async (file) => {
    const base64 = await compressAndConvertToBase64(file, maxWidth)
    return {
      file,
      base64,
      name: file.name,
      size: file.size
    }
  })
  
  return Promise.all(promises)
}
