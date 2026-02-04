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
 * 이미지를 1920x1080 해상도로 리사이징 (고품질 유지)
 * 비율을 유지하면서 1920x1080에 맞게 크롭 또는 리사이징
 * 원본이 더 작으면 원본 크기 유지, 더 크면 다운스케일만 수행
 * @param {File} file - 이미지 파일
 * @param {number} quality - JPEG 품질 (0.0-1.0, 기본값: 0.95)
 * @returns {Promise<string>} Base64 인코딩된 이미지 문자열
 */
export async function resizeTo1920x1080(file, quality = 0.95) {
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
        
        // 원본이 타겟보다 작으면 원본 크기 유지 (업스케일 방지)
        const shouldUpscale = img.width >= targetWidth || img.height >= targetHeight
        
        // 캔버스 생성
        const canvas = document.createElement('canvas')
        let canvasWidth, canvasHeight
        
        if (shouldUpscale) {
          // 다운스케일만 수행 (원본이 더 큰 경우)
          canvasWidth = targetWidth
          canvasHeight = targetHeight
        } else {
          // 원본 크기 유지 (원본이 더 작은 경우)
          canvasWidth = img.width
          canvasHeight = img.height
        }
        
        canvas.width = canvasWidth
        canvas.height = canvasHeight
        
        const ctx = canvas.getContext('2d')
        
        // 이미지 스무딩 품질 향상
        ctx.imageSmoothingEnabled = true
        ctx.imageSmoothingQuality = 'high'
        
        let drawWidth, drawHeight, drawX, drawY
        
        if (shouldUpscale) {
          // 배경을 흰색으로 채우기
          ctx.fillStyle = '#FFFFFF'
          ctx.fillRect(0, 0, canvasWidth, canvasHeight)
          
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
        } else {
          // 원본 크기 그대로 사용
          drawWidth = img.width
          drawHeight = img.height
          drawX = 0
          drawY = 0
        }
        
        // 이미지 그리기 (비율 유지)
        ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight)
        
        // Base64로 변환 (JPEG 포맷, 고품질 설정)
        // PNG는 파일 크기가 크므로 JPEG 사용하되 품질을 최대한 높임
        const base64 = canvas.toDataURL('image/jpeg', quality)
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
 * 여러 이미지 파일을 일괄 처리 (고해상도 유지)
 * @param {File[]} files - 이미지 파일 배열
 * @param {boolean} useHighQuality - 고해상도 처리 여부 (기본값: true)
 * @returns {Promise<Array<{file: File, base64: string, name: string, size: number}>>}
 */
export async function processMultipleImages(files, useHighQuality = true) {
  const promises = Array.from(files).map(async (file) => {
    let base64
    if (useHighQuality) {
      // 고해상도 처리: 1920x1080으로 리사이징 (원본이 작으면 원본 크기 유지)
      base64 = await resizeTo1920x1080(file, 0.95)
    } else {
      // 기존 방식: 작은 크기로 압축 (썸네일용)
      base64 = await compressAndConvertToBase64(file, 300)
    }
    return {
      file,
      base64,
      name: file.name,
      size: file.size
    }
  })
  
  return Promise.all(promises)
}
