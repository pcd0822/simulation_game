/**
 * 인게임 플레이어: 대화창, 캐릭터 스탠딩(AI 지정 표정), 배경, 선택지, HUD(변수)
 */

import { useState, useCallback, useMemo } from 'react'
import type { GameData, StoryNode, VariableDef } from '../types/game'

interface GamePlayerProps {
  data: GameData
  onClose?: () => void
}

function getNodeById(nodes: StoryNode[], id: string): StoryNode | undefined {
  return nodes.find((n) => n.id === id)
}

function getImageDataById(assets: { id: string; data: string }[], id: string | undefined): string | undefined {
  if (!id) return undefined
  return assets.find((a) => a.id === id)?.data
}

export function GamePlayer({ data, onClose }: GamePlayerProps) {
  const { settings, variables: variableDefs, nodes, startNodeId } = data
  const [currentId, setCurrentId] = useState(startNodeId)
  const [variableValues, setVariableValues] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {}
    for (const v of variableDefs) init[v.name] = v.initialValue
    return init
  })

  const currentNode = useMemo(
    () => getNodeById(nodes, currentId),
    [nodes, currentId]
  )
  const backgroundImage = useMemo(
    () => settings.backgroundImage ?? undefined,
    [settings.backgroundImage]
  )
  const standingImage = useMemo(
    () => getImageDataById(settings.imageAssets, currentNode?.imageSrc),
    [settings.imageAssets, currentNode?.imageSrc]
  )

  const applyVariableChanges = useCallback(
    (changes: { name: string; delta: number }[] | undefined) => {
      if (!changes?.length) return
      setVariableValues((prev) => {
        const next = { ...prev }
        for (const c of changes) {
          next[c.name] = (next[c.name] ?? 0) + c.delta
        }
        return next
      })
    },
    []
  )

  const goNext = useCallback(
    (nextId: string, variableChanges?: { name: string; delta: number }[]) => {
      applyVariableChanges(variableChanges)
      setCurrentId(nextId)
    },
    [applyVariableChanges]
  )

  if (!currentNode) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gray-900 text-white">
        <p>시작 노드를 찾을 수 없습니다.</p>
        {onClose && (
          <button
            onClick={onClose}
            className="mt-4 rounded bg-violet-600 px-4 py-2 hover:bg-violet-700"
          >
            닫기
          </button>
        )}
      </div>
    )
  }

  const isChoice = currentNode.type === 'choice' && currentNode.choices?.length

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-gray-900">
      {/* 배경 */}
      {backgroundImage && (
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-80"
          style={{ backgroundImage: `url(${backgroundImage})` }}
        />
      )}
      <div className="absolute inset-0 bg-black/30" />

      {/* HUD: 변수 */}
      {variableDefs.length > 0 && (
        <div className="absolute left-4 top-4 z-10 flex gap-4 rounded-lg bg-black/50 px-4 py-2 text-white">
          {variableDefs.map((v) => (
            <span key={v.name}>
              {v.displayName}: {variableValues[v.name] ?? v.initialValue}
            </span>
          ))}
        </div>
      )}

      {/* 닫기 버튼 */}
      {onClose && (
        <button
          onClick={onClose}
          className="absolute right-4 top-4 z-10 rounded bg-black/50 px-3 py-1 text-white hover:bg-black/70"
        >
          나가기
        </button>
      )}

      {/* 캐릭터 스탠딩 */}
      <div className="absolute bottom-32 left-1/2 flex h-[60vh] max-h-[400px] w-full max-w-md -translate-x-1/2 items-end justify-center">
        {standingImage && (
          <img
            src={standingImage}
            alt={currentNode.speaker ?? settings.characterName}
            className="max-h-full object-contain object-bottom"
          />
        )}
      </div>

      {/* 대화창 */}
      <div className="absolute bottom-0 left-0 right-0 border-t border-white/20 bg-black/70 px-6 py-4 text-white backdrop-blur">
        {currentNode.speaker && (
          <div className="mb-1 text-sm font-semibold text-violet-300">
            {currentNode.speaker}
          </div>
        )}
        <p className="min-h-[3em] text-lg leading-relaxed">{currentNode.text}</p>

        {isChoice ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {currentNode.choices!.map((c, i) => (
              <button
                key={i}
                onClick={() => goNext(c.next, c.variableChanges)}
                className="rounded-lg border border-violet-400 bg-violet-900/50 px-4 py-2 text-left text-sm hover:bg-violet-800/70"
              >
                {c.text}
              </button>
            ))}
          </div>
        ) : (
          <button
            onClick={() =>
              currentNode.next && goNext(currentNode.next, currentNode.variableChanges)
            }
            className="mt-3 rounded bg-violet-600 px-4 py-2 text-sm hover:bg-violet-700 disabled:opacity-50"
            disabled={!currentNode.next}
          >
            다음
          </button>
        )}
      </div>
    </div>
  )
}
