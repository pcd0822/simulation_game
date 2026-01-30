/**
 * 에디터 페이지: React Flow 스토리 에디터
 */

import { StoryEditor } from '../components/StoryEditor'
import type { StoryNode, ImageAsset, VariableDef } from '../types/game'

interface EditorPageProps {
  nodes: StoryNode[]
  imageAssets: ImageAsset[]
  variables: VariableDef[]
  startNodeId: string
  onNodesChange: (nodes: StoryNode[]) => void
}

export function EditorPage({
  nodes,
  imageAssets,
  variables,
  startNodeId,
  onNodesChange,
}: EditorPageProps) {
  return (
    <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-6 shadow-lg">
      <h2 className="text-xl font-bold text-gray-800">스토리 에디터 (노드 수정)</h2>
      <p className="text-sm text-gray-600">
        노드를 클릭하면 대사 수정, 표정 이미지 변경, 변수 변경을 할 수 있습니다.
      </p>
      <StoryEditor
        nodes={nodes}
        imageAssets={imageAssets}
        variables={variables}
        startNodeId={startNodeId}
        onNodesChange={onNodesChange}
      />
    </div>
  )
}
