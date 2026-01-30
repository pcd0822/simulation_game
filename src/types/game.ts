/**
 * Classroom Sim-Game Maker - 게임 데이터 타입
 * 1 Game = 1 Sheet 정책에 맞춘 전체 게임 JSON 구조
 */

/** 이미지 에셋: id, Base64 썸네일(가로 ~200px), 사용자 라벨(표정명) */
export interface ImageAsset {
  id: string
  data: string // Base64 data URL
  label: string // 예: "웃음", "슬픔", "곤란"
}

/** 게임 설정(제목, 캐릭터명, 배경, 이미지 에셋 목록 등) */
export interface GameSettings {
  title: string
  characterName: string
  backgroundImage?: string // Base64 또는 URL
  imageAssets: ImageAsset[]
}

/** 스토리 노드 한 개: 대사/지문, 표정 이미지, 선택지, 변수 변경 */
export interface StoryNode {
  id: string
  type: 'dialogue' | 'choice' | 'branch'
  text: string
  speaker?: string
  imageSrc?: string // ImageAsset.id (표정 라벨에 해당하는 이미지 ID)
  emotionLabel?: string // AI가 매칭한 표정 라벨 (예: "슬픔")
  next?: string // 다음 노드 id
  choices?: { text: string; next: string; variableChanges?: VariableChange[] }[]
  variableChanges?: VariableChange[]
}

export interface VariableChange {
  name: string
  delta: number // 증감 (호감도 +10 등)
}

/** 변수/플래그 정의 (HUD 표시용) */
export interface VariableDef {
  name: string
  displayName: string
  initialValue: number
}

/** 전체 게임 데이터 (설정 + 노드 목록) */
export interface GameData {
  settings: GameSettings
  variables: VariableDef[]
  nodes: StoryNode[]
  startNodeId: string
}
