/**
 * 이미지 에셋 관리: 업로드, Base64 썸네일 압축(~200px), 라벨 매핑
 */

import { useCallback } from 'react'
import { ImagePlus, Trash2 } from 'lucide-react'
import { fileToThumbnailBase64 } from '../utils/imageCompress'
import type { ImageAsset } from '../types/game'

interface AssetManagerProps {
  assets: ImageAsset[]
  onChange: (assets: ImageAsset[]) => void
}

function generateId(): string {
  return `img_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export function AssetManager({ assets, onChange }: AssetManagerProps) {
  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files
      if (!files?.length) return
      const newAssets: ImageAsset[] = []
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        if (!file.type.startsWith('image/')) continue
        try {
          const data = await fileToThumbnailBase64(file)
          newAssets.push({
            id: generateId(),
            data,
            label: file.name.replace(/\.[^.]+$/, '') || '기본',
          })
        } catch (err) {
          console.error('이미지 처리 실패:', file.name, err)
        }
      }
      if (newAssets.length) onChange([...assets, ...newAssets])
      e.target.value = ''
    },
    [assets, onChange]
  )

  const updateLabel = useCallback(
    (id: string, label: string) => {
      onChange(
        assets.map((a) => (a.id === id ? { ...a, label } : a))
      )
    },
    [assets, onChange]
  )

  const remove = useCallback(
    (id: string) => {
      onChange(assets.filter((a) => a.id !== id))
    },
    [assets, onChange]
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-violet-400 bg-violet-50 px-4 py-2 text-sm font-medium text-violet-800 hover:bg-violet-100">
          <ImagePlus size={18} />
          이미지 업로드 (표정 세트)
          <input
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleFileSelect}
          />
        </label>
        <span className="text-xs text-gray-500">가로 200px 썸네일로 자동 압축됩니다.</span>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {assets.map((a) => (
          <div
            key={a.id}
            className="flex flex-col rounded-lg border border-gray-200 bg-white p-2 shadow-sm"
          >
            <div className="relative aspect-[3/4] overflow-hidden rounded bg-gray-100">
              <img
                src={a.data}
                alt={a.label}
                className="h-full w-full object-cover"
              />
              <button
                type="button"
                onClick={() => remove(a.id)}
                className="absolute right-1 top-1 rounded bg-red-500/80 p-1 text-white hover:bg-red-600"
                aria-label="삭제"
              >
                <Trash2 size={14} />
              </button>
            </div>
            <input
              type="text"
              value={a.label}
              onChange={(e) => updateLabel(a.id, e.target.value)}
              placeholder="라벨 (예: 웃음, 슬픔)"
              className="mt-2 rounded border border-gray-300 px-2 py-1 text-sm"
            />
          </div>
        ))}
      </div>
    </div>
  )
}
