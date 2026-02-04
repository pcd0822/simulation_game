import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { getGameResults, isFirestoreAvailable } from '../services/firestore'

function ResultDashboard() {
  const [searchParams] = useSearchParams()
  const gameId = searchParams.get('id')
  
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [results, setResults] = useState([])

  useEffect(() => {
    if (!gameId) {
      setError('게임 ID가 필요합니다.')
      setLoading(false)
      return
    }

    if (!isFirestoreAvailable()) {
      setError('Firestore가 설정되지 않았습니다.')
      setLoading(false)
      return
    }

    const loadResults = async () => {
      try {
        const data = await getGameResults(gameId)
        // 총 시간 기준으로 정렬 (빠른 순)
        data.sort((a, b) => (a.totalTime || 0) - (b.totalTime || 0))
        setResults(data)
      } catch (err) {
        setError('결과를 불러오는 중 오류가 발생했습니다: ' + err.message)
      } finally {
        setLoading(false)
      }
    }

    loadResults()

    // 5초마다 자동 새로고침
    const interval = setInterval(loadResults, 5000)
    return () => clearInterval(interval)
  }, [gameId])

  const formatTime = (seconds) => {
    if (!seconds) return '0초'
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    if (mins > 0) {
      return `${mins}분 ${secs}초`
    }
    return `${secs}초`
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">결과를 불러오는 중...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl p-8 max-w-md">
          <h2 className="text-2xl font-bold text-red-600 mb-4">오류</h2>
          <p className="text-gray-700 whitespace-pre-line">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl shadow-xl p-8 mb-6"
        >
          <h1 className="text-3xl font-bold text-gray-800 mb-2">게임 결과 대시보드</h1>
          <p className="text-gray-600">학생들의 참여 결과를 확인하세요</p>
        </motion.div>

        {results.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
            <p className="text-gray-600 text-lg">아직 제출된 결과가 없습니다.</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-indigo-600 text-white">
                  <tr>
                    <th className="px-6 py-4 text-left font-semibold">순위</th>
                    <th className="px-6 py-4 text-left font-semibold">닉네임</th>
                    <th className="px-6 py-4 text-left font-semibold">총 플레이 시간</th>
                    <th className="px-6 py-4 text-left font-semibold">퀘스트 완료 시간</th>
                    <th className="px-6 py-4 text-left font-semibold">최종 점수</th>
                    <th className="px-6 py-4 text-left font-semibold">제출 시간</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((result, index) => (
                    <motion.tr
                      key={result.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className={`border-b border-gray-200 hover:bg-gray-50 ${
                        index === 0 ? 'bg-yellow-50' : ''
                      }`}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          {index === 0 && <span className="text-2xl">🥇</span>}
                          {index === 1 && <span className="text-2xl">🥈</span>}
                          {index === 2 && <span className="text-2xl">🥉</span>}
                          <span className={`font-bold ${index < 3 ? 'text-indigo-600' : 'text-gray-700'}`}>
                            {index + 1}위
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 font-medium text-gray-800">
                        {result.nickname || '익명'}
                      </td>
                      <td className="px-6 py-4 text-gray-700">
                        {formatTime(result.totalTime)}
                      </td>
                      <td className="px-6 py-4 text-gray-700">
                        {result.questTimes && Object.keys(result.questTimes).length > 0 ? (
                          <div className="space-y-1">
                            {Object.entries(result.questTimes).map(([questId, time]) => (
                              <div key={questId} className="text-sm">
                                {questId.replace('quest_', '퀘스트 ')}: {formatTime(time)}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {result.playerVariables && Object.keys(result.playerVariables).length > 0 ? (
                          <div className="space-y-1">
                            {Object.entries(result.playerVariables).map(([name, value]) => (
                              <div key={name} className="text-sm">
                                <span className="text-gray-600">{name}:</span>{' '}
                                <span className="font-bold text-indigo-600">{value}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {result.submittedAt
                          ? new Date(result.submittedAt).toLocaleString('ko-KR')
                          : '-'}
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="mt-6 text-center text-sm text-gray-600">
          <p>결과는 5초마다 자동으로 새로고침됩니다.</p>
        </div>
      </div>
    </div>
  )
}

export default ResultDashboard
