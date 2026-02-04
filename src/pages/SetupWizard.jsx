import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import useGameStore from '../stores/gameStore'
import { compressAndConvertToBase64, processMultipleImages } from '../utils/imageUtils'
import { validateSheetUrl, normalizeSheetUrl, loadGameData } from '../services/googleScript'
import { loadFromLocalStorage, clearLocalStorage, getGameHistory } from '../utils/localStorage'

function SetupWizard() {
  const navigate = useNavigate()
  const {
    sheetUrl,
    gameTitle,
    protagonistName,
    synopsis,
    variables,
    characterImages,
    setSheetUrl,
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
  const [savedHistory, setSavedHistory] = useState([])

  // 홈 진입 시: 자동 불러오기 ❌ / 저장된 초안/히스토리만 표시 ✅
  useEffect(() => {
    setSavedDraft(loadFromLocalStorage())
    setSavedHistory(getGameHistory())
  }, [])

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
    alert('삭제되었습니다.')
  }

  // 시트 URL에서 데이터 불러오기
  const handleLoadFromSheet = async () => {
    if (!sheetUrl) {
      setError('시트 URL을 입력해주세요.')
      return
    }

    if (!validateSheetUrl(sheetUrl)) {
      setError('올바른 Google Sheets URL을 입력해주세요.')
      return
    }

    setLoading(true)
    setError('')

    try {
      const normalizedUrl = normalizeSheetUrl(sheetUrl)
      const data = await loadGameData(normalizedUrl)
      
      if (data) {
        loadDataToStore({ ...data, sheetUrl: normalizedUrl })
        setError('')
        alert('데이터를 성공적으로 불러왔습니다!')
        // 에디터로 이동
        navigate('/editor')
      } else {
        setError('시트에서 데이터를 찾을 수 없습니다. 새로 만들기로 진행하세요.')
      }
    } catch (err) {
      setError(err.message || '데이터 불러오기 실패')
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
      if (!sheetUrl || !validateSheetUrl(sheetUrl)) {
        setError('올바른 시트 URL을 입력해주세요.')
        return
      }
      setSheetUrl(normalizeSheetUrl(sheetUrl))
    } else if (step === 2) {
      if (!gameTitle || !protagonistName) {
        setError('게임 제목과 주인공 이름을 입력해주세요.')
        return
      }
    } else if (step === 3) {
      if (characterImages.length === 0) {
        setError('최소 1개 이상의 캐릭터 이미지를 업로드해주세요.')
        return
      }
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl shadow-xl p-8"
        >
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            교실용 인터랙티브 스토리 게임 메이커
          </h1>
          <p className="text-gray-600 mb-8">게임을 만들기 위한 초기 설정을 진행하세요</p>

          {/* 빠른 시작 */}
          <div className="mb-8 p-4 rounded-xl border bg-gray-50">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <div className="text-sm font-semibold text-gray-800">빠른 시작</div>
                <div className="text-xs text-gray-600 mt-1">
                  홈에서는 저장된 스토리를 자동으로 불러오지 않습니다. 아래에서 선택해 주세요.
                </div>
              </div>
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={handleStartNewStory}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                >
                  + 새로운 스토리 만들기
                </button>
                <button
                  onClick={handleLoadDraft}
                  disabled={!savedDraft}
                  className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 disabled:opacity-50"
                >
                  저장된 초안 불러오기
                </button>
                <button
                  onClick={handleDeleteDraft}
                  disabled={!savedDraft}
                  className="px-4 py-2 bg-red-50 border border-red-200 text-red-700 rounded-lg hover:bg-red-100 disabled:opacity-50"
                >
                  초안 삭제
                </button>
              </div>
            </div>

            {savedDraft && (
              <div className="mt-3 text-xs text-gray-600">
                <span className="font-medium">초안:</span>{' '}
                {savedDraft.gameTitle || '제목 없음'}{' '}
                {savedDraft.savedAt ? `· 저장: ${new Date(savedDraft.savedAt).toLocaleString('ko-KR')}` : ''}
              </div>
            )}
          </div>

          {/* 진행 단계 표시 */}
          <div className="flex items-center justify-between mb-8">
            {[1, 2, 3, 4].map((s) => (
              <div key={s} className="flex items-center flex-1">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                    step >= s
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-200 text-gray-600'
                  }`}
                >
                  {s}
                </div>
                {s < 4 && (
                  <div
                    className={`flex-1 h-1 mx-2 ${
                      step > s ? 'bg-indigo-600' : 'bg-gray-200'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
              {error}
            </div>
          )}

          {/* 단계 1: 시트 연동 */}
          {step === 1 && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
            >
              <h2 className="text-2xl font-semibold mb-4">1. Google 시트 연동</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Google 시트 공유 링크 (편집 권한 포함)
                  </label>
                  <input
                    type="text"
                    value={sheetUrl}
                    onChange={(e) => setSheetUrl(e.target.value)}
                    placeholder="https://docs.google.com/spreadsheets/d/..."
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                  <p className="mt-2 text-sm text-gray-500">
                    시트를 공유 설정에서 "링크가 있는 모든 사용자"가 편집할 수 있도록 설정해주세요.
                  </p>
                </div>
                <button
                  onClick={handleLoadFromSheet}
                  disabled={loading}
                  className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50"
                >
                  {loading ? '불러오는 중...' : '기존 데이터 불러오기'}
                </button>
              </div>
            </motion.div>
          )}

          {/* 단계 2: 메타 데이터 */}
          {step === 2 && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
            >
              <h2 className="text-2xl font-semibold mb-4">2. 게임 기본 정보</h2>
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

          {/* 단계 3: 이미지 업로드 */}
          {step === 3 && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
            >
              <h2 className="text-2xl font-semibold mb-4">3. 캐릭터 이미지 업로드</h2>
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

          {/* 단계 4: 변수 설정 */}
          {step === 4 && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
            >
              <h2 className="text-2xl font-semibold mb-4">4. 게임 변수 설정</h2>
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
          <div className="flex justify-between mt-8">
            <button
              onClick={() => setStep(Math.max(1, step - 1))}
              disabled={step === 1}
              className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              이전
            </button>
            {step < 4 ? (
              <button
                onClick={handleNext}
                className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
              >
                다음
              </button>
            ) : (
              <button
                onClick={handleComplete}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                완료 및 에디터로 이동
              </button>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  )
}

export default SetupWizard
