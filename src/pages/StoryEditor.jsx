import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import useGameStore from '../stores/gameStore'
import { generateStorySlides, generateNextSlide } from '../services/openai'
import { saveGameData } from '../services/googleScript'
import { QRCodeSVG } from 'qrcode.react'
import { saveToLocalStorage, loadFromLocalStorage, getLastSavedTime, saveGameHistory, getGameHistory } from '../utils/localStorage'
import { generateShareUrlWithData, generateShareUrlWithSheet, downloadGameData, loadGameDataFromFile } from '../utils/dataExport'
import { saveGameToFirestore, isFirestoreAvailable, loadGameFromFirestore } from '../services/firestore'
import { compressAndConvertToBase64, resizeTo1920x1080 } from '../utils/imageUtils'

function StoryEditor() {
  const navigate = useNavigate()
  const {
    sheetUrl,
    gameTitle,
    protagonistName,
    characterImages,
    variables,
    slides,
    setSlides,
    addSlide,
    updateSlide,
    removeSlide,
    setCurrentSlideIndex,
    currentSlideIndex,
    exportGameData,
    loadGameData: loadGameToStore
  } = useGameStore()

  const [storyText, setStoryText] = useState('')
  const [generating, setGenerating] = useState(false)
  const [generatingBranch, setGeneratingBranch] = useState(null) // 특정 선택지 분기 생성 중 여부
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [showShareModal, setShowShareModal] = useState(false)
  const [showHistoryModal, setShowHistoryModal] = useState(false) // 저장된 스토리 목록 모달
  const [gameHistory, setGameHistory] = useState([])
  const [shareUrl, setShareUrl] = useState('')
  const [lastSaved, setLastSaved] = useState(null)
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(true)
  const saveTimeoutRef = useRef(null)
  const [uploadingImage, setUploadingImage] = useState(false)
  const fileInputRef = useRef(null)
  const [firestoreGameId, setFirestoreGameId] = useState(null)

  const handleNewStory = () => {
    if (!window.confirm('새로운 스토리를 만들까요? (현재 편집 내용은 저장하지 않으면 사라질 수 있어요)')) return
    useGameStore.getState().reset()
    setFirestoreGameId(null)
    setShareUrl('')
    setError('')
    navigate('/')
  }

  // ... (공유 링크 자동 생성 useEffect 유지) ...
  // 공유 링크 자동 생성 (게임 데이터가 변경될 때마다)
  useEffect(() => {
    if (slides.length === 0) {
      setShareUrl('')
      return
    }

    try {
      const gameData = exportGameData()
      const baseUrl = window.location.origin

      // 1순위: Firestore ID가 있으면 사용
      if (firestoreGameId && isFirestoreAvailable()) {
        setShareUrl(`${baseUrl}/play?id=${firestoreGameId}`)
        return
      }

      // 2순위: 데이터 크기 체크하여 URL에 포함 시도
      const jsonString = JSON.stringify(gameData)
      const estimatedSize = Math.ceil(jsonString.length * 1.37)

      if (estimatedSize < 1000 && !sheetUrl) {
        try {
          const url = generateShareUrlWithData(gameData, baseUrl)
          setShareUrl(url)
        } catch (err) {
          setShareUrl('')
        }
      } else if (sheetUrl) {
        setShareUrl(generateShareUrlWithSheet(sheetUrl, baseUrl))
      } else {
        setShareUrl('')
      }
    } catch (err) {
      if (sheetUrl) {
        const baseUrl = window.location.origin
        setShareUrl(generateShareUrlWithSheet(sheetUrl, baseUrl))
      } else {
        setShareUrl('')
      }
    }
  }, [slides, gameTitle, protagonistName, characterImages, variables, sheetUrl, firestoreGameId, exportGameData])

  const currentSlide = slides[currentSlideIndex] || null

  // 페이지 로드 시 로컬스토리지에서 데이터 불러오기
  useEffect(() => {
    const savedData = loadFromLocalStorage()
    if (savedData) {
      const shouldLoad = window.confirm(
        `이전에 작업 중이던 게임 데이터를 찾았습니다.\n저장 시간: ${savedData.savedAt ? new Date(savedData.savedAt).toLocaleString('ko-KR') : '알 수 없음'}\n불러오시겠습니까?`
      )
      if (shouldLoad) {
        useGameStore.getState().loadGameData(savedData)
        setLastSaved(savedData.savedAt ? new Date(savedData.savedAt) : null)
        if (savedData.firestoreGameId) {
          setFirestoreGameId(savedData.firestoreGameId)
        }
      }
    }
  }, [])

  // 게임 데이터 변경 시 자동 저장 (디바운싱)
  useEffect(() => {
    if (!autoSaveEnabled || slides.length === 0) return

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    saveTimeoutRef.current = setTimeout(() => {
      const gameData = exportGameData()
      if (gameData && Object.keys(gameData).length > 0) {
        saveToLocalStorage({
          ...gameData,
          sheetUrl: useGameStore.getState().sheetUrl,
          firestoreGameId
        })

        // 히스토리에도 자동 저장 (옵션)
        saveGameHistory({
          ...gameData,
          firestoreGameId
        })

        setLastSaved(new Date())
      }
    }, 2000)

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [slides, gameTitle, protagonistName, characterImages, variables, autoSaveEnabled, exportGameData, firestoreGameId])

  // AI 스토리 생성 (전체)
  const handleGenerateStory = async () => {
    if (!storyText.trim()) {
      setError('스토리 텍스트를 입력해주세요.')
      return
    }

    if (characterImages.length === 0) {
      setError('캐릭터 이미지가 없습니다. 설정으로 돌아가 이미지를 업로드해주세요.')
      return
    }

    setGenerating(true)
    setError('')

    try {
      const imageLabels = characterImages.map(img => img.label)
      const generatedSlides = await generateStorySlides(
        storyText,
        imageLabels,
        variables
      )

      if (!generatedSlides || generatedSlides.length === 0) {
        throw new Error('생성된 슬라이드가 없습니다.')
      }

      setSlides(generatedSlides)
      setCurrentSlideIndex(0)
      setError('')

      // 생성 직후 저장
      handleSave(true) // true = silent save
    } catch (err) {
      console.error('스토리 생성 오류:', err)
      setError('스토리 생성 중 오류가 발생했습니다: ' + err.message)
    } finally {
      setGenerating(false)
    }
  }

  // AI 선택지 분기 생성 (다음 슬라이드 생성)
  const handleGenerateNextSlide = async (choiceId) => {
    const slide = slides[currentSlideIndex]
    const choice = slide.choices.find(c => c.id === choiceId)

    if (!slide || !choice) return

    setGeneratingBranch(choiceId)
    setError('')

    try {
      const imageLabels = characterImages.map(img => img.label)

      // AI로 다음 장면 생성
      const nextSlideData = await generateNextSlide(
        slide,
        choice,
        variables,
        imageLabels
      )

      // 새 슬라이드 ID 생성
      const newSlideId = `slide_${Date.now()}`
      const newSlide = {
        ...nextSlideData,
        id: newSlideId,
        choices: (nextSlideData.choices || []).map((c, idx) => ({
          ...c,
          id: `choice_${Date.now()}_${idx}`,
          nextSlideId: null
        }))
      }

      // 1. 새 슬라이드 추가
      addSlide(newSlide)

      // 2. 현재 선택지와 새 슬라이드 연결
      handleUpdateChoice(slide.id, choice.id, { nextSlideId: newSlideId })

      alert('다음 장면이 생성되었습니다! 슬라이드 목록을 확인하세요.')

    } catch (err) {
      console.error('분기 생성 오류:', err)
      alert('다음 장면 생성 실패: ' + err.message)
    } finally {
      setGeneratingBranch(null)
    }
  }

  // 게임 저장
  const handleSave = async (silent = false) => {
    if (!sheetUrl && !silent) {
      setError('시트 URL이 설정되지 않았습니다. 로컬 저장은 계속됩니다.')
    }

    if (slides.length === 0) {
      if (!silent) setError('저장할 슬라이드가 없습니다.')
      return
    }

    if (!silent) setSaving(true)
    setError('')

    try {
      const gameData = exportGameData()

      // 1. 로컬스토리지 저장
      saveToLocalStorage({
        ...gameData,
        sheetUrl: useGameStore.getState().sheetUrl,
        firestoreGameId
      })

      // 2. 히스토리 저장
      saveGameHistory({
        ...gameData,
        firestoreGameId
      })

      setLastSaved(new Date())

      const baseUrl = window.location.origin
      let savedGameId = firestoreGameId

      // 3. Firestore 저장 (옵션)
      if (isFirestoreAvailable()) {
        try {
          savedGameId = await saveGameToFirestore(gameData, firestoreGameId)
          setFirestoreGameId(savedGameId)
          setShareUrl(`${baseUrl}/play?id=${savedGameId}`)

          if (!silent) {
            alert('게임이 저장되었습니다!\n모든 변경사항이 안전하게 보관됩니다.')
          }
          return
        } catch (firestoreError) {
          console.warn('Firestore 저장 실패:', firestoreError.message)
        }
      }

      // Firestore 실패 시 기존 로직 유지...
      if (!silent) {
        alert('로컬에 저장되었습니다.')
      }

    } catch (err) {
      if (!silent) setError('저장 중 오류가 발생했습니다: ' + err.message)
    } finally {
      if (!silent) setSaving(false)
    }
  }

  // 저장된 스토리 불러오기
  const handleLoadHistory = () => {
    const history = getGameHistory()
    setGameHistory(history)
    setShowHistoryModal(true)
  }

  const loadGameFromHistory = async (gameInfo) => {
    if (!confirm('현재 작업 중인 내용은 사라질 수 있습니다. 불러오시겠습니까?')) return

    try {
      // 1. Firestore ID가 있으면 서버에서 최신 데이터 로드 시도
      if (gameInfo.firestoreId && isFirestoreAvailable()) {
        try {
          const remoteData = await loadGameFromFirestore(gameInfo.firestoreId)
          if (remoteData) {
            loadGameToStore(remoteData)
            setFirestoreGameId(gameInfo.firestoreId)
            setShowHistoryModal(false)
            setCurrentSlideIndex(0)
            alert('스토리를 불러왔습니다.')
            return
          }
        } catch (e) {
          console.warn('원격 로드 실패, 로컬 데이터 시도', e)
        }
      }

      // 2. 로컬 데이터 로드 (현재 로컬스토리지 키와 일치할 경우)
      // 주의: 현재 구조상 로컬스토리지는 1개만 저장됨 ('interactive_story_game_data')
      // 따라서 히스토리 목록은 사실상 "메타데이터 목록"이고, 실제 데이터는 
      // Firestore에 있거나, 아니면 "현재 로컬스토리지"가 유일한 데이터임.
      // 이 부분은 추후 로컬스토리지도 ID별로 분리 저장하도록 개선이 필요함.
      // 현재는 "최근 작업"만 로컬에 복원 가능.

      // 임시 방편: Firestore 로드가 실패하면 알림
      if (gameInfo.firestoreId) {
        alert('서버에서 데이터를 불러오지 못했습니다.')
      } else {
        // 로컬 전용 데이터는 현재 로컬스토리지(덮어쓰여졌을 수 있음)에 의존
        // 실제로는 히스토리에 전체 데이터를 저장하지 않으므로 한계가 있음.
        // 우선은 Firestore 위주로 안내.
        alert('이 게임은 로컬 전용이며, 현재 브라우저 저장소에서 덮어쓰여졌을 수 있습니다.')
      }

    } catch (err) {
      alert('불러오기 실패: ' + err.message)
    }
  }

  // 홈으로 이동 (초기화)
  const handleHome = () => {
    if (confirm('홈으로 돌아가면 현재 작업 중인 내용이 초기화될 수 있습니다. 저장하셨나요?')) {
      navigate('/')
    }
  }

  // ... (선택지 핸들러들은 그대로 유지하되 아래 return 부분에서 UI 변경) ...
  // 선택지 추가
  const handleAddChoice = (slideId) => {
    const slide = slides.find(s => s.id === slideId)
    if (!slide) return

    const newChoice = {
      id: `choice_${Date.now()}`,
      text: '',
      variableChanges: {},
      nextSlideId: slides.length > 0 ? slides[0].id : null
    }

    updateSlide(slideId, {
      choices: [...(slide.choices || []), newChoice]
    })
  }

  // 선택지 업데이트
  const handleUpdateChoice = (slideId, choiceId, updates) => {
    const slide = slides.find(s => s.id === slideId)
    if (!slide) return

    const updatedChoices = slide.choices.map(choice =>
      choice.id === choiceId ? { ...choice, ...updates } : choice
    )

    updateSlide(slideId, { choices: updatedChoices })
  }

  // 선택지 삭제
  const handleRemoveChoice = (slideId, choiceId) => {
    const slide = slides.find(s => s.id === slideId)
    if (!slide) return

    const updatedChoices = slide.choices.filter(choice => choice.id !== choiceId)
    updateSlide(slideId, { choices: updatedChoices })
  }

  // 변수 변화 설정
  const handleVariableChange = (slideId, choiceId, varName, change) => {
    const slide = slides.find(s => s.id === slideId)
    if (!slide) return

    const choice = slide.choices.find(c => c.id === choiceId)
    if (!choice) return

    const variableChanges = { ...choice.variableChanges }
    if (change === 0 || change === '') {
      delete variableChanges[varName]
    } else {
      variableChanges[varName] = parseInt(change) || 0
    }

    handleUpdateChoice(slideId, choiceId, { variableChanges })
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* 헤더 */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={handleHome}
              className="p-2 text-gray-600 hover:bg-gray-100 rounded-full"
              title="홈으로 (초기화)"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                {gameTitle || '게임 제목'}
              </h1>
              <div className="flex items-center gap-4 mt-1">
                <p className="text-sm text-gray-600">주인공: {protagonistName}</p>
                {lastSaved && (
                  <div className="flex items-center gap-2 text-xs text-green-600">
                    <span>✓ 저장됨: {lastSaved.toLocaleTimeString('ko-KR')}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleLoadHistory}
              className="px-4 py-2 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 flex items-center gap-2"
            >
              <span>📚 내 스토리</span>
            </button>
            <button
              onClick={handleNewStory}
              className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100"
              title="새로운 스토리 만들기"
            >
              + 새 스토리
            </button>
            <button
              onClick={() => setShowShareModal(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              공유
            </button>
            <button
              onClick={() => handleSave(false)}
              disabled={saving}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              {saving ? '저장 중...' : '저장'}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {error && (
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        )}

        {/* AI 스토리 생성 섹션 (슬라이드가 없을 때만 크게 표시) */}
        {slides.length === 0 && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">AI로 스토리 시작하기</h2>
            <div className="space-y-4">
              <textarea
                value={storyText}
                onChange={(e) => setStoryText(e.target.value)}
                placeholder="만들고 싶은 이야기의 줄거리를 입력하세요..."
                rows="6"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              />
              <button
                onClick={handleGenerateStory}
                disabled={generating}
                className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
              >
                {generating ? '생성 중...' : 'AI로 스토리 생성하기'}
              </button>
            </div>
          </div>
        )}

        {/* 에디터 영역 */}
        {slides.length > 0 ? (
          <div className="flex gap-6">
            {/* ... (슬라이드 목록 리스트 코드는 기존 유지) ... */}
            <div className="w-64 bg-white rounded-lg shadow p-4">
              <h3 className="font-semibold mb-4">슬라이드 목록</h3>
              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {slides.map((slide, index) => {
                  const slideImage = characterImages.find(
                    img => img.label === slide.imageLabel
                  )
                  return (
                    <div
                      key={slide.id}
                      onClick={() => setCurrentSlideIndex(index)}
                      className={`p-3 rounded-lg cursor-pointer border-2 transition ${index === currentSlideIndex
                          ? 'border-indigo-600 bg-indigo-50'
                          : 'border-gray-200 hover:border-gray-300'
                        }`}
                    >
                      {/* 슬라이드 이미지 미리보기 */}
                      {slideImage && (
                        <img
                          src={slideImage.base64}
                          alt={slideImage.label}
                          className="w-full h-20 object-cover rounded mb-2"
                        />
                      )}
                      <div className="text-sm font-medium">슬라이드 {index + 1}</div>
                      <div className="text-xs text-gray-500 truncate mt-1">
                        {slide.text.substring(0, 30)}...
                      </div>
                      <div className="text-xs text-indigo-600 mt-1">
                        {slide.imageLabel}
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          removeSlide(slide.id)
                          if (currentSlideIndex >= slides.length - 1) {
                            setCurrentSlideIndex(Math.max(0, slides.length - 2))
                          }
                        }}
                        className="mt-2 text-xs text-red-600 hover:text-red-800"
                      >
                        삭제
                      </button>
                    </div>
                  )
                })}
              </div>
              <button
                onClick={() => addSlide({ text: '', choices: [] })}
                className="mt-4 w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
              >
                + 슬라이드 추가
              </button>
            </div>

            {/* 현재 슬라이드 편집 */}
            {currentSlide && (
              <div className="flex-1 bg-white rounded-lg shadow p-6">
                <h3 className="text-xl font-semibold mb-4">
                  슬라이드 {currentSlideIndex + 1} 편집
                </h3>

                <div className="space-y-4">
                  {/* 대사/지문 편집 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      대사/지문
                    </label>
                    <textarea
                      value={currentSlide.text || ''}
                      onChange={(e) =>
                        updateSlide(currentSlide.id, { text: e.target.value })
                      }
                      rows="4"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  {/* 이미지 선택 및 미리보기 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      캐릭터 이미지
                    </label>

                    {/* 현재 선택된 이미지 미리보기 */}
                    {(() => {
                      const currentImage = characterImages.find(
                        img => img.label === currentSlide.imageLabel
                      )
                      return currentImage ? (
                        <div className="mb-4 p-4 bg-gray-50 rounded-lg border-2 border-indigo-200">
                          <div className="flex items-center gap-4">
                            <img
                              src={currentImage.base64}
                              alt={currentImage.label}
                              className="w-32 h-32 object-cover rounded-lg shadow-md"
                            />
                            <div className="flex-1">
                              <p className="font-medium text-gray-700 mb-1">
                                현재 이미지: {currentImage.label}
                              </p>
                            </div>
                          </div>
                        </div>
                      ) : null
                    })()}

                    <div className="flex gap-2">
                      <select
                        value={currentSlide.imageLabel || ''}
                        onChange={(e) =>
                          updateSlide(currentSlide.id, { imageLabel: e.target.value })
                        }
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      >
                        {characterImages.map((img) => (
                          <option key={img.id} value={img.label}>
                            {img.label}
                          </option>
                        ))}
                      </select>

                      {/* 이미지 업로드 버튼 (기존 로직 유지) */}
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        style={{ display: 'none' }}
                        onChange={async (e) => {
                          const file = e.target.files?.[0]
                          if (!file) return

                          setUploadingImage(true)
                          try {
                            const resizedImage = await resizeTo1920x1080(file)
                            const newImageLabel = `${currentSlide.imageLabel || '새 이미지'} (업로드)`
                            useGameStore.getState().addCharacterImage({
                              label: newImageLabel,
                              base64: resizedImage,
                              name: file.name
                            })
                            updateSlide(currentSlide.id, { imageLabel: newImageLabel })
                          } catch (err) {
                            alert('이미지 업로드 실패: ' + err.message)
                          } finally {
                            setUploadingImage(false)
                            if (fileInputRef.current) fileInputRef.current.value = ''
                          }
                        }}
                      />
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploadingImage}
                        className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 whitespace-nowrap"
                      >
                        📷 이미지 업로드
                      </button>
                    </div>
                  </div>

                  {/* 선택지 편집 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      선택지
                    </label>
                    <div className="space-y-4">
                      {currentSlide.choices?.map((choice) => (
                        <div
                          key={choice.id}
                          className="p-4 border border-gray-200 rounded-lg bg-gray-50"
                        >
                          <div className="flex gap-2 mb-3">
                            <input
                              type="text"
                              value={choice.text || ''}
                              onChange={(e) =>
                                handleUpdateChoice(currentSlide.id, choice.id, {
                                  text: e.target.value
                                })
                              }
                              placeholder="선택지 텍스트"
                              className="flex-1 px-3 py-2 border border-gray-300 rounded"
                            />
                            <select
                              value={choice.nextSlideId || ''}
                              onChange={(e) =>
                                handleUpdateChoice(currentSlide.id, choice.id, {
                                  nextSlideId: e.target.value
                                })
                              }
                              className="px-3 py-2 border border-gray-300 rounded w-40"
                            >
                              <option value="">다음 슬라이드...</option>
                              {slides.map((s) => (
                                <option key={s.id} value={s.id}>
                                  슬라이드 {slides.indexOf(s) + 1}
                                </option>
                              ))}
                            </select>
                            <button
                              onClick={() =>
                                handleRemoveChoice(currentSlide.id, choice.id)
                              }
                              className="px-3 py-2 bg-red-100 text-red-700 rounded hover:bg-red-200"
                            >
                              삭제
                            </button>
                          </div>

                          {/* AI 분기 생성 버튼 */}
                          {!choice.nextSlideId && (
                            <div className="mb-3">
                              <button
                                onClick={() => handleGenerateNextSlide(choice.id)}
                                disabled={generatingBranch === choice.id}
                                className="text-sm px-3 py-1.5 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 flex items-center gap-2"
                              >
                                {generatingBranch === choice.id ? (
                                  <><span>✨</span> 생성 중...</>
                                ) : (
                                  <><span>✨</span> 이 선택지로 이어지는 다음 장면 AI 생성</>
                                )}
                              </button>
                            </div>
                          )}

                          {/* 변수 변화 설정 */}
                          <div className="text-sm text-gray-600 bg-white p-2 rounded border border-gray-200">
                            <div className="font-medium mb-2">변수 변화:</div>
                            <div className="grid grid-cols-2 gap-2">
                              {variables.map((variable) => (
                                <div key={variable.name} className="flex items-center gap-2">
                                  <span className="w-20 truncate" title={variable.name}>{variable.name}:</span>
                                  <input
                                    type="number"
                                    value={
                                      choice.variableChanges?.[variable.name] || ''
                                    }
                                    onChange={(e) =>
                                      handleVariableChange(
                                        currentSlide.id,
                                        choice.id,
                                        variable.name,
                                        e.target.value
                                      )
                                    }
                                    placeholder="0"
                                    className="flex-1 px-2 py-1 border border-gray-300 rounded"
                                  />
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      ))}
                      <button
                        onClick={() => handleAddChoice(currentSlide.id)}
                        className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                      >
                        + 선택지 추가
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : null}
      </div>

      {/* 히스토리 모달 */}
      <AnimatePresence>
        {showHistoryModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
            onClick={() => setShowHistoryModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold">내 스토리 목록</h3>
                <button onClick={() => setShowHistoryModal(false)} className="text-gray-500 hover:text-gray-700">✕</button>
              </div>

              {gameHistory.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {gameHistory.map((game) => (
                    <div
                      key={game.id}
                      className="border rounded-lg p-4 hover:shadow-md transition cursor-pointer flex gap-4"
                      onClick={() => loadGameFromHistory(game)}
                    >
                      <div className="w-24 h-24 bg-gray-200 rounded-md flex-shrink-0 overflow-hidden">
                        {game.thumbnail ? (
                          <img src={game.thumbnail} alt="thumbnail" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-400">No Image</div>
                        )}
                      </div>
                      <div className="flex-1">
                        <h4 className="font-bold text-lg mb-1">{game.title}</h4>
                        <p className="text-sm text-gray-500 mb-2">
                          {new Date(game.updatedAt).toLocaleDateString()} {new Date(game.updatedAt).toLocaleTimeString()}
                        </p>
                        <span className={`text-xs px-2 py-1 rounded ${game.firestoreId ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                          {game.firestoreId ? '서버 저장됨' : '로컬 저장'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-gray-500 py-10">저장된 스토리가 없습니다.</p>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 공유 모달 */}
      <AnimatePresence>
        {showShareModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
            onClick={() => setShowShareModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-lg p-6 max-w-md w-full mx-4"
            >
              <h3 className="text-xl font-semibold mb-4">게임 공유</h3>
              {slides.length > 0 ? (
                <div className="space-y-4">
                  {/* 공유 링크 */}
                  {shareUrl && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        공유 링크 (학생들에게 이 링크를 공유하세요)
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={shareUrl}
                          readOnly
                          className="flex-1 px-3 py-2 border border-gray-300 rounded text-xs"
                        />
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(shareUrl)
                            alert('링크가 복사되었습니다!')
                          }}
                          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 whitespace-nowrap"
                        >
                          복사
                        </button>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        {shareUrl.includes('?data=')
                          ? '이 링크에는 게임 데이터가 포함되어 있어 Google Script 없이도 작동합니다.'
                          : '이 링크는 Google 시트에서 데이터를 불러옵니다. 시트가 공유되어 있어야 합니다.'}
                      </p>
                    </div>
                  )}

                  {/* QR 코드 */}
                  {shareUrl && shareUrl.length < 1000 && (
                    <div className="flex justify-center border-t pt-4">
                      <QRCodeSVG value={shareUrl} size={200} />
                    </div>
                  )}
                  {shareUrl && shareUrl.length >= 1000 && (
                    <div className="border-t pt-4 text-center">
                      <p className="text-sm text-gray-500 mb-2">
                        링크가 너무 길어서 QR 코드를 생성할 수 없습니다.
                      </p>
                      <p className="text-xs text-gray-400">
                        링크를 직접 복사하여 공유하거나, 파일 다운로드를 사용하세요.
                      </p>
                    </div>
                  )}

                  {/* 파일 다운로드 */}
                  <div className="border-t pt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      파일로 공유하기
                    </label>
                    <div className="space-y-2">
                      <button
                        onClick={() => {
                          try {
                            const gameData = exportGameData()
                            const filename = `${gameTitle || 'game'}-${Date.now()}.json`
                            downloadGameData(gameData, filename)
                            alert('게임 데이터 파일이 다운로드되었습니다!')
                          } catch (err) {
                            alert('파일 다운로드 중 오류가 발생했습니다: ' + err.message)
                          }
                        }}
                        className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                      >
                        게임 데이터 다운로드 (.json)
                      </button>
                      <p className="text-xs text-gray-500">
                        파일을 다운로드하여 다른 방식으로 공유할 수 있습니다.
                      </p>
                    </div>
                  </div>

                  {/* 파일 업로드 */}
                  <div className="border-t pt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      게임 데이터 불러오기
                    </label>
                    <input
                      type="file"
                      accept=".json"
                      onChange={async (e) => {
                        const file = e.target.files?.[0]
                        if (!file) return

                        try {
                          const gameData = await loadGameDataFromFile(file)
                          useGameStore.getState().loadGameData(gameData)
                          alert('게임 데이터를 성공적으로 불러왔습니다!')
                          setShowShareModal(false)
                        } catch (err) {
                          alert('파일 불러오기 중 오류가 발생했습니다: ' + err.message)
                        }
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                    />
                  </div>

                  {/* 공유 링크가 없는 경우 안내 */}
                  {!shareUrl && (
                    <div className="border-t pt-4">
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                        <p className="text-sm text-yellow-800 font-medium mb-2">
                          ⚠️ 공유 링크를 생성할 수 없습니다
                        </p>
                        <p className="text-xs text-yellow-700 mb-3">
                          게임 데이터가 너무 커서 URL에 포함할 수 없습니다.
                          파일 다운로드 방식을 사용하여 학생들에게 공유하세요.
                        </p>
                        <p className="text-xs text-yellow-600">
                          또는 Google 시트 URL을 설정하면 시트 기반 공유 링크를 생성할 수 있습니다.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-gray-500">
                  먼저 게임을 저장해야 공유 링크를 생성할 수 있습니다.
                </p>
              )}
              <button
                onClick={() => setShowShareModal(false)}
                className="mt-4 w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
              >
                닫기
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default StoryEditor
