/**
 * 이미지 Base64 변환 및 썸네일 압축 (~200px 가로)
 * Google Sheets 용량 한계 대응
 */

const THUMBNAIL_WIDTH = 200
const JPEG_QUALITY = 0.7

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

export function resizeImageToDataUrl(
  img: HTMLImageElement,
  maxWidth: number = THUMBNAIL_WIDTH,
  quality: number = JPEG_QUALITY
): string {
  const canvas = document.createElement('canvas')
  const scale = Math.min(maxWidth / img.width, 1)
  canvas.width = Math.round(img.width * scale)
  canvas.height = Math.round(img.height * scale)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D context not available')
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/jpeg', quality)
}

/**
 * File → Base64 썸네일(가로 ~200px) 변환
 */
export async function fileToThumbnailBase64(file: File): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
  const img = await loadImage(dataUrl)
  return resizeImageToDataUrl(img, THUMBNAIL_WIDTH, JPEG_QUALITY)
}
