import { create } from 'zustand'

/**
 * 게임 상태 및 슬라이드 데이터를 관리하는 Zustand 스토어
 */
const useGameStore = create((set, get) => ({
  // 초기 설정 데이터
  sheetUrl: '',
  gameTitle: '',
  protagonistName: '',
  synopsis: '',
  variables: [], // [{name: "호감도", initial: 50}]
  characterImages: [], // [{id, label, base64}]
  
  // 슬라이드 데이터
  slides: [], // [{id, text, imageLabel, choices: [{id, text, variableChanges, nextSlideId}]}]
  currentSlideIndex: 0,
  
  // 플레이어 상태 (게임 플레이 시)
  playerVariables: {},
  currentSlideId: null,
  gameHistory: [],
  
  // 액션: 초기 설정
  setSheetUrl: (url) => set({ sheetUrl: url }),
  setGameTitle: (title) => set({ gameTitle: title }),
  setProtagonistName: (name) => set({ protagonistName: name }),
  setSynopsis: (synopsis) => set({ synopsis }),
  
  // 액션: 변수 관리
  addVariable: (variable) => set((state) => ({
    variables: [...state.variables, variable]
  })),
  updateVariable: (index, variable) => set((state) => ({
    variables: state.variables.map((v, i) => i === index ? variable : v)
  })),
  removeVariable: (index) => set((state) => ({
    variables: state.variables.filter((_, i) => i !== index)
  })),
  
  // 액션: 이미지 관리
  addCharacterImage: (image) => set((state) => ({
    characterImages: [...state.characterImages, {
      id: `img_${Date.now()}_${Math.random()}`,
      ...image
    }]
  })),
  updateCharacterImage: (id, updates) => set((state) => ({
    characterImages: state.characterImages.map(img =>
      img.id === id ? { ...img, ...updates } : img
    )
  })),
  removeCharacterImage: (id) => set((state) => ({
    characterImages: state.characterImages.filter(img => img.id !== id)
  })),
  
  // 액션: 슬라이드 관리
  setSlides: (slides) => set({ slides }),
  addSlide: (slide) => set((state) => ({
    slides: [...state.slides, {
      id: `slide_${Date.now()}`,
      text: '',
      imageLabel: state.characterImages[0]?.label || '기본',
      choices: [],
      ...slide
    }]
  })),
  updateSlide: (id, updates) => set((state) => ({
    slides: state.slides.map(slide =>
      slide.id === id ? { ...slide, ...updates } : slide
    )
  })),
  removeSlide: (id) => set((state) => ({
    slides: state.slides.filter(slide => slide.id !== id)
  })),
  setCurrentSlideIndex: (index) => set({ currentSlideIndex: index }),
  
  // 액션: 게임 데이터 로드
  loadGameData: (data) => set({
    sheetUrl: data.sheetUrl || '',
    gameTitle: data.gameTitle || '',
    protagonistName: data.protagonistName || '',
    synopsis: data.synopsis || '',
    variables: data.variables || [],
    characterImages: data.characterImages || [],
    slides: data.slides || []
  }),
  
  // 액션: 게임 데이터 내보내기
  exportGameData: () => {
    const state = get()
    return {
      gameTitle: state.gameTitle,
      protagonistName: state.protagonistName,
      synopsis: state.synopsis,
      variables: state.variables,
      characterImages: state.characterImages,
      slides: state.slides
    }
  },
  
  // 액션: 게임 플레이 초기화
  initGamePlay: () => {
    const state = get()
    const playerVariables = {}
    state.variables.forEach(v => {
      playerVariables[v.name] = v.initial || 0
    })
    
    set({
      playerVariables,
      currentSlideId: state.slides[0]?.id || null,
      gameHistory: []
    })
  },
  
  // 액션: 선택지 선택
  makeChoice: (choice) => {
    const state = get()
    const currentSlide = state.slides.find(s => s.id === state.currentSlideId)
    
    if (!currentSlide) return
    
    // 변수 업데이트
    const newPlayerVariables = { ...state.playerVariables }
    if (choice.variableChanges) {
      Object.entries(choice.variableChanges).forEach(([varName, change]) => {
        newPlayerVariables[varName] = (newPlayerVariables[varName] || 0) + change
      })
    }
    
    // 히스토리 추가
    const newHistory = [...state.gameHistory, {
      slideId: state.currentSlideId,
      choiceId: choice.id,
      timestamp: Date.now()
    }]
    
    // 다음 슬라이드로 이동
    set({
      playerVariables: newPlayerVariables,
      currentSlideId: choice.nextSlideId || null,
      gameHistory: newHistory
    })
  },
  
  // 액션: 리셋
  reset: () => set({
    sheetUrl: '',
    gameTitle: '',
    protagonistName: '',
    synopsis: '',
    variables: [],
    characterImages: [],
    slides: [],
    currentSlideIndex: 0,
    playerVariables: {},
    currentSlideId: null,
    gameHistory: []
  })
}))

export default useGameStore
