/**
 * OpenAI API 서비스
 * GPT-4o를 사용하여 스토리를 슬라이드 단위로 분할하고 선택지를 생성
 */

const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions'

/**
 * OpenAI API 호출
 * @param {string} prompt - 프롬프트
 * @param {Array} imageLabels - 업로드된 이미지 라벨 배열 (예: ["기쁨", "슬픔", "화남"])
 * @param {Array} variables - 게임 변수 배열 (예: [{name: "호감도", initial: 50}])
 * @returns {Promise<Object>} 생성된 슬라이드 데이터
 */
export async function generateStorySlides(storyText, imageLabels = [], variables = []) {
  if (!OPENAI_API_KEY || OPENAI_API_KEY === 'your_openai_api_key_here') {
    throw new Error('OpenAI API 키가 설정되지 않았습니다. .env 파일에 VITE_OPENAI_API_KEY를 설정해주세요.')
  }

  const variableNames = variables.map(v => v.name).join(', ')
  const imageLabelList = imageLabels.length > 0
    ? imageLabels.join(', ')
    : '기본 표정'

  const systemPrompt = `당신은 교실용 인터랙티브 스토리 게임 제작을 도와주는 AI 어시스턴트입니다.
사용자가 제공한 스토리를 장면(Scene/Slide) 단위로 나누고, 각 장면에 적절한 선택지(플레이어의 결정)를 생성합니다.

중요: 스토리는 재미 요소를 위해 "기승전결"이 뚜렷해야 합니다.
반드시 아래 5단계 구조가 드러나도록 구성하세요:
- 발단(도입/세계관/인물/목표 제시)
- 전개(갈등의 씨앗/단서/관계 변화)
- 위기(가장 큰 문제/실패/위험 상승)
- 절정(결정적 선택/대결/반전/클라이맥스)
- 결말(결과/정리/여운)

사용 가능한 이미지 라벨: ${imageLabelList}
게임 변수: ${variableNames}

응답은 반드시 유효한 JSON 배열 형식이어야 하며, 다른 설명 없이 JSON 배열만 반환해야 합니다.
각 슬라이드는 다음 형식을 따라야 합니다:
{
  "id": "unique_id",
  "phase": "발단|전개|위기|절정|결말",
  "text": "장면의 대사/지문",
  "imageLabel": "이미지 라벨 (사용 가능한 라벨 중 하나)",
  "choices": [
    {
      "id": "choice_1",
      "text": "선택지 텍스트",
      "variableChanges": {
        "변수명": 숫자값
      },
      "nextSlideId": "다음_슬라이드_id"
    }
  ]
}

중요: 응답은 반드시 JSON 배열로 시작해야 합니다. 예: [{"id": "slide_1", ...}]`

  const userPrompt = `다음 스토리를 슬라이드 단위로 나누고 각 슬라이드에 선택지를 추가해주세요.
이번 생성에서는 "발단-전개-위기-절정-결말" 5단계가 명확히 드러나야 합니다.

${storyText}

요구사항:
1. 기본은 5개의 슬라이드로 구성 (발단, 전개, 위기, 절정, 결말을 각각 1장면씩)
2. 각 슬라이드에 반드시 "phase" 필드를 포함 (발단|전개|위기|절정|결말 중 하나)
3. 각 슬라이드의 text는 맨 앞에 단계가 드러나도록 접두어를 붙이기 (예: "【발단】 ...")
2. 각 장면의 분위기에 맞는 이미지 라벨 선택 (${imageLabelList} 중에서)
3. 각 슬라이드마다 2-3개의 선택지 제공
4. 선택지마다 변수 변화 로직 포함 (${variableNames} 중에서 선택)
5. 마지막 슬라이드는 choices 배열이 비어있어야 함 (게임 종료)
6. 각 선택지의 nextSlideId는 다음 슬라이드의 id를 참조해야 함

반드시 JSON 배열 형식으로만 응답하세요. 다른 설명이나 텍스트 없이 순수 JSON 배열만 반환하세요.`

  try {
    const response = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7
      })
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      console.error('OpenAI API 오류 응답:', errorData)
      throw new Error(errorData.error?.message || `API 오류: ${response.status}`)
    }

    const data = await response.json()
    const content = data.choices[0]?.message?.content

    console.log('OpenAI API 응답:', {
      hasContent: !!content,
      contentLength: content?.length,
      contentPreview: content?.substring(0, 200)
    })

    if (!content) {
      throw new Error('API 응답에 내용이 없습니다.')
    }

    // JSON 파싱 - 응답에서 JSON 배열 추출
    let parsedContent
    let rawContent = content.trim()

    console.log('원본 응답 (처음 500자):', rawContent.substring(0, 500))

    // 마크다운 코드 블록 제거 (```json ... ```)
    if (rawContent.includes('```')) {
      const codeBlockMatch = rawContent.match(/```(?:json)?\s*([\s\S]*?)```/)
      if (codeBlockMatch) {
        rawContent = codeBlockMatch[1].trim()
        console.log('코드 블록 제거 후:', rawContent.substring(0, 200))
      }
    }

    // JSON 배열 찾기
    const arrayMatch = rawContent.match(/\[[\s\S]*\]/)
    if (arrayMatch) {
      try {
        parsedContent = JSON.parse(arrayMatch[0])
        console.log('JSON 배열 파싱 성공, 슬라이드 개수:', parsedContent.length)
      } catch (e) {
        console.error('JSON 파싱 오류:', e, '시도한 문자열:', arrayMatch[0].substring(0, 200))
        throw new Error('JSON 파싱에 실패했습니다: ' + e.message)
      }
    } else {
      // 배열이 아닌 경우 직접 파싱 시도
      try {
        parsedContent = JSON.parse(rawContent)
        console.log('직접 파싱 성공:', typeof parsedContent)
      } catch (e) {
        console.error('파싱 실패, 원본:', rawContent.substring(0, 300))
        throw new Error('응답에서 JSON 배열을 찾을 수 없습니다. 응답: ' + rawContent.substring(0, 200))
      }
    }

    // slides 배열 추출
    let slides = Array.isArray(parsedContent)
      ? parsedContent
      : parsedContent.slides || parsedContent.data || []

    if (!Array.isArray(slides) || slides.length === 0) {
      throw new Error('생성된 슬라이드가 없습니다. 응답 형식을 확인해주세요.')
    }

    // 슬라이드 ID 자동 생성 및 검증
    slides = slides.map((slide, index) => {
      const slideId = slide.id || `slide_${index + 1}`
      return {
        ...slide,
        id: slideId,
        imageLabel: slide.imageLabel || imageLabels[0] || '기본',
        choices: (slide.choices || []).map((choice, choiceIndex) => {
          // nextSlideId 자동 설정: 다음 슬라이드가 있으면 그 ID, 없으면 null
          let nextSlideId = choice.nextSlideId
          if (!nextSlideId && index < slides.length - 1) {
            // 다음 슬라이드 ID 찾기
            const nextSlide = slides[index + 1]
            nextSlideId = nextSlide?.id || `slide_${index + 2}`
          } else if (index === slides.length - 1) {
            // 마지막 슬라이드의 선택지는 null
            nextSlideId = null
          }

          return {
            ...choice,
            id: choice.id || `choice_${index}_${choiceIndex}`,
            nextSlideId: nextSlideId
          }
        })
      }
    })

    // 슬라이드 ID 업데이트 후 다시 nextSlideId 재설정
    slides = slides.map((slide, index) => ({
      ...slide,
      choices: slide.choices.map(choice => {
        if (choice.nextSlideId && index < slides.length - 1) {
          // nextSlideId가 유효한지 확인하고, 없으면 다음 슬라이드로 설정
          const targetSlide = slides.find(s => s.id === choice.nextSlideId)
          if (!targetSlide && index < slides.length - 1) {
            choice.nextSlideId = slides[index + 1].id
          }
        }
        return choice
      })
    }))

    // 기승전결(발단/전개/위기/절정/결말) 단계 보정: 모델이 누락해도 구조가 드러나도록 강제
    const phases = ['발단', '전개', '위기', '절정', '결말']
    slides = slides.map((slide, index) => {
      const phase = slide.phase || phases[index] || (index === slides.length - 1 ? '결말' : '전개')
      const text = (slide.text || '').trim()
      const prefixedText = text.startsWith('【') ? text : `【${phase}】 ${text}`
      return {
        ...slide,
        phase,
        text: prefixedText
      }
    })

    // 마지막 슬라이드는 게임 종료: 선택지 제거(요구사항 강제)
    if (slides.length > 0) {
      slides[slides.length - 1] = {
        ...slides[slides.length - 1],
        choices: []
      }
    }

    return slides
  } catch (error) {
    console.error('OpenAI API 오류:', error)
    throw error
  }
}

