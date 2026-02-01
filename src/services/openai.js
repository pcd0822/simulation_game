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
  if (!OPENAI_API_KEY) {
    throw new Error('OpenAI API 키가 설정되지 않았습니다.')
  }

  const variableNames = variables.map(v => v.name).join(', ')
  const imageLabelList = imageLabels.length > 0 
    ? imageLabels.join(', ') 
    : '기본 표정'

  const systemPrompt = `당신은 인터랙티브 스토리 게임 제작을 도와주는 AI 어시스턴트입니다.
사용자가 제공한 스토리를 장면(Scene/Slide) 단위로 나누고, 각 장면에 적절한 선택지를 생성해야 합니다.

사용 가능한 이미지 라벨: ${imageLabelList}
게임 변수: ${variableNames}

각 슬라이드는 다음 JSON 형식을 따라야 합니다:
{
  "id": "unique_id",
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

응답은 반드시 유효한 JSON 배열 형식이어야 하며, 다른 설명 없이 JSON만 반환해야 합니다.`

  const userPrompt = `다음 스토리를 슬라이드 단위로 나누고 각 슬라이드에 선택지를 추가해주세요:

${storyText}

요구사항:
1. 스토리를 자연스러운 장면 단위로 나누기
2. 각 장면의 분위기에 맞는 이미지 라벨 선택 (${imageLabelList} 중에서)
3. 각 슬라이드마다 2-3개의 선택지 제공
4. 선택지마다 변수 변화 로직 포함 (${variableNames} 중에서 선택)
5. 마지막 슬라이드는 choices 배열이 비어있어야 함 (게임 종료)

JSON 배열 형식으로 반환해주세요.`

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
        temperature: 0.7,
        response_format: { type: 'json_object' }
      })
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error?.message || `API 오류: ${response.status}`)
    }

    const data = await response.json()
    const content = data.choices[0]?.message?.content

    if (!content) {
      throw new Error('API 응답에 내용이 없습니다.')
    }

    // JSON 파싱
    let parsedContent
    try {
      parsedContent = JSON.parse(content)
    } catch (e) {
      // JSON이 배열로 직접 반환된 경우
      if (content.trim().startsWith('[')) {
        parsedContent = JSON.parse(content)
      } else {
        // JSON 객체로 감싸진 경우
        const jsonMatch = content.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          parsedContent = JSON.parse(jsonMatch[0])
        } else {
          throw new Error('응답 형식이 올바르지 않습니다.')
        }
      }
    }

    // slides 배열 추출 (객체로 감싸진 경우)
    let slides = Array.isArray(parsedContent) 
      ? parsedContent 
      : parsedContent.slides || parsedContent.data || []

    // 슬라이드 ID 자동 생성 및 검증
    slides = slides.map((slide, index) => ({
      ...slide,
      id: slide.id || `slide_${index + 1}`,
      imageLabel: slide.imageLabel || imageLabels[0] || '기본',
      choices: slide.choices || []
    }))

    return slides
  } catch (error) {
    console.error('OpenAI API 오류:', error)
    throw error
  }
}
