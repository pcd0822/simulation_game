/**
 * 이미지를 Base64로 변환하고 리사이징하는 유틸리티
 * 이미지 크기를 300px 내외로 조정
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