/**
 * 다음 장면(슬라이드) 생성
 * @param {Object} currentSlide - 현재 슬라이드 데이터
 * @param {Object} choice - 선택한 선택지 데이터
 * @param {Array} variables - 게임 변수 배열
 * @param {Array} imageLabels - 사용 가능한 이미지 라벨
 * @returns {Promise<Object>} 생성된 단일 슬라이드
 */
export async function generateNextSlide(currentSlide, choice, variables = [], imageLabels = []) {
  if (!OPENAI_API_KEY || OPENAI_API_KEY === 'your_openai_api_key_here') {
    throw new Error('OpenAI API 키가 설정되지 않았습니다.')
  }

  const variableNames = variables.map(v => v.name).join(', ')
  const imageLabelList = imageLabels.length > 0
    ? imageLabels.join(', ')
    : '기본 표정'

  const systemPrompt = `당신은 인터랙티브 스토리 게임 작가입니다.
사용자의 이전 장면과 선택을 바탕으로, 이어지는 다음 장면(슬라이드)을 하나만 생성해야 합니다.

사용 가능한 이미지 라벨: ${imageLabelList}
게임 변수: ${variableNames}

응답은 반드시 유효한 JSON 객체(단일 슬라이드) 형식이어야 합니다:
{
  "text": "장면의 대사/지문",
  "imageLabel": "이미지 라벨",
  "choices": [
    {
      "text": "선택지 텍스트",
      "variableChanges": { "변수명": 숫자값 }
    }
  ]
}

- 선택지는 2~3개 생성하세요.
- nextSlideId나 id는 포함하지 마세요(자동 생성됨).
- 이전 선택의 결과가 자연스럽게 이어져야 합니다.`

  const userPrompt = `이전 장면: "${currentSlide.text}"
  
사용자의 선택: "${choice.text}" (변수 변화: ${JSON.stringify(choice.variableChanges)})

위 선택에 이어지는 다음 장면을 생성해주세요.
반드시 JSON 객체 하나만 반환하세요.`

  try {
    const response = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7
      })
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error?.message || `API 오류: ${response.status}`)
    }

    const data = await response.json()
    const content = data.choices[0]?.message?.content

    if (!content) throw new Error('API 응답 내용 없음')

    // JSON 파싱 (코드 블록 처리 포함)
    let rawContent = content.trim()
    if (rawContent.includes('```')) {
      const match = rawContent.match(/```(?:json)?\s*([\s\S]*?)```/)
      if (match) rawContent = match[1].trim()
    }

    return JSON.parse(rawContent)

  } catch (error) {
    console.error('다음 장면 생성 오류:', error)
    throw error
  }
}
