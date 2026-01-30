/**
 * Classroom Sim-Game Maker - 메인 앱
 * 설정 / 스토리 입력 / 에디터 / 플레이 / 저장·불러오기
 */

import { useState, useCallback } from 'react'
import {
  Settings,
  FileText,
  Map,
  Play,
  Save,
  FolderOpen,
  Home,
} from 'lucide-react'
import { SettingsPage } from './pages/SettingsPage'
import { StoryInputPage } from './pages/StoryInputPage'
import { EditorPage } from './pages/EditorPage'
import { GamePlayer } from './components/GamePlayer'
import { loadGame, saveGame } from './utils/GoogleSheetAPI'
import type { GameData, GameSettings, StoryNode, VariableDef } from './types/game'

type Page = 'home' | 'settings' | 'story' | 'editor'

const defaultGameData: GameData = {
  settings: {
    title: '새 게임',
    characterName: '주인공',
    imageAssets: [],
  },
  variables: [],
  nodes: [],
  startNodeId: 'node_1',
}

function App() {
  const [gameData, setGameData] = useState<GameData>(defaultGameData)
  const [saveLoadStatus, setSaveLoadStatus] = useState<string | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [page, setPage] = useState<Page>('home')

  const updateSettings = useCallback((settings: GameSettings) => {
    setGameData((d) => ({ ...d, settings }))
  }, [])

  const updateVariables = useCallback((variables: VariableDef[]) => {
    setGameData((d) => ({ ...d, variables }))
  }, [])

  const updateNodes = useCallback((nodes: StoryNode[]) => {
    setGameData((d) => ({ ...d, nodes }))
  }, [])

  const handleParsed = useCallback((nodes: StoryNode[], startNodeId: string) => {
    setGameData((d) => ({ ...d, nodes, startNodeId }))
    setSaveLoadStatus('스토리가 생성되었습니다. 에디터에서 수정하거나 저장하세요.')
  }, [])

  const handleSave = useCallback(async () => {
    setSaveLoadStatus(null)
    try {
      await saveGame(gameData)
      setSaveLoadStatus('저장되었습니다.')
    } catch (e) {
      setSaveLoadStatus('저장 실패: ' + (e instanceof Error ? e.message : String(e)))
    }
  }, [gameData])

  const handleLoad = useCallback(async () => {
    setSaveLoadStatus(null)
    try {
      const data = await loadGame()
      if (data) setGameData(data)
      setSaveLoadStatus(data ? '불러왔습니다.' : '저장된 데이터가 없습니다.')
    } catch (e) {
      setSaveLoadStatus('불러오기 실패: ' + (e instanceof Error ? e.message : String(e)))
    }
  }, [])

  return (
    <>
      {isPlaying ? (
        <GamePlayer data={gameData} onClose={() => setIsPlaying(false)} />
      ) : (
        <div className="min-h-screen bg-gradient-to-br from-slate-100 to-violet-100">
          <header className="border-b border-violet-200/50 bg-white/80 backdrop-blur">
            <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
              <h1 className="text-lg font-bold text-violet-800">Classroom Sim-Game Maker</h1>
              <nav className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setPage('home')}
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-gray-600 hover:bg-violet-100 hover:text-violet-800"
                >
                  <Home size={18} /> 홈
                </button>
                <button
                  type="button"
                  onClick={() => setPage('settings')}
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-gray-600 hover:bg-violet-100 hover:text-violet-800"
                >
                  <Settings size={18} /> 설정
                </button>
                <button
                  type="button"
                  onClick={() => setPage('story')}
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-gray-600 hover:bg-violet-100 hover:text-violet-800"
                >
                  <FileText size={18} /> 스토리
                </button>
                <button
                  type="button"
                  onClick={() => setPage('editor')}
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-gray-600 hover:bg-violet-100 hover:text-violet-800"
                >
                  <Map size={18} /> 에디터
                </button>
                <button
                  type="button"
                  onClick={() => setIsPlaying(true)}
                  className="flex items-center gap-2 rounded-lg bg-violet-600 px-3 py-2 text-sm font-medium text-white hover:bg-violet-700"
                >
                  <Play size={18} /> 플레이
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  className="flex items-center gap-2 rounded-lg border border-violet-300 px-3 py-2 text-sm font-medium text-violet-700 hover:bg-violet-50"
                >
                  <Save size={18} /> 저장
                </button>
                <button
                  type="button"
                  onClick={handleLoad}
                  className="flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
                >
                  <FolderOpen size={18} /> 불러오기
                </button>
              </nav>
            </div>
            {saveLoadStatus && (
              <div className="mx-auto max-w-5xl px-4 pb-2 text-sm text-gray-600">
                {saveLoadStatus}
              </div>
            )}
          </header>

          <main className="mx-auto max-w-5xl px-4 py-8">
            {page === 'home' && (
              <div className="rounded-xl border border-gray-200 bg-white p-8 text-center shadow-lg">
                <h2 className="text-2xl font-bold text-gray-800">{gameData.settings.title}</h2>
                <p className="mt-2 text-gray-600">
                  설정에서 이미지 에셋을 등록한 뒤, 스토리를 입력하고 AI로 변환하세요.
                </p>
                <div className="mt-6 flex justify-center gap-4">
                  <button
                    type="button"
                    onClick={() => setPage('settings')}
                    className="rounded-lg bg-violet-600 px-6 py-2 text-white hover:bg-violet-700"
                  >
                    설정으로
                  </button>
                  <button
                    type="button"
                    onClick={() => setPage('story')}
                    className="rounded-lg border border-violet-400 px-6 py-2 text-violet-700 hover:bg-violet-50"
                  >
                    스토리 입력
                  </button>
                </div>
              </div>
            )}
            {page === 'settings' && (
              <SettingsPage
                settings={gameData.settings}
                variables={gameData.variables}
                onSettingsChange={updateSettings}
                onVariablesChange={updateVariables}
              />
            )}
            {page === 'story' && (
              <StoryInputPage
                imageAssets={gameData.settings.imageAssets}
                onParsed={handleParsed}
              />
            )}
            {page === 'editor' && (
              <EditorPage
                nodes={gameData.nodes}
                imageAssets={gameData.settings.imageAssets}
                variables={gameData.variables}
                startNodeId={gameData.startNodeId}
                onNodesChange={updateNodes}
              />
            )}
          </main>
        </div>
      )}
    </>
  )
}

export default App
