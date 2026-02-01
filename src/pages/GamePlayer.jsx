import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import useGameStore from '../stores/gameStore'
import { loadGameData } from '../services/googleScript'
import { decodeGameData } from '../utils/dataExport'

function GamePlayer() {
  const [searchParams] = useSearchParams()
  const sheetUrl = searchParams.get('sheet')

  const {
    gameTitle,
    protagonistName,
    characterImages,
    slides,
    playerVariables,
    currentSlideId,
    initGamePlay,
    makeChoice,
    loadGameData: loadDataToStore
  } = useGameStore()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const currentSlide = slides.find(s => s.id === currentSlideId)
  const currentImage = characterImages.find(img => img.label === currentSlide?.imageLabel)

  // 게임 데이터 불러오기
  useEffect(() => {
    const loadGame = async () => {
      const dataParam = searchParams.get('data')
      const sheetParam = searchParams.get('sheet')

      // 방법 1: URL에 데이터가 직접 포함된 경우 (우선순위 높음)
      if (dataParam) {
        try {
          const gameData = decodeGameData(dataParam)
          loadDataToStore(gameData)
          initGamePlay()
          setLoading(false)
          return
        } catch (err) {
          console.error('URL 데이터 디코딩 오류:', err)
          setError('URL에 포함된 게임 데이터를 불러올 수 없습니다: ' + err.message)
          setLoading(false)
          return
        }
      }

      // 방법 2: 시트 URL을 통한 데이터 불러오기
      if (sheetParam) {
        try {
          const decodedUrl = decodeURIComponent(sheetParam)
          const data = await loadGameData(decodedUrl)
          
          if (data) {
            loadDataToStore(data)
            initGamePlay()
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

      // 방법 3: 로컬스토리지에서 불러오기 (마지막 시도)
      try {
        const { loadFromLocalStorage } = await import('../utils/localStorage')
        const localData = loadFromLocalStorage()
        if (localData) {
          loadDataToStore(localData)
          initGamePlay()
          setLoading(false)
          return
        }
      } catch (err) {
        console.warn('로컬스토리지 불러오기 실패:', err)
      }

      // 모든 방법 실패
      setError('게임 데이터를 찾을 수 없습니다. 공유 링크에 데이터가 포함되어 있는지 확인해주세요.')
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
          <p className="text-gray-700">{error}</p>
        </div>
      </div>
    )
  }

  if (!currentSlide) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-100 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-xl p-8 max-w-md text-center">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">게임 종료</h2>
          <p className="text-gray-600 mb-6">스토리가 끝났습니다!</p>
          <div className="space-y-2">
            <h3 className="font-semibold">최종 상태:</h3>
            {Object.entries(playerVariables).map(([name, value]) => (
              <div key={name} className="text-gray-700">
                {name}: {value}
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-100">
      {/* 헤더 */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold text-gray-800">{gameTitle}</h1>
          <div className="flex gap-4 mt-2">
            {Object.entries(playerVariables).map(([name, value]) => (
              <div key={name} className="text-sm">
                <span className="font-medium">{name}:</span>{' '}
                <span className="text-indigo-600">{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 게임 화면 */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentSlide.id}
            initial={{ opacity: 0, x: 100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -100 }}
            className="bg-white rounded-2xl shadow-xl overflow-hidden"
          >
            {/* 캐릭터 이미지 */}
            {currentImage && (
              <div className="bg-gradient-to-b from-indigo-100 to-purple-100 p-8 flex justify-center">
                <motion.img
                  key={currentImage.id}
                  src={currentImage.base64}
                  alt={currentImage.label}
                  initial={{ scale: 0.9 }}
                  animate={{ scale: 1 }}
                  className="max-w-xs rounded-lg shadow-lg"
                />
              </div>
            )}

            {/* 대사/지문 */}
            <div className="p-8">
              <div className="text-lg text-gray-800 leading-relaxed mb-8">
                {currentSlide.text}
              </div>

              {/* 선택지 */}
              {currentSlide.choices && currentSlide.choices.length > 0 ? (
                <div className="space-y-3">
                  {currentSlide.choices.map((choice) => (
                    <motion.button
                      key={choice.id}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => makeChoice(choice)}
                      className="w-full p-4 text-left bg-indigo-50 hover:bg-indigo-100 border-2 border-indigo-200 rounded-lg transition"
                    >
                      <div className="font-medium text-indigo-900">{choice.text}</div>
                      {choice.variableChanges && Object.keys(choice.variableChanges).length > 0 && (
                        <div className="text-xs text-indigo-600 mt-1">
                          {Object.entries(choice.variableChanges).map(([varName, change]) => (
                            <span key={varName} className="mr-2">
                              {varName}: {change > 0 ? '+' : ''}{change}
                            </span>
                          ))}
                        </div>
                      )}
                    </motion.button>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-500">스토리가 끝났습니다.</p>
                </div>
              )}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}

export default GamePlayer
