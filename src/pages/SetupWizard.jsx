import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import useGameStore from '../stores/gameStore'
import { compressAndConvertToBase64, processMultipleImages } from '../utils/imageUtils'
import { loadFromLocalStorage, clearLocalStorage, getGameHistory } from '../utils/localStorage'
import { getGamesList, loadGameFromFirestore, isFirestoreAvailable } from '../services/firestore'

function SetupWizard() {
  const navigate = useNavigate()
  const {
    gameTitle,
    protagonistName,
    synopsis,
    variables,
    characterImages,
    setGameTitle,
    setProtagonistName,
    setSynopsis,
    addVariable,
    updateVariable,
    removeVariable,
    addCharacterImage,
    updateCharacterImage,
    removeCharacterImage,
    loadGameData: loadDataToStore
  } = useGameStore()

  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [newVariable, setNewVariable] = useState({ name: '', initial: 0 })
  const [imageFiles, setImageFiles] = useState([])
  const [processingImages, setProcessingImages] = useState(false)
  const [savedDraft, setSavedDraft] = useState(null)
  const [savedStories, setSavedStories] = useState([])
  const [loadingStories, setLoadingStories] = useState(false)

  // 홈 진입 시: 저장된 초안 및 스토리 목록 불러오기
  useEffect(() => {
    setSavedDraft(loadFromLocalStorage())
    loadSavedStories()
  }, [])

  // 저장된 스토리 목록 불러오기 (Firestore + 로컬스토리지)
  const loadSavedStories = async () => {
    setLoadingStories(true)
    try {
      const allStories = []
      
      // 로컬스토리지 히스토리
      const localHistory = getGameHistory()
      localHistory.forEach(game => {
        allStories.push({
          ...game,
          source: 'local'
        })
      })

      // Firestore 목록
      if (isFirestoreAvailable()) {
        try {
          const firestoreGames = await getGamesList(50)
          firestoreGames.forEach(game => {
            // 중복 제거 (firestoreId가 같으면 로컬 것을 덮어씀)
            const existingIndex = allStories.findIndex(s => 
              s.firestoreId === game.firestoreId
            )
            if (existingIndex >= 0) {
              allStories[existingIndex] = { ...allStories[existingIndex], ...game, source: 'firestore' }
            } else {
              allStories.push({ ...game, source: 'firestore' })
            }
          })
        } catch (err) {
          console.error('Firestore 목록 불러오기 실패:', err)
        }
      }

      // 최신순 정렬
      allStories.sort((a, b) => {
        const dateA = new Date(a.updatedAt || 0)
        const dateB = new Date(b.updatedAt || 0)
        return dateB - dateA
      })

      setSavedStories(allStories)
    } catch (err) {
      console.error('스토리 목록 불러오기 오류:', err)
    } finally {
      setLoadingStories(false)
    }
  }

  const handleStartNewStory = () => {
    // 새 스토리 시작: 상태 초기화 후 Setup Wizard에서 계속 진행
    useGameStore.getState().reset()
    setStep(1)
    setError('')
  }

  const handleLoadDraft = () => {
    const draft = loadFromLocalStorage()
    if (!draft) {
      alert('저장된 초안이 없습니다.')
      return
    }
    loadDataToStore(draft)
    navigate('/editor')
  }

  const handleDeleteDraft = () => {
    if (!window.confirm('저장된 초안을 삭제할까요?')) return
    clearLocalStorage()
    setSavedDraft(null)
    loadSavedStories() // 목록 새로고침
    alert('삭제되었습니다.')
  }

  // 저장된 스토리 불러오기
  const handleLoadStory = async (story) => {
    setLoading(true)
    setError('')

    try {
      let gameData = null

      // Firestore에서 불러오기
      if (story.firestoreId && isFirestoreAvailable()) {
        try {
          gameData = await loadGameFromFirestore(story.firestoreId)
        } catch (err) {
          console.error('Firestore 불러오기 실패:', err)
        }
      }

      // Firestore 실패 시 로컬스토리지에서 불러오기
      if (!gameData) {
        const localData = loadFromLocalStorage()
        if (localData && (localData.gameTitle === story.title || localData.firestoreGameId === story.firestoreId)) {
          gameData = localData
        }
      }

      if (gameData) {
        loadDataToStore(gameData)
        navigate('/editor')
      } else {
        setError('게임 데이터를 찾을 수 없습니다.')
      }
    } catch (err) {
      setError(err.message || '게임 불러오기 실패')
    } finally {
      setLoading(false)
    }
  }

  // 이미지 업로드 처리
  const handleImageUpload = async (e) => {
    const files = Array.from(e.target.files)
    if (files.length === 0) return

    setProcessingImages(true)
    setError('')

    try {
      const processed = await processMultipleImages(files)
      
      processed.forEach((item, index) => {
        addCharacterImage({
          label: `표정 ${index + 1}`,
          base64: item.base64,
          name: item.name
        })
      })
      
      setImageFiles([])
    } catch (err) {
      setError('이미지 처리 중 오류가 발생했습니다: ' + err.message)
    } finally {
      setProcessingImages(false)
    }
  }

  // 변수 추가
  const handleAddVariable = () => {
    if (!newVariable.name.trim()) {
      setError('변수 이름을 입력해주세요.')
      return
    }
    addVariable({ ...newVariable })
    setNewVariable({ name: '', initial: 0 })
    setError('')
  }

  // 다음 단계로
  const handleNext = () => {
    if (step === 1) {
      if (!gameTitle || !protagonistName) {
        setError('게임 제목과 주인공 이름을 입력해주세요.')
        return
      }
    } else if (step === 2) {
      if (characterImages.length === 0) {
        setError('최소 1개 이상의 캐릭터 이미지를 업로드해주세요.')
        return
      }
    } else if (step === 3) {
      // 변수 단계는 완료 버튼에서 최종 검증
    }
    
    setError('')
    setStep(step + 1)
  }

  // 완료 및 에디터로 이동
  const handleComplete = () => {
    if (variables.length === 0) {
      setError('최소 1개 이상의 변수를 추가해주세요.')
      return
    }
    navigate('/editor')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {/* 헤더 */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl shadow-xl p-8 mb-6"
        >
          <h1 className="text-4xl font-bold text-gray-800 mb-2">
            교실용 인터랙티브 스토리 게임 메이커
          </h1>
          <p className="text-gray-600 text-lg">게임을 만들기 위한 초기 설정을 진행하세요</p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 왼쪽: 빠른 시작 및 저장된 스토리 목록 */}
          <div className="lg:col-span-1 space-y-6">
            {/* 빠른 시작 */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-white rounded-2xl shadow-xl p-6"
            >
              <h2 className="text-xl font-bold text-gray-800 mb-4">빠른 시작</h2>
              <div className="space-y-3">
                <button
                  onClick={handleStartNewStory}
                  className="w-full px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-semibold text-base transition-colors"
                >
                  + 새로운 스토리 만들기
                </button>
                <button
                  onClick={handleLoadDraft}
                  disabled={!savedDraft}
                  className="w-full px-6 py-3 bg-white border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed font-semibold text-base transition-colors"
                >
                  저장된 초안 불러오기
                </button>
                <button
                  onClick={handleDeleteDraft}
                  disabled={!savedDraft}
                  className="w-full px-6 py-3 bg-red-50 border-2 border-red-200 text-red-700 rounded-lg hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed font-semibold text-base transition-colors"
                >
                  초안 삭제
                </button>
              </div>

              {savedDraft && (
                <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                  <div className="text-sm font-medium text-gray-800">현재 초안</div>
                  <div className="text-sm text-gray-600 mt-1">
                    {savedDraft.gameTitle || '제목 없음'}
                  </div>
                  {savedDraft.savedAt && (
                    <div className="text-xs text-gray-500 mt-1">
                      저장: {new Date(savedDraft.savedAt).toLocaleString('ko-KR')}
                    </div>
                  )}
                </div>
              )}
            </motion.div>

            {/* 저장된 스토리 목록 */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white rounded-2xl shadow-xl p-6"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-800">내 스토리</h2>
                <button
                  onClick={loadSavedStories}
                  disabled={loadingStories}
                  className="text-sm text-indigo-600 hover:text-indigo-700 disabled:opacity-50"
                >
                  {loadingStories ? '새로고침 중...' : '🔄 새로고침'}
                </button>
              </div>
              
              {loadingStories ? (
                <div className="text-center py-8 text-gray-500">불러오는 중...</div>
              ) : savedStories.length === 0 ? (
                <div className="text-center py-8 text-gray-500 text-sm">
                  저장된 스토리가 없습니다
                </div>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {savedStories.map((story) => (
                    <button
                      key={story.id || story.firestoreId}
                      onClick={() => handleLoadStory(story)}
                      disabled={loading}
                      className="w-full p-3 bg-gray-50 hover:bg-gray-100 rounded-lg text-left transition-colors disabled:opacity-50"
                    >
                      <div className="flex items-center gap-3">
                        {story.thumbnail && (
                          <img
                            src={story.thumbnail}
                            alt={story.title}
                            className="w-12 h-12 object-cover rounded"
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-gray-800 truncate">
                            {story.title}
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            {story.updatedAt
                              ? new Date(story.updatedAt).toLocaleString('ko-KR', {
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })
                              : '날짜 없음'}
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </motion.div>
          </div>

          {/* 오른쪽: 설정 워크플로우 */}
          <div className="lg:col-span-2">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-2xl shadow-xl p-8"
            >

              {/* 진행 단계 표시 */}
              <div className="flex items-center justify-between mb-10">
                {[1, 2, 3].map((s) => (
                  <div key={s} className="flex items-center flex-1">
                    <div
                      className={`w-16 h-16 rounded-full flex items-center justify-center font-bold text-xl transition-all ${
                        step >= s
                          ? 'bg-indigo-600 text-white shadow-lg scale-110'
                          : 'bg-gray-200 text-gray-600'
                      }`}
                    >
                      {s}
                    </div>
                    {s < 3 && (
                      <div
                        className={`flex-1 h-2 mx-4 rounded-full transition-all ${
                          step > s ? 'bg-indigo-600' : 'bg-gray-200'
                        }`}
                      />
                    )}
                  </div>
                ))}
              </div>

              {error && (
                <div className="mb-6 p-4 bg-red-100 border-2 border-red-400 text-red-700 rounded-lg">
                  {error}
                </div>
              )}

              {/* 단계 1: 메타 데이터 */}
              {step === 1 && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                >
                  <h2 className="text-3xl font-bold mb-6 text-gray-800">1. 게임 기본 정보</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    게임 제목
                  </label>
                  <input
                    type="text"
                    value={gameTitle}
                    onChange={(e) => setGameTitle(e.target.value)}
                    placeholder="예: 마법학교의 비밀"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    주인공 이름
                  </label>
                  <input
                    type="text"
                    value={protagonistName}
                    onChange={(e) => setProtagonistName(e.target.value)}
                    placeholder="예: 지민"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    시놉시스 (선택사항)
                  </label>
                  <textarea
                    value={synopsis}
                    onChange={(e) => setSynopsis(e.target.value)}
                    placeholder="게임의 줄거리를 간단히 설명해주세요..."
                    rows="4"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
            </motion.div>
          )}

              {/* 단계 2: 이미지 업로드 */}
              {step === 2 && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                >
                  <h2 className="text-3xl font-bold mb-6 text-gray-800">2. 캐릭터 이미지 업로드</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    캐릭터 표정 이미지 업로드 (5~10장 권장)
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleImageUpload}
                    disabled={processingImages}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  />
                  {processingImages && (
                    <p className="mt-2 text-sm text-blue-600">이미지 처리 중...</p>
                  )}
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-6">
                  {characterImages.map((img, index) => (
                    <div key={img.id} className="border rounded-lg p-2">
                      <img
                        src={img.base64}
                        alt={img.label}
                        className="w-full h-32 object-cover rounded mb-2"
                      />
                      <input
                        type="text"
                        value={img.label}
                        onChange={(e) =>
                          updateCharacterImage(img.id, { label: e.target.value })
                        }
                        placeholder="라벨 입력"
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                      />
                      <button
                        onClick={() => removeCharacterImage(img.id)}
                        className="mt-2 w-full px-2 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200"
                      >
                        삭제
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

              {/* 단계 3: 변수 설정 */}
              {step === 3 && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                >
                  <h2 className="text-3xl font-bold mb-6 text-gray-800">3. 게임 변수 설정</h2>
              <div className="space-y-4">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newVariable.name}
                    onChange={(e) =>
                      setNewVariable({ ...newVariable, name: e.target.value })
                    }
                    placeholder="변수 이름 (예: 호감도)"
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg"
                  />
                  <input
                    type="number"
                    value={newVariable.initial}
                    onChange={(e) =>
                      setNewVariable({
                        ...newVariable,
                        initial: parseInt(e.target.value) || 0
                      })
                    }
                    placeholder="초기값"
                    className="w-24 px-4 py-2 border border-gray-300 rounded-lg"
                  />
                  <button
                    onClick={handleAddVariable}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                  >
                    추가
                  </button>
                </div>

                <div className="mt-6 space-y-2">
                  {variables.map((variable, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <span className="font-medium">{variable.name}</span>
                      <span className="text-gray-600">초기값: {variable.initial}</span>
                      <button
                        onClick={() => removeVariable(index)}
                        className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200"
                      >
                        삭제
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

              {/* 네비게이션 버튼 */}
              <div className="flex justify-between mt-10 pt-6 border-t border-gray-200">
                <button
                  onClick={() => setStep(Math.max(1, step - 1))}
                  disabled={step === 1}
                  className="px-8 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed font-semibold text-base transition-colors"
                >
                  ← 이전
                </button>
                {step < 3 ? (
                  <button
                    onClick={handleNext}
                    className="px-8 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-semibold text-base transition-colors"
                  >
                    다음 →
                  </button>
                ) : (
                  <button
                    onClick={handleComplete}
                    className="px-8 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold text-base transition-colors"
                  >
                    완료 및 에디터로 이동 ✓
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SetupWizard
