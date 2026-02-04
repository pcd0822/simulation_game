import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import useGameStore from '../stores/gameStore'
import { loadGameData } from '../services/googleScript'
import { decodeGameData, loadGameDataFromFile } from '../utils/dataExport'
import { loadGameFromFirestore, isFirestoreAvailable, saveGameResult } from '../services/firestore'

function GamePlayer() {
  const [searchParams] = useSearchParams()
  const sheetUrl = searchParams.get('sheet')

  const {
    gameTitle,
    protagonistName,
    characterImages,
    slides,
    quests,
    variables,
    playerVariables,
    currentSlideId,
    questStatus,
    initGamePlay,
    makeChoice,
    updateQuestStatus,
    loadGameData: loadDataToStore
  } = useGameStore()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [gameStartTime] = useState(Date.now())
  const [questCompleteTimes, setQuestCompleteTimes] = useState({})
  const [showResultModal, setShowResultModal] = useState(false)
  const [studentNickname, setStudentNickname] = useState('')
  const [submittingResult, setSubmittingResult] = useState(false)
  const [showNicknameModal, setShowNicknameModal] = useState(false)
  const [displayedText, setDisplayedText] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const gameIdRef = useRef(null)
  const typingTimeoutRef = useRef(null)

  const currentSlide = slides.find(s => s.id === currentSlideId)
  const currentImage = characterImages.find(img => img.label === currentSlide?.imageLabel)

  // 타이핑 효과
  useEffect(() => {
    if (!currentSlide) return

    setIsTyping(true)
    setDisplayedText('')

    const fullText = currentSlide.text || ''
    let currentIndex = 0

    const typeChar = () => {
      if (currentIndex < fullText.length) {
        setDisplayedText(fullText.substring(0, currentIndex + 1))
        currentIndex++
        typingTimeoutRef.current = setTimeout(typeChar, 30) // 타이핑 속도 조절
      } else {
        setIsTyping(false)
      }
    }

    typeChar()

    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
      }
    }
  }, [currentSlideId, currentSlide?.text])

  // 퀘스트 완료 체크
  useEffect(() => {
    if (!quests || quests.length === 0) return

    quests.forEach((quest, index) => {
      if (!quest.enabled) return
      const questId = `quest_${index}`
      const status = questStatus[questId]

      if (status && status.completed) return // 이미 완료됨

      let completed = false

      if (quest.type === 'score') {
        // 점수 누적 퀘스트
        const currentScore = playerVariables[quest.targetVariable] || 0
        if (currentScore >= (quest.targetScore || 0)) {
          completed = true
        }
      } else if (quest.type === 'scene') {
        // 장면 퀘스트
        if (currentSlide?.questSuccessScene || currentSlideId === quest.targetSlideId) {
          completed = true
        }
      }

      if (completed) {
        const completeTime = Date.now()
        updateQuestStatus(questId, { completed: true, completedAt: completeTime })
        setQuestCompleteTimes(prev => ({
          ...prev,
          [questId]: completeTime
        }))
      }
    })
  }, [playerVariables, currentSlideId, currentSlide, quests, questStatus, updateQuestStatus])

  // 모든 퀘스트 완료 여부 확인
  const allQuestsCompleted = () => {
    if (!quests || quests.length === 0) return true
    const enabledQuests = quests.filter(q => q.enabled)
    if (enabledQuests.length === 0) return true

    return enabledQuests.every((quest, index) => {
      const questId = `quest_${index}`
      return questStatus[questId]?.completed === true
    })
  }

  // 게임 종료 가능 여부
  const canEndGame = () => {
    if (!currentSlide || (currentSlide.choices && currentSlide.choices.length > 0)) {
      return false // 아직 선택지가 있음
    }
    return allQuestsCompleted() // 모든 퀘스트 완료 여부
  }

  // 뒤로가기 방지 (퀘스트 미완료 시)
  useEffect(() => {
    const hasEnabledQuests = quests && quests.some(q => q.enabled)
    if (!hasEnabledQuests) return

    const checkQuestsCompleted = () => {
      if (!quests || quests.length === 0) return true
      const enabledQuests = quests.filter(q => q.enabled)
      if (enabledQuests.length === 0) return true

      return enabledQuests.every((quest, index) => {
        const questId = `quest_${index}`
        return questStatus[questId]?.completed === true
      })
    }

    const handlePopState = (e) => {
      if (!checkQuestsCompleted()) {
        e.preventDefault()
        window.history.pushState(null, '', window.location.href)
        alert('모든 퀘스트를 완료해야 게임을 종료할 수 있습니다.')
      }
    }

    window.history.pushState(null, '', window.location.href)
    window.addEventListener('popstate', handlePopState)

    return () => {
      window.removeEventListener('popstate', handlePopState)
    }
  }, [quests, questStatus])

  // 게임 데이터 불러오기
  useEffect(() => {
    const loadGame = async () => {
      const gameIdParam = searchParams.get('id')
      const dataParam = searchParams.get('data')
      const sheetParam = searchParams.get('sheet')

      // 방법 1: Firestore ID로 불러오기 (최우선)
      if (gameIdParam && isFirestoreAvailable()) {
        try {
          gameIdRef.current = gameIdParam
          const gameData = await loadGameFromFirestore(gameIdParam)
          if (gameData) {
            loadDataToStore(gameData)
            initGamePlay()
            setLoading(false)
            setShowNicknameModal(true) // 닉네임 입력 모달 표시
            return
          } else {
            setError('게임을 찾을 수 없습니다. 게임 ID를 확인해주세요.')
            setLoading(false)
            return
          }
        } catch (err) {
          console.error('Firestore 불러오기 오류:', err)
          setError('게임을 불러오는 중 오류가 발생했습니다: ' + err.message)
          setLoading(false)
          return
        }
      }

      // 방법 2: URL에 데이터가 직접 포함된 경우
      if (dataParam) {
        try {
          // URL 데이터가 너무 긴 경우 체크
          if (dataParam.length > 2000) {
            throw new Error('URL에 포함된 데이터가 너무 깁니다. 파일 업로드 방식을 사용하세요.')
          }

          const gameData = decodeGameData(dataParam)
          loadDataToStore(gameData)
          initGamePlay()
          setLoading(false)
          setShowNicknameModal(true)
          return
        } catch (err) {
          console.error('URL 데이터 디코딩 오류:', err)

          // 데이터가 너무 큰 경우 친화적인 메시지
          if (err.message.includes('too long') || err.message.includes('너무')) {
            setError(
              '게임 데이터가 너무 커서 URL에 포함할 수 없습니다.\n\n' +
              '해결 방법:\n' +
              '1. 교사에게 게임 데이터 파일(.json)을 요청하세요\n' +
              '2. 파일을 업로드하여 게임을 플레이할 수 있습니다'
            )
          } else {
            setError('URL에 포함된 게임 데이터를 불러올 수 없습니다: ' + err.message)
          }
          setLoading(false)
          return
        }
      }

      // 방법 3: 시트 URL을 통한 데이터 불러오기
      if (sheetParam) {
        try {
          const decodedUrl = decodeURIComponent(sheetParam)
          const data = await loadGameData(decodedUrl)

          if (data) {
            loadDataToStore(data)
            initGamePlay()
            setShowNicknameModal(true)
          } else {
            setError('게임 데이터를 찾을 수 없습니다.')
          }
        } catch (err) {
          setError('게임을 불러오는 중 오류가 발생했습니다: ' + err.message)
        } finally {
          setLoading(false)
        }
        return
      }

      // 방법 4: 로컬스토리지에서 불러오기 (마지막 시도)
      try {
        const { loadFromLocalStorage } = await import('../utils/localStorage')
        const localData = loadFromLocalStorage()
        if (localData) {
          loadDataToStore(localData)
          initGamePlay()
          setLoading(false)
          setShowNicknameModal(true)
          return
        }
      } catch (err) {
        console.warn('로컬스토리지 불러오기 실패:', err)
      }

      // 모든 방법 실패
      setError(
        '게임 데이터를 찾을 수 없습니다.\n\n' +
        '가능한 원인:\n' +
        '1. 공유 링크가 올바르지 않음\n' +
        '2. 게임 데이터가 너무 커서 URL에 포함되지 않음\n\n' +
        '해결 방법:\n' +
        '- 교사에게 게임 데이터 파일(.json)을 요청하여 업로드하세요'
      )
      setLoading(false)
    }

    loadGame()
  }, [searchParams, loadDataToStore, initGamePlay])

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">게임을 불러오는 중...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-100 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-xl p-8 max-w-md">
          <h2 className="text-2xl font-bold text-red-600 mb-4">오류</h2>
          <p className="text-gray-700 whitespace-pre-line mb-4">{error}</p>

          {/* 파일 업로드 옵션 */}
          <div className="border-t pt-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              게임 데이터 파일로 불러오기
            </label>
            <input
              type="file"
              accept=".json"
              onChange={async (e) => {
                const file = e.target.files?.[0]
                if (!file) return

                try {
                  const gameData = await loadGameDataFromFile(file)
                  loadDataToStore(gameData)
                  initGamePlay()
                  setError('')
                  setLoading(false)
                  setShowNicknameModal(true)
                } catch (err) {
                  setError('파일 불러오기 중 오류가 발생했습니다: ' + err.message)
                }
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
            />
            <p className="text-xs text-gray-500 mt-2">
              교사가 제공한 게임 데이터 파일(.json)을 업로드하세요.
            </p>
          </div>
        </div>
      </div>
    )
  }

  // 게임 종료 화면
  if (!currentSlide || (currentSlide.choices && currentSlide.choices.length === 0 && canEndGame())) {
    const gameEndTime = Date.now()
    const totalTime = Math.floor((gameEndTime - gameStartTime) / 1000) // 초 단위

    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full">
          <h2 className="text-2xl font-bold text-gray-800 mb-4 text-center">게임 완료!</h2>
          
          {!allQuestsCompleted() && quests && quests.some(q => q.enabled) && (
            <div className="mb-4 p-3 bg-yellow-100 border-2 border-yellow-400 rounded-lg">
              <p className="text-yellow-800 font-semibold text-sm">
                ⚠️ 모든 퀘스트를 완료해야 게임을 종료할 수 있습니다.
              </p>
              <p className="text-yellow-700 text-xs mt-2">
                뒤로가기 버튼을 눌러 퀘스트를 완료하세요.
              </p>
            </div>
          )}

          {allQuestsCompleted() && (
            <>
              <div className="space-y-3 mb-6">
                <div className="p-3 bg-gray-50 rounded-lg">
                  <h3 className="font-semibold text-gray-700 mb-2">최종 상태:</h3>
                  {Object.entries(playerVariables).map(([name, value]) => (
                    <div key={name} className="text-gray-700 text-sm">
                      {name}: <span className="font-bold text-indigo-600">{value}</span>
                    </div>
                  ))}
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <h3 className="font-semibold text-gray-700 mb-2">플레이 시간:</h3>
                  <p className="text-gray-700 text-sm">
                    {Math.floor(totalTime / 60)}분 {totalTime % 60}초
                  </p>
                </div>
              </div>

              {showResultModal ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      닉네임 입력
                    </label>
                    <input
                      type="text"
                      value={studentNickname}
                      onChange={(e) => setStudentNickname(e.target.value)}
                      placeholder="이름 또는 닉네임"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                      maxLength={20}
                    />
                  </div>
                  <button
                    onClick={async () => {
                      if (!studentNickname.trim()) {
                        alert('닉네임을 입력해주세요.')
                        return
                      }

                      setSubmittingResult(true)
                      try {
                        const questTimes = {}
                        quests?.forEach((quest, index) => {
                          if (quest.enabled) {
                            const questId = `quest_${index}`
                            const completeTime = questCompleteTimes[questId]
                            if (completeTime) {
                              questTimes[questId] = Math.floor((completeTime - gameStartTime) / 1000)
                            }
                          }
                        })

                        if (gameIdRef.current && isFirestoreAvailable()) {
                          await saveGameResult(gameIdRef.current, {
                            nickname: studentNickname.trim(),
                            totalTime,
                            questTimes,
                            playerVariables,
                            completedAt: new Date().toISOString()
                          })
                          alert('결과가 제출되었습니다!')
                          setShowResultModal(false)
                        } else {
                          alert('결과를 저장할 수 없습니다. 게임 ID가 없습니다.')
                        }
                      } catch (err) {
                        console.error('결과 저장 오류:', err)
                        alert('결과 저장 중 오류가 발생했습니다: ' + err.message)
                      } finally {
                        setSubmittingResult(false)
                      }
                    }}
                    disabled={submittingResult}
                    className="w-full px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-semibold"
                  >
                    {submittingResult ? '제출 중...' : '결과 제출하기'}
                  </button>
                  <button
                    onClick={() => setShowResultModal(false)}
                    className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                  >
                    취소
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowResultModal(true)}
                  className="w-full px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-semibold"
                >
                  결과 제출하기
                </button>
              )}
            </>
          )}
        </div>
      </div>
    )
  }

  // 변수 최소/최대값 계산 (게이지바용)
  const getVariableRange = (varName) => {
    const variable = variables.find(v => v.name === varName)
    const initial = variable?.initial || 0
    const current = playerVariables[varName] || initial
    
    // 최소값과 최대값 추정 (초기값 기준으로 ±100 범위)
    const min = Math.min(initial - 100, current - 50, 0)
    const max = Math.max(initial + 100, current + 50, 100)
    
    return { min, max, current, initial }
  }

  // 퀘스트 진행률 계산
  const getQuestProgress = (quest, index) => {
    const questId = `quest_${index}`
    const status = questStatus[questId]
    
    if (status?.completed) {
      return { completed: true, progress: 100 }
    }

    if (quest.type === 'score') {
      const range = getVariableRange(quest.targetVariable)
      const progress = Math.min(100, Math.max(0, (range.current / (quest.targetScore || 100)) * 100))
      return { completed: false, progress }
    } else if (quest.type === 'scene') {
      // 장면 퀘스트는 현재 슬라이드가 목표인지 확인
      const isAtTarget = currentSlideId === quest.targetSlideId || currentSlide?.questSuccessScene
      return { completed: isAtTarget, progress: isAtTarget ? 100 : 0 }
    }

    return { completed: false, progress: 0 }
  }

  // 닉네임 입력 모달
  if (showNicknameModal) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-100 flex items-center justify-center p-4">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full"
        >
          <h2 className="text-2xl font-bold text-gray-800 mb-4 text-center">게임 시작</h2>
          <p className="text-gray-600 mb-6 text-center">
            닉네임을 입력하고 게임을 시작하세요
          </p>
          <input
            type="text"
            value={studentNickname}
            onChange={(e) => setStudentNickname(e.target.value)}
            placeholder="닉네임 입력"
            maxLength={20}
            className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-lg"
            onKeyPress={(e) => {
              if (e.key === 'Enter' && studentNickname.trim()) {
                setShowNicknameModal(false)
              }
            }}
            autoFocus
          />
          <button
            onClick={() => {
              if (studentNickname.trim()) {
                setShowNicknameModal(false)
              } else {
                alert('닉네임을 입력해주세요.')
              }
            }}
            disabled={!studentNickname.trim()}
            className="w-full mt-4 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-semibold text-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            시작하기
          </button>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-100 relative overflow-hidden">
      {/* 배경 이미지 - 크게 표시 (모핑 애니메이션) */}
      {currentImage && (
        <div className="fixed inset-0 z-0">
          <AnimatePresence mode="wait">
            <motion.img
              key={currentSlideId}
              src={currentImage.base64}
              alt={currentImage.label}
              initial={{ opacity: 0, scale: 1.2, filter: 'blur(10px)' }}
              animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
              exit={{ opacity: 0, scale: 0.9, filter: 'blur(10px)' }}
              transition={{ duration: 0.8, ease: 'easeInOut' }}
              className="w-full h-full object-cover"
              style={{ filter: 'brightness(0.7)' }}
            />
          </AnimatePresence>
        </div>
      )}

      {/* 좌측 상단 스코어 보드 */}
      <div className="fixed top-4 left-4 z-30 w-64">
        <motion.div
          initial={{ opacity: 0, x: -50 }}
          animate={{ opacity: 1, x: 0 }}
          className="bg-white/95 backdrop-blur-md rounded-xl shadow-2xl border-2 border-white/50 p-4"
        >
          <h3 className="text-lg font-bold text-gray-800 mb-3">스코어</h3>
          
          {/* 변수별 게이지바 */}
          <div className="space-y-3 mb-4">
            {variables.map((variable) => {
              const range = getVariableRange(variable.name)
              const percentage = ((range.current - range.min) / (range.max - range.min)) * 100
              
              return (
                <div key={variable.name} className="space-y-1">
                  <div className="flex justify-between items-center text-sm">
                    <span className="font-medium text-gray-700">{variable.name}</span>
                    <span className="font-bold text-indigo-600">{range.current}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.max(0, Math.min(100, percentage))}%` }}
                      transition={{ duration: 0.5, ease: 'easeOut' }}
                      className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full"
                    />
                  </div>
                </div>
              )
            })}
          </div>

          {/* 퀘스트 보드 */}
          {quests && quests.some(q => q.enabled) && (
            <div className="border-t border-gray-300 pt-3 mt-3">
              <h3 className="text-lg font-bold text-gray-800 mb-3">퀘스트</h3>
              <div className="space-y-2">
                {quests
                  .filter(q => q.enabled)
                  .map((quest, index) => {
                    const questId = `quest_${index}`
                    const status = questStatus[questId]
                    const progress = getQuestProgress(quest, index)
                    const isCompleted = status?.completed || progress.completed

                    return (
                      <div
                        key={index}
                        className={`p-2 rounded-lg text-sm ${
                          isCompleted ? 'bg-green-50 border border-green-200' : 'bg-gray-50 border border-gray-200'
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          <span className="text-lg mt-0.5">
                            {isCompleted ? '✓' : '○'}
                          </span>
                          <div className="flex-1">
                            <div
                              className={`font-medium ${
                                isCompleted ? 'line-through text-gray-500' : 'text-gray-800'
                              }`}
                            >
                              {quest.type === 'score' 
                                ? `${quest.targetVariable} ${quest.targetScore}점 달성`
                                : '목표 장면 도달'}
                            </div>
                            {!isCompleted && quest.type === 'score' && (
                              <div className="text-xs text-gray-600 mt-1">
                                진행률: {Math.round(progress.progress)}%
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
              </div>
            </div>
          )}
        </motion.div>
      </div>

      {/* 헤더 (반투명) */}
      <div className="relative z-10 bg-black/30 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-4 py-3">
          <h1 className="text-xl font-bold text-white drop-shadow-lg">{gameTitle}</h1>
          {studentNickname && (
            <p className="text-sm text-white/80 drop-shadow mt-1">플레이어: {studentNickname}</p>
          )}
        </div>
      </div>

      {/* 게임 화면 - 하단 대화창 형식 */}
      <div className="fixed bottom-0 left-0 right-0 z-20">
        <div className="max-w-6xl mx-auto px-4 pb-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentSlideId}
              initial={{ opacity: 0, y: 100, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 100, scale: 0.95 }}
              transition={{ duration: 0.5, ease: 'easeInOut' }}
              className="bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border-2 border-white/50 overflow-hidden"
            >
              {/* 대사/지문 (타이핑 효과) */}
              <div className="p-6">
                <div className="text-lg text-gray-800 leading-relaxed mb-6 min-h-[80px]">
                  {displayedText}
                  {isTyping && (
                    <motion.span
                      animate={{ opacity: [1, 0] }}
                      transition={{ duration: 0.8, repeat: Infinity, repeatType: 'reverse' }}
                      className="inline-block w-0.5 h-5 bg-indigo-600 ml-1"
                    />
                  )}
                </div>

                {/* 선택지 (타이핑 완료 후에만 표시) */}
                {!isTyping && currentSlide.choices && currentSlide.choices.length > 0 ? (
                  <div className="space-y-3">
                    {currentSlide.choices.map((choice, index) => (
                      <motion.button
                        key={choice.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 }}
                        whileHover={{ scale: 1.02, x: 5 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => makeChoice(choice)}
                        className="w-full p-4 text-left bg-gradient-to-r from-indigo-50 to-purple-50 hover:from-indigo-100 hover:to-purple-100 border-2 border-indigo-200 rounded-lg transition-all shadow-sm hover:shadow-md"
                      >
                        <div className="font-medium text-indigo-900 text-base">{choice.text}</div>
                      </motion.button>
                    ))}
                  </div>
                ) : !isTyping && (
                  <div className="text-center py-6">
                    <p className="text-gray-500 text-lg">스토리가 끝났습니다.</p>
                  </div>
                )}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}

export default GamePlayer
