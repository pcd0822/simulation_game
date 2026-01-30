/**
 * Google Spreadsheets DB 연동 유틸리티
 * API URL은 .env의 VITE_GOOGLE_SHEET_API_URL에서 로드
 */

import type { GameData } from '../types/game'

const API_URL = import.meta.env.VITE_GOOGLE_SHEET_API_URL as string | undefined

function getBaseUrl(): string {
  if (!API_URL?.trim()) {
    throw new Error('VITE_GOOGLE_SHEET_API_URL이 설정되지 않았습니다. .env 파일을 확인하세요.')
  }
  return API_URL.replace(/\/$/, '')
}

/**
 * 게임 데이터 불러오기 (action=load)
 */
export async function loadGame(): Promise<GameData | null> {
  const url = `${getBaseUrl()}?action=load`
  const res = await fetch(url, { method: 'GET' })
  const json = await res.json()
  if (json.status !== 'success') {
    throw new Error(json.message ?? '데이터 불러오기 실패')
  }
  return json.data ?? null
}

/**
 * 게임 데이터 저장 (action=save)
 * 전체 게임 데이터(설정, 노드, 이미지 에셋 포함)를 JSON으로 전송
 */
export async function saveGame(data: GameData): Promise<void> {
  const url = `${getBaseUrl()}?action=save`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  const json = await res.json()
  if (json.status !== 'success') {
    throw new Error(json.message ?? '저장 실패')
  }
}
