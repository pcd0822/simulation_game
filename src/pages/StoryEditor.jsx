import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import useGameStore from '../stores/gameStore'
import { generateStorySlides } from '../services/openai'
import { saveGameData } from '../services/googleScript'
import { QRCodeSVG } from 'qrcode.react'

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

  const currentSlide = slides[currentSlideIndex] || null

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

  // 게임 저장
  const handleSave = async () => {
    if (!sheetUrl) {
      setError('시트 URL이 설정되지 않았습니다.')
      return
    }

    if (slides.length === 0) {
      setError('저장할 슬라이드가 없습니다.')
      return
    }

    setSaving(true)
    setError('')

    try {
      const gameData = exportGameData()
      await saveGameData(sheetUrl, gameData)
      
      // 공유 URL 생성
      const encodedUrl = encodeURIComponent(sheetUrl)
      const baseUrl = window.location.origin
      const url = `${baseUrl}/play?sheet=${encodedUrl}`
      setShareUrl(url)
      
      alert('게임이 성공적으로 저장되었습니다!')
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
          <div>
            <h1 className="text-2xl font-bold text-gray-800">{gameTitle || '게임 제목'}</h1>
            <p className="text-sm text-gray-600">주인공: {protagonistName}</p>
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
                {slides.map((slide, index) => (
                  <div
                    key={slide.id}
                    onClick={() => setCurrentSlideIndex(index)}
                    className={`p-3 rounded-lg cursor-pointer border-2 transition ${
                      index === currentSlideIndex
                        ? 'border-indigo-600 bg-indigo-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="text-sm font-medium">슬라이드 {index + 1}</div>
                    <div className="text-xs text-gray-500 truncate mt-1">
                      {slide.text.substring(0, 30)}...
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
                ))}
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

                  {/* 이미지 선택 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      캐릭터 이미지
                    </label>
                    <select
                      value={currentSlide.imageLabel || ''}
                      onChange={(e) =>
                        updateSlide(currentSlide.id, { imageLabel: e.target.value })
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    >
                      {characterImages.map((img) => (
                        <option key={img.id} value={img.label}>
                          {img.label}
                        </option>
                      ))}
                    </select>
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
              {shareUrl ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      공유 링크
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={shareUrl}
                        readOnly
                        className="flex-1 px-3 py-2 border border-gray-300 rounded"
                      />
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(shareUrl)
                          alert('링크가 복사되었습니다!')
                        }}
                        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                      >
                        복사
                      </button>
                    </div>
                  </div>
                  <div className="flex justify-center">
                    <QRCodeSVG value={shareUrl} size={200} />
                  </div>
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
