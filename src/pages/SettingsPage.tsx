/**
 * 설정 페이지: 게임 제목, 캐릭터명, 이미지 에셋(AssetManager), 변수 정의
 */

import { AssetManager } from '../components/AssetManager'
import type { GameSettings, VariableDef } from '../types/game'
import { Plus, Trash2 } from 'lucide-react'

interface SettingsPageProps {
  settings: GameSettings
  variables: VariableDef[]
  onSettingsChange: (s: GameSettings) => void
  onVariablesChange: (v: VariableDef[]) => void
}

export function SettingsPage({
  settings,
  variables,
  onSettingsChange,
  onVariablesChange,
}: SettingsPageProps) {
  const addVariable = () => {
    const name = `var_${Date.now()}`
    onVariablesChange([
      ...variables,
      { name, displayName: '새 변수', initialValue: 0 },
    ])
  }

  const updateVariable = (index: number, patch: Partial<VariableDef>) => {
    onVariablesChange(
      variables.map((v, i) => (i === index ? { ...v, ...patch } : v))
    )
  }

  const removeVariable = (index: number) => {
    onVariablesChange(variables.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-8 rounded-xl border border-gray-200 bg-white p-6 shadow-lg">
      <h2 className="text-xl font-bold text-gray-800">게임 설정</h2>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="text-sm font-medium text-gray-600">게임 제목</label>
          <input
            type="text"
            value={settings.title}
            onChange={(e) => onSettingsChange({ ...settings, title: e.target.value })}
            placeholder="예: 심청이 이야기"
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-gray-600">캐릭터 이름</label>
          <input
            type="text"
            value={settings.characterName}
            onChange={(e) => onSettingsChange({ ...settings, characterName: e.target.value })}
            placeholder="예: 심청"
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
          />
        </div>
      </div>

      <div>
        <h3 className="mb-3 text-sm font-semibold text-gray-700">캐릭터 표정 이미지 (에셋)</h3>
        <AssetManager
          assets={settings.imageAssets}
          onChange={(imageAssets) => onSettingsChange({ ...settings, imageAssets })}
        />
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-700">변수 / 플래그 (HUD 표시)</h3>
          <button
            type="button"
            onClick={addVariable}
            className="flex items-center gap-1 rounded bg-violet-600 px-3 py-1 text-sm text-white hover:bg-violet-700"
          >
            <Plus size={16} /> 추가
          </button>
        </div>
        <div className="space-y-2">
          {variables.map((v, i) => (
            <div key={v.name} className="flex items-center gap-2 rounded border border-gray-200 p-2">
              <input
                type="text"
                value={v.name}
                onChange={(e) => updateVariable(i, { name: e.target.value })}
                placeholder="변수명 (영문)"
                className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm"
              />
              <input
                type="text"
                value={v.displayName}
                onChange={(e) => updateVariable(i, { displayName: e.target.value })}
                placeholder="표시 이름"
                className="w-24 rounded border border-gray-300 px-2 py-1 text-sm"
              />
              <input
                type="number"
                value={v.initialValue}
                onChange={(e) => updateVariable(i, { initialValue: Number(e.target.value) })}
                className="w-16 rounded border border-gray-300 px-2 py-1 text-sm"
              />
              <button
                type="button"
                onClick={() => removeVariable(i)}
                className="rounded p-1 text-red-600 hover:bg-red-50"
              >
                <Trash2 size={18} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
