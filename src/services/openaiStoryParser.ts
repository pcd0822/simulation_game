/**
 * OpenAI GPT-4o 스토리 파서 & 감정 → 이미지 라벨 매칭
 * System Prompt에 "Available Emotions" 리스트를 제공해 AI가 그 중에서만 표정을 선택하도록 함
 */

import type { StoryNode, ImageAsset } from '../types/game'

const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY as string | undefined

export function getAvailableEmotionLabels(assets: ImageAsset[]): string[] {
  return [...new Set(assets.map((a) => a.label.trim()).filter(Boolean))]
}

function buildSystemPrompt(emotionLabels: string[]): string {
  const list = emotionLabels.length ? emotionLabels.join(', ') : '기본, 웃음, 슬픔, 화남, 곤란, 놀람'
  return `당신은 비주얼 노벨 시나리오 작가입니다. 사용자가 입력한 줄글 스토리를 분석하여 JSON 노드 배열로 변환합니다.

규칙:
1. 각 장면(대사/지문)을 하나의 노드로 만듭니다.
2. 노드 형식: { "id": "node_1", "type": "dialogue", "text": "대사 또는 지문", "speaker": "화자(선택)", "emotionLabel": "표정라벨" }
3. 선택지가 있으면 type을 "choice"로 하고 choices 배열에 { "text": "선택문구", "next": "다음노드id" } 형태로 넣습니다.
4. **emotionLabel은 반드시 아래 목록 중 하나만 사용하세요.** (없으면 "기본" 권장)
   사용 가능한 표정 라벨: ${list}
5. id는 node_1, node_2, ... 순서로 부여하고, 다음 노드 참조는 next 필드에 해당 id를 넣습니다.
6. JSON만 출력하고 다른 설명은 붙이지 마세요. 배열 형태로 출력합니다.`
}

export interface ParseStoryOptions {
  storyText: string
  imageAssets: ImageAsset[]
}

export async function parseStoryWithGPT(options: ParseStoryOptions): Promise<StoryNode[]> {
  const { storyText, imageAssets } = options
  if (!OPENAI_API_KEY?.trim()) {
    throw new Error('VITE_OPENAI_API_KEY가 설정되지 않았습니다.')
  }

  const emotionLabels = getAvailableEmotionLabels(imageAssets)
  const systemPrompt = buildSystemPrompt(emotionLabels)

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: storyText },
      ],
      temperature: 0.5,
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message ?? `OpenAI API 오류: ${res.status}`)
  }

  const data = await res.json()
  const content = data.choices?.[0]?.message?.content?.trim()
  if (!content) throw new Error('AI 응답이 비어 있습니다.')

  const jsonMatch = content.match(/\[[\s\S]*\]/)
  const jsonStr = jsonMatch ? jsonMatch[0] : content
  const nodes: StoryNode[] = JSON.parse(jsonStr)

  // emotionLabel → imageSrc: 해당 라벨을 가진 ImageAsset의 id 매칭
  const labelToId = new Map<string, string>()
  for (const a of imageAssets) {
    if (a.label?.trim()) labelToId.set(a.label.trim(), a.id)
  }
  for (const node of nodes) {
    if (node.emotionLabel && labelToId.has(node.emotionLabel)) {
      node.imageSrc = labelToId.get(node.emotionLabel)
    }
  }

  return nodes
}
