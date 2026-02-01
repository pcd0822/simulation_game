import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import useGameStore from '../stores/gameStore'
import { generateStorySlides } from '../services/openai'
import { saveGameData } from '../services/googleScript'
import { QRCodeSVG } from 'qrcode.react'
import { saveToLocalStorage, loadFromLocalStorage, getLastSavedTime } from '../utils/localStorage'
import { generateShareUrlWithData, generateShareUrlWithSheet, downloadGameData, loadGameDataFromFile } from '../utils/dataExport'
import { compressAndConvertToBase64, resizeTo1920x1080 } from '../utils/imageUtils'

function StoryEditor() {
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
    exportGameData
  } = useGameStore()

  const [storyText, setStoryText] = useState('')
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [showShareModal, setShowShareModal] = useState(false)
  const [shareUrl, setShareUrl] = useState('')
  const [lastSaved, setLastSaved] = useState(null)
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(true)
  const saveTimeoutRef = useRef(null)
  const [uploadingImage, setUploadingImage] = useState(false)
  const fileInputRef = useRef(null)

  // 공유 링크 자동 생성 (게임 데이터가 변경될 때마다)
  useEffect(() => {
    if (slides.length === 0) {
      setShareUrl('')
      return
    }

    try {
      const gameData = exportGameData()
      const baseUrl = window.location.origin
      
      // 데이터 크기 체크
      const jsonString = JSON.stringify(gameData)
      const estimatedSize = Math.ceil(jsonString.length * 1.37)
      
      // 데이터가 작으면 URL에 포함, 크면 시트 URL 사용
      if (estimatedSize < 1000 && !sheetUrl) {
        // 데이터가 작고 시트 URL이 없으면 URL에 포함 시도
        try {
          const url = generateShareUrlWithData(gameData, baseUrl)
          setShareUrl(url)
        } catch (err) {
          // 실패하면 공유 링크 없음
          setShareUrl('')
        }
      } else if (sheetUrl) {
        // 시트 URL이 있으면 시트 URL 방식 사용
        setShareUrl(generateShareUrlWithSheet(sheetUrl, baseUrl))
      } else {
        // 데이터가 크고 시트 URL도 없으면 공유 링크 생성 불가
        setShareUrl('')
      }
    } catch (err) {
      console.warn('공유 링크 생성 오류:', err)
      // 시트 URL이 있으면 시트 URL 방식으로 대체
      if (sheetUrl) {
        const baseUrl = window.location.origin
        setShareUrl(generateShareUrlWithSheet(sheetUrl, baseUrl))
      } else {
        setShareUrl('')
      }
    }
  }, [slides, gameTitle, protagonistName, characterImages, variables, sheetUrl, exportGameData])

  const currentSlide = slides[currentSlideIndex] || null

  // 페이지 로드 시 로컬스토리지에서 데이터 불러오기
  useEffect(() => {
    const savedData = loadFromLocalStorage()
    if (savedData) {
      const shouldLoad = window.confirm(
        `이전에 저장된 게임 데이터를 찾았습니다.\n저장 시간: ${savedData.savedAt ? new Date(savedData.savedAt).toLocaleString('ko-KR') : '알 수 없음'}\n불러오시겠습니까?`
      )
      if (shouldLoad) {
        useGameStore.getState().loadGameData(savedData)
        setLastSaved(savedData.savedAt ? new Date(savedData.savedAt) : null)
      }
    }
  }, [])

  // 게임 데이터 변경 시 자동 저장 (디바운싱)
  useEffect(() => {
    if (!autoSaveEnabled || slides.length === 0) return

    // 이전 타이머 취소
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    // 2초 후 자동 저장
    saveTimeoutRef.current = setTimeout(() => {
      const gameData = exportGameData()
      if (gameData && Object.keys(gameData).length > 0) {
        saveToLocalStorage({
          ...gameData,
          sheetUrl: useGameStore.getState().sheetUrl
        })
        setLastSaved(new Date())
      }
    }, 2000)

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [slides, gameTitle, protagonistName, characterImages, variables, autoSaveEnabled, exportGameData])

  // AI 스토리 생성
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
      console.log('스토리 생성 시작:', { 
        storyLength: storyText.length, 
        imageLabels, 
        variables 
      })
      
      const generatedSlides = await generateStorySlides(
        storyText,
        imageLabels,
        variables
      )

      console.log('생성된 슬라이드:', generatedSlides)
      
      if (!generatedSlides || generatedSlides.length === 0) {
        throw new Error('생성된 슬라이드가 없습니다.')
      }

      setSlides(generatedSlides)
      setCurrentSlideIndex(0)
      setError('')
    } catch (err) {
      console.error('스토리 생성 오류:', err)
      setError('스토리 생성 중 오류가 발생했습니다: ' + err.message)
    } finally {
      setGenerating(false)
    }
  }

  // 게임 저장 (Google Script)
  const handleSave = async () => {
    if (!sheetUrl) {
      setError('시트 URL이 설정되지 않았습니다. 로컬 저장은 계속됩니다.')
    }

    if (slides.length === 0) {
      setError('저장할 슬라이드가 없습니다.')
      return
    }

    setSaving(true)
    setError('')

    try {
      const gameData = exportGameData()
      
      // 먼저 로컬스토리지에 저장 (항상 성공)
      saveToLocalStorage({
        ...gameData,
        sheetUrl: useGameStore.getState().sheetUrl
      })
      setLastSaved(new Date())
      
      const baseUrl = window.location.origin
      
      // 공유 URL 생성 (데이터 포함 방식 시도)
      try {
        const urlWithData = generateShareUrlWithData(gameData, baseUrl)
        setShareUrl(urlWithData)
      } catch (dataError) {
        console.warn('URL에 데이터 포함 실패 (데이터가 너무 큼):', dataError)
        // 데이터가 너무 크면 시트 URL 방식으로 대체
        if (sheetUrl) {
          setShareUrl(generateShareUrlWithSheet(sheetUrl, baseUrl))
        } else {
          // 시트 URL도 없으면 공유 링크 생성 불가
          setShareUrl('')
          console.warn('데이터가 너무 커서 URL에 포함할 수 없고, 시트 URL도 없습니다. 파일 다운로드를 사용하세요.')
        }
      }
      
      // Google Script 저장 시도 (실패해도 로컬 저장은 완료)
      if (sheetUrl) {
        try {
          await saveGameData(sheetUrl, gameData)
          alert('게임이 성공적으로 저장되었습니다!\n✓ 로컬 저장 완료\n✓ Google 시트 저장 완료\n✓ 공유 링크 생성 완료')
        } catch (googleError) {
          console.warn('Google Script 저장 실패, 로컬 저장은 완료됨:', googleError)
          
          // 에러 메시지를 더 친화적으로 표시
          const errorMsg = googleError.message.includes('CORS') || googleError.message.includes('연결')
            ? 'Google 시트 저장에 실패했습니다 (CORS 문제).\n\n' +
              '하지만 로컬 저장은 완료되었으며, 공유 링크는 정상적으로 작동합니다.\n' +
              '학생들은 공유 링크를 통해 게임을 플레이할 수 있습니다.'
            : 'Google 시트 저장에 실패했습니다.\n오류: ' + googleError.message
          
          alert('✓ 로컬 저장 완료\n✓ 공유 링크 생성 완료\n\n' + errorMsg)
        }
      } else {
        alert('✓ 로컬 저장 완료\n✓ 공유 링크 생성 완료\n\n공유 링크를 통해 학생들이 게임을 플레이할 수 있습니다!')
      }
    } catch (err) {
      setError('저장 중 오류가 발생했습니다: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

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
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-800">{gameTitle || '게임 제목'}</h1>
            <div className="flex items-center gap-4 mt-1">
              <p className="text-sm text-gray-600">주인공: {protagonistName}</p>
              {lastSaved && (
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                  <span>자동 저장됨: {lastSaved.toLocaleTimeString('ko-KR')}</span>
                </div>
              )}
              <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoSaveEnabled}
                  onChange={(e) => setAutoSaveEnabled(e.target.checked)}
                  className="w-4 h-4"
                />
                <span>자동 저장</span>
              </label>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowShareModal(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              공유 링크
            </button>
            <button
              onClick={handleSave}
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

        {/* AI 스토리 생성 섹션 */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">AI 스토리 생성기</h2>
          <div className="space-y-4">
            <textarea
              value={storyText}
              onChange={(e) => setStoryText(e.target.value)}
              placeholder="전체 스토리를 줄글로 입력하세요. AI가 자동으로 장면으로 나누고 선택지를 생성합니다."
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

        {/* 에디터 영역 */}
        {slides.length > 0 ? (
          <div className="flex gap-6">
            {/* 슬라이드 썸네일 리스트 */}
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
                      className={`p-3 rounded-lg cursor-pointer border-2 transition ${
                        index === currentSlideIndex
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
                        {slide.imageLabel || '이미지 없음'}
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
                              <p className="text-sm text-gray-500">
                                이 이미지가 게임에서 표시됩니다.
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
                      
                      {/* 이미지 업로드 버튼 */}
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        style={{ display: 'none' }}
                        onChange={async (e) => {
                          const file = e.target.files?.[0]
                          if (!file) return
                          
                          setUploadingImage(true)
                          setError('')
                          
                          try {
                            // 이미지를 1920x1080 해상도로 리사이징
                            const resizedImage = await resizeTo1920x1080(file)
                            
                            // 새 이미지로 추가
                            const newImageLabel = `${currentSlide.imageLabel || '새 이미지'} (업로드)`
                            useGameStore.getState().addCharacterImage({
                              label: newImageLabel,
                              base64: resizedImage,
                              name: file.name
                            })
                            
                            // 슬라이드에 새 이미지 적용
                            updateSlide(currentSlide.id, { imageLabel: newImageLabel })
                            
                            alert('이미지가 성공적으로 업로드되었습니다!')
                            setError('')
                          } catch (err) {
                            console.error('이미지 업로드 오류:', err)
                            setError('이미지 업로드 실패: ' + (err.message || '알 수 없는 오류'))
                            alert('이미지 업로드에 실패했습니다: ' + (err.message || '알 수 없는 오류'))
                          } finally {
                            setUploadingImage(false)
                            // 파일 입력 초기화
                            if (fileInputRef.current) {
                              fileInputRef.current.value = ''
                            }
                          }
                        }}
                      />
                      <button
                        onClick={() => {
                          fileInputRef.current?.click()
                        }}
                        disabled={uploadingImage}
                        className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                        title="이 슬라이드에 사용할 이미지를 업로드합니다"
                      >
                        {uploadingImage ? '업로드 중...' : '📷 이미지 업로드'}
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      드롭다운에서 이미지를 선택하거나, 새로운 이미지를 업로드할 수 있습니다.
                    </p>
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
                          className="p-4 border border-gray-200 rounded-lg"
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
                              className="px-3 py-2 border border-gray-300 rounded"
                            >
                              <option value="">다음 슬라이드 선택</option>
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

                          {/* 변수 변화 설정 */}
                          <div className="text-sm text-gray-600">
                            <div className="font-medium mb-2">변수 변화:</div>
                            <div className="grid grid-cols-2 gap-2">
                              {variables.map((variable) => (
                                <div key={variable.name} className="flex items-center gap-2">
                                  <span className="w-20">{variable.name}:</span>
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
        ) : (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <p className="text-gray-500 text-lg">
              위에서 스토리를 입력하고 AI로 생성하거나, 수동으로 슬라이드를 추가하세요.
            </p>
          </div>
        )}
      </div>

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
                  {shareUrl ? (
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
                      {!shareUrl && (
                        <p className="text-xs text-red-500 mt-1">
                          데이터가 너무 커서 URL에 포함할 수 없습니다. 파일 다운로드를 사용하세요.
                        </p>
                      )}
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
