/**
 * 스토리 입력 페이지: 줄글 입력 → AI 파싱 → 노드 생성
 */

import { useState } from 'react'
import { Sparkles, Loader2 } from 'lucide-react'
import { parseStoryWithGPT } from '../services/openaiStoryParser'
import type { StoryNode, ImageAsset } from '../types/game'

interface StoryInputPageProps {
  imageAssets: ImageAsset[]
  onParsed: (nodes: StoryNode[], startNodeId: string) => void
}

export function StoryInputPage({ imageAssets, onParsed }: StoryInputPageProps) {
  const [storyText, setStoryText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleParse = async () => {
    if (!storyText.trim()) return
    setLoading(true)
    setError(null)
    try {
      const nodes = await parseStoryWithGPT({ storyText: storyText.trim(), imageAssets })
      const startId = nodes[0]?.id ?? 'node_1'
      onParsed(nodes, startId)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'AI 파싱 실패')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6 rounded-xl border border-gray-200 bg-white p-6 shadow-lg">
      <h2 className="text-xl font-bold text-gray-800">스토리 입력 (AI 변환)</h2>
      <p className="text-sm text-gray-600">
        줄글로 스토리를 입력하면 GPT-4o가 대사/지문 노드로 변환하고, 표정 라벨을 자동 매칭합니다.
      </p>
      <textarea
        value={storyText}
        onChange={(e) => setStoryText(e.target.value)}
        placeholder="예:&#10;심청이가 인당수에 빠지기 싫어 눈물을 흘린다.&#10;&quot;아버지, 저는 괜찮아요.&quot; 그녀는 웃으며 말했다."
        rows={12}
        className="w-full rounded-lg border border-gray-300 px-4 py-3 font-mono text-sm"
      />
      {error && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}
      <button
        type="button"
        onClick={handleParse}
        disabled={loading}
        className="flex items-center gap-2 rounded-lg bg-violet-600 px-6 py-3 font-medium text-white hover:bg-violet-700 disabled:opacity-50"
      >
        {loading ? <Loader2 size={20} className="animate-spin" /> : <Sparkles size={20} />}
        AI로 스토리 변환
      </button>
    </div>
  )
}
