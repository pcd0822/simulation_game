/**
 * 교실용 시뮬레이션 게임 데이터베이스 (Google Sheets Backend)
 * 기능:
 * 1. 게임 데이터(스토리, 노드, 설정) 저장 (doPost)
 * 2. 게임 데이터 불러오기 (doGet)
 * 3. CORS(교차 출처 리소스 공유) 허용
 */

// 전역 설정
const SHEET_NAME = "GameData";

function doGet(e) {
  return handleRequest(e);
}

function doPost(e) {
  return handleRequest(e);
}

function handleRequest(e) {
  // CORS 해결을 위한 Lock 서비스 사용 (동시 접속 충돌 방지)
  const lock = LockService.getScriptLock();
  lock.tryLock(10000);

  try {
    const sheet = getSheet();
    const action = e.parameter.action;
    
    let result = {};

    if (action === "load") {
      // 데이터 불러오기 (마지막으로 저장된 게임 상태)
      const data = sheet.getRange("A1").getValue();
      result = { status: "success", data: data ? JSON.parse(data) : null };
    
    } else if (action === "save") {
      // 데이터 저장하기 (전체 JSON을 A1 셀에 덮어쓰기)
      // *주의: 이미지는 Base64로 변환되므로 텍스트 양이 많습니다.
      const requestData = JSON.parse(e.postData.contents);
      const jsonString = JSON.stringify(requestData);
      
      // A1 셀에 모든 게임 데이터 저장
      sheet.getRange("A1").setValue(jsonString);
      result = { status: "success", message: "게임이 저장되었습니다." };
    }

    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
    
  } finally {
    lock.releaseLock();
  }
}

// 시트가 없으면 생성하고 가져오는 헬퍼 함수
function getSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    // A1 셀이 너무 작게 보이지 않도록 열 너비 조정 (선택 사항)
    sheet.setColumnWidth(1, 500); 
  }
  return sheet;
}
