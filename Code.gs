// Code.gs
// Google Apps Script Web App은 배포 시 자동으로 CORS를 처리합니다.
// setHeaders() 메서드는 ContentService에서 지원하지 않으므로 제거합니다.

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.tryLock(10000);

  try {
    const params = JSON.parse(e.postData.contents);
    const targetUrl = params.targetSheetUrl; // 프론트에서 보낸 사용자 시트 주소
    const gameData = params.gameData; // 게임 전체 데이터 (JSON)

    // 사용자의 시트 열기
    const ss = SpreadsheetApp.openByUrl(targetUrl);
    
    // 'GameData'라는 탭이 없으면 생성, 있으면 가져오기
    let sheet = ss.getSheetByName("GameData");
    if (!sheet) {
      sheet = ss.insertSheet("GameData");
    }

    // A1 셀에 전체 데이터 덮어쓰기
    // (이미지가 포함되어 있으므로 셀 하나에 긴 문자열로 저장)
    sheet.getRange("A1").setValue(gameData); // 이미 JSON.stringify된 문자열

    const response = {
      status: "success",
      message: "게임 데이터가 성공적으로 저장되었습니다."
    };

    return ContentService.createTextOutput(JSON.stringify(response))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    const errorResponse = {
      status: "error",
      message: err.toString()
    };
    
    return ContentService.createTextOutput(JSON.stringify(errorResponse))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

function doGet(e) {
  try {
    const targetUrl = decodeURIComponent(e.parameter.targetSheetUrl);
    
    if (!targetUrl) {
      return ContentService.createTextOutput(JSON.stringify({ 
        status: "error", 
        message: "targetSheetUrl 파라미터가 필요합니다." 
      }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    const ss = SpreadsheetApp.openByUrl(targetUrl);
    const sheet = ss.getSheetByName("GameData");
    
    if (!sheet) {
      return ContentService.createTextOutput(JSON.stringify({ 
        status: "empty",
        message: "GameData 시트를 찾을 수 없습니다."
      }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    const data = sheet.getRange("A1").getValue();
    
    if (!data || data.trim() === '') {
      return ContentService.createTextOutput(JSON.stringify({ 
        status: "empty",
        message: "저장된 데이터가 없습니다."
      }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // 데이터가 이미 JSON 문자열인지 확인
    let parsedData;
    try {
      parsedData = typeof data === 'string' ? JSON.parse(data) : data;
    } catch (parseError) {
      // 파싱 실패 시 원본 데이터 반환
      parsedData = data;
    }
    
    return ContentService.createTextOutput(JSON.stringify({ 
      status: "success", 
      data: parsedData 
    }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ 
      status: "error", 
      message: err.toString() 
    }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
