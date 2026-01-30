/**
 * React Flow 기반 스토리 에디터: 노드 마인드맵, 대사/이미지/변수 수정
 */

import { useCallback, useMemo, useEffect } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type Connection,
  type NodeTypes,
  type NodeProps,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import type { StoryNode, ImageAsset, VariableDef } from '../types/game'

interface StoryEditorProps {
  nodes: StoryNode[]
  imageAssets: ImageAsset[]
  variables: VariableDef[]
  startNodeId: string
  onNodesChange: (nodes: StoryNode[]) => void
}

function storyToFlowNodes(nodes: StoryNode[], startNodeId: string): Node[] {
  const byId = new Map(nodes.map((n, i) => [n.id, n]))
  const visited = new Set<string>()
  const queue = [startNodeId]
  while (queue.length) {
    const id = queue.shift()!
    if (visited.has(id)) continue
    visited.add(id)
    const n = byId.get(id)
    if (!n) continue
    if (n.next) queue.push(n.next)
    if (n.choices) n.choices.forEach((c) => queue.push(c.next))
  }
  const list = Array.from(visited).map((id) => byId.get(id)!).filter(Boolean)
  return list.map((n, i) => ({
    id: n.id,
    type: 'storyNode',
    position: { x: (i % 4) * 220, y: Math.floor(i / 4) * 140 },
    data: { ...n },
  }))
}

function storyToFlowEdges(nodes: StoryNode[], startNodeId: string): Edge[] {
  const edges: Edge[] = []
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const walk = (id: string) => {
    const n = byId.get(id)
    if (!n) return
    if (n.next) edges.push({ id: `e-${n.id}-${n.next}`, source: n.id, target: n.next })
    if (n.choices) n.choices.forEach((c) => {
      edges.push({ id: `e-${n.id}-${c.next}`, source: n.id, target: c.next })
    })
  }
  const visited = new Set<string>()
  const queue = [startNodeId]
  while (queue.length) {
    const id = queue.shift()!
    if (visited.has(id)) continue
    visited.add(id)
    const n = byId.get(id)
    if (!n) continue
    if (n.next) { edges.push({ id: `e-${n.id}-${n.next}`, source: n.id, target: n.next }); queue.push(n.next) }
    if (n.choices) n.choices.forEach((c) => {
      edges.push({ id: `e-${n.id}-${c.next}`, source: n.id, target: c.next })
      queue.push(c.next)
    })
  }
  return edges
}

function StoryNodeComponent({ data, selected }: NodeProps<StoryNode>) {
  const node = data as StoryNode
  const preview = node.text?.slice(0, 30) ?? node.id
  return (
    <div
      className={`rounded-lg border-2 px-3 py-2 shadow-md ${
        selected ? 'border-violet-500 bg-violet-50' : 'border-gray-300 bg-white'
      }`}
    >
      <div className="text-xs font-mono text-gray-500">{node.id}</div>
      <div className="text-sm font-medium">{preview}{node.text?.length > 30 ? '…' : ''}</div>
      {node.emotionLabel && (
        <div className="mt-1 text-xs text-violet-600">표정: {node.emotionLabel}</div>
      )}
    </div>
  )
}

const nodeTypes: NodeTypes = { storyNode: StoryNodeComponent }

export function StoryEditor({
  nodes,
  imageAssets,
  variables,
  startNodeId,
  onNodesChange,
}: StoryEditorProps) {
  const initialFlowNodes = useMemo(
    () => storyToFlowNodes(nodes, startNodeId),
    [nodes, startNodeId]
  )
  const initialFlowEdges = useMemo(
    () => storyToFlowEdges(nodes, startNodeId),
    [nodes, startNodeId]
  )

  const [flowNodes, setFlowNodes] = useNodesState(initialFlowNodes)
  const [flowEdges, setFlowEdges] = useEdgesState(initialFlowEdges)

  useEffect(() => {
    setFlowNodes(storyToFlowNodes(nodes, startNodeId))
    setFlowEdges(storyToFlowEdges(nodes, startNodeId))
  }, [nodes, startNodeId, setFlowNodes, setFlowEdges])

  const onConnect = useCallback(
    (params: Connection) => setFlowEdges((eds) => addEdge(params, eds)),
    [setFlowEdges]
  )

  const selectedId = flowNodes.find((n) => n.selected)?.id ?? null
  const selectedStoryNode = nodes.find((n) => n.id === selectedId)

  const updateStoryNode = useCallback(
    (id: string, patch: Partial<StoryNode>) => {
      onNodesChange(
        nodes.map((n) => (n.id === id ? { ...n, ...patch } : n))
      )
    },
    [nodes, onNodesChange]
  )

  return (
    <div className="flex h-[500px] gap-4">
      <div className="h-full flex-1 rounded-lg border border-gray-200 bg-gray-50">
        <ReactFlow
          nodes={flowNodes}
          edges={flowEdges}
          onNodesChange={(changes) => {
            setFlowNodes((nds) => {
              const next = nds.map((n) => {
                const c = changes.find((ch) => ch.id === n.id)
                if (c?.type === 'position' && c.dragging === false && c.position) {
                  return { ...n, position: c.position }
                }
                return n
              })
              return next
            })
          }}
          onEdgesChange={() => {}}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          fitView
        >
          <Background />
          <Controls />
          <MiniMap />
        </ReactFlow>
      </div>

      {selectedStoryNode && (
        <div className="w-72 shrink-0 space-y-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <h3 className="font-semibold text-gray-800">노드 수정: {selectedStoryNode.id}</h3>
          <div>
            <label className="text-xs text-gray-500">대사/지문</label>
            <textarea
              value={selectedStoryNode.text}
              onChange={(e) => updateStoryNode(selectedStoryNode.id, { text: e.target.value })}
              rows={3}
              className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500">표정 이미지</label>
            <select
              value={selectedStoryNode.imageSrc ?? ''}
              onChange={(e) =>
                updateStoryNode(selectedStoryNode.id, {
                  imageSrc: e.target.value || undefined,
                  emotionLabel: imageAssets.find((a) => a.id === e.target.value)?.label,
                })
              }
              className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm"
            >
              <option value="">선택 안 함</option>
              {imageAssets.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label} ({a.id})
                </option>
              ))}
            </select>
          </div>
          {selectedStoryNode.variableChanges?.length ? (
            <div>
              <label className="text-xs text-gray-500">변수 변경</label>
              <pre className="mt-1 rounded bg-gray-100 p-2 text-xs">
                {JSON.stringify(selectedStoryNode.variableChanges, null, 2)}
              </pre>
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}
