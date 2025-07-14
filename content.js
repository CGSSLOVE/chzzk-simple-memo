let streamerMemos = {};

const LIST_NICKNAME_SELECTOR = '.name_text__yQG50';
const LIVE_TITLE_SELECTOR = 'h2.video_information_title__jrLfG';
const LIVE_STREAMER_NAME_TEXT_SELECTOR = '.video_information_channel__SpJgm .name_text__yQG50';
const LIVE_INFO_PARENT_SELECTOR = 'div.video_information_row__HrQ0z'; 

async function main() {
  console.log("[치지직 메모] 메인 함수 실행 시작!");
  const result = await new Promise(resolve => {
    chrome.storage.local.get(['memos', 'streamerMemos'], resolve);
  });
  
  streamerMemos = result.memos || {}; 
  if (Object.keys(streamerMemos).length === 0 && result.streamerMemos) {
      streamerMemos = result.streamerMemos;
      await new Promise(resolve => {
          chrome.storage.local.set({memos: streamerMemos, streamerMemos: undefined}, resolve);
      });
      console.log("[치지직 메모] 기존 메모 데이터 'streamerMemos'에서 'memos'로 마이그레이션 완료.");
  }
  console.log("[치지직 메모] 저장된 메모 불러오기 완료:", streamerMemos);
  
  checkAndApplyMemoByUrl();

  let lastUrl = window.location.href;
  const urlChangeObserver = new MutationObserver(() => {
      // URL 변경 감지: 지연 없이 바로 확인하여 더 빠르게 반응
      if (window.location.href !== lastUrl) {
          console.log("[치지직 메모] URL 변경 감지 (확정):", lastUrl, "->", window.location.href);
          lastUrl = window.location.href;
          checkAndApplyMemoByUrl();
      }
  });
  // attributeFilter 제거하여 모든 속성 변화를 감지 (URL 변화 감지 강화)
  urlChangeObserver.observe(document.body, { subtree: true, childList: true, attributes: true }); 
}

function checkAndApplyMemoByUrl() {
    stopLivePageObservation(); 
    stopListPagesObservation(); 

    if (window.location.href.includes('/live/') || window.location.href.includes('/video/')) {
        console.log("[치지직 메모] 현재 페이지: 라이브 또는 VOD 시청 페이지 로직 시작");
        startObservingLivePage();
    } else {
        console.log("[치지직 메모] 현재 페이지: 일반 목록 페이지 로직 시작");
        initializeListPages();
    }
}

let listPageObserver = null;
function initializeListPages() {
    stopListPagesObservation(); 
    
    document.addEventListener('DOMContentLoaded', applyMemosToListItems);
    window.addEventListener('load', applyMemosToListItems);

    listPageObserver = new MutationObserver((mutations) => {
      let appliedCount = 0;
      for (const mutation of mutations) {
        if (mutation.addedNodes.length) {
          for (const node of mutation.addedNodes) {
            if (node.nodeType === Node.ELEMENT_NODE) { 
              if (node.matches('li')) { 
                if (applyMemoToStreamerInList(node)) appliedCount++;
              }
              if (node.querySelector && node.querySelector('li')) {
                node.querySelectorAll('li').forEach(liNode => {
                  if (applyMemoToStreamerInList(liNode)) appliedCount++;
                });
              }
            }
          }
        }
      }
      if (appliedCount > 0) {
        console.log(`[치지직 메모] 새로운 li 요소에 메모 ${appliedCount}개 적용 시도 완료.`);
      }
    });
    listPageObserver.observe(document.body, { childList: true, subtree: true });

    applyMemosToListItems();
}

function stopListPagesObservation() {
    if (listPageObserver) {
        listPageObserver.disconnect();
        listPageObserver = null;
        console.log("[치지직 메모] 목록 페이지 옵저버 정지.");
    }
}


function applyMemoToStreamerInList(streamerNode) {
  const nicknameElement = streamerNode.querySelector(LIST_NICKNAME_SELECTOR);

  if (!nicknameElement) { return false; }
  if (streamerNode.querySelector('.streamer-memo-container')) { return true; }

  const streamerName = nicknameElement.textContent.trim();
  if (!streamerName) return false;

  const memoContainer = document.createElement('span');
  memoContainer.className = 'streamer-memo-container';

  const memoSpan = document.createElement('span');
  memoSpan.className = 'streamer-memo';
  memoSpan.textContent = streamerMemos[streamerName] || '[메모]';
  memoSpan.title = '클릭해서 메모 수정';

  memoContainer.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    handleMemoClick(streamerName, memoContainer);
  });
  
  memoContainer.appendChild(memoSpan);
  nicknameElement.insertAdjacentElement('afterend', memoContainer);
  console.log("[치지직 메모] 목록 페이지 메모 추가 완료:", streamerName);
  return true;
}

function applyMemosToListItems() {
    const listItems = document.querySelectorAll('li');
    console.log(`[치지직 메모] 초기 또는 재시도 시 로드된 li 요소 개수: ${listItems.length}`);
    listItems.forEach(li => {
        applyMemoToStreamerInList(li);
    });
}

function applyMemoToStreamerInLivePage() {
    const titleElement = document.querySelector(LIVE_TITLE_SELECTOR);
    const streamerNameElement = document.querySelector(LIVE_STREAMER_NAME_TEXT_SELECTOR); 

    // 중복 방지 로직 강화: titleElement가 존재하고, 그 자식 중에 메모 컨테이너가 이미 있는지 확인
    if (titleElement && titleElement.querySelector('.streamer-memo-container')) {
        return true; 
    }

    if (!titleElement) {
        console.log("[치지직 메모] 제목 요소를 찾을 수 없음 (시청 페이지)");
        return false; 
    }
    if (!streamerNameElement || !streamerNameElement.textContent) {
        console.log("[치지직 메모] 스트리머 이름 요소를 찾을 수 없거나 텍스트 없음 (시청 페이지)");
        return false; 
    }
    
    const streamerName = streamerNameElement.textContent.trim(); 

    if (!streamerName) {
        console.log("[치지직 메모] 스트리머 이름 추출 실패 (시청 페이지)");
        return false; 
    }
    console.log("[치지직 메모] 시청 페이지에서 추출된 스트리머 이름:", streamerName);

    const memoContainer = document.createElement('span');
    memoContainer.className = 'streamer-memo-container';

    const memoSpan = document.createElement('span');
    memoSpan.className = 'streamer-memo';
    memoSpan.textContent = streamerMemos[streamerName] || '[메모]';
    memoSpan.title = '클릭해서 메모 수정';

    memoContainer.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        handleMemoClick(streamerName, memoContainer);
    });
    
    memoContainer.appendChild(memoSpan);
    titleElement.insertAdjacentElement('afterend', memoContainer);
    console.log("[치지직 메모] 시청 페이지 메모 추가 완료:", streamerName);
    return true; 
}

async function handleMemoClick(streamerName, memoContainer) {
  console.log("[치지직 메모] handleMemoClick 실행:", streamerName);
  if (memoContainer.querySelector('input')) return;

  const currentMemo = streamerMemos[streamerName] || '';
  
  memoContainer.innerHTML = `<input type="text" value="${currentMemo}" class="memo-input" placeholder="메모를 입력해주세요..">`;
  const input = memoContainer.querySelector('input');
  input.focus();

  const saveAndRestore = async () => {
    await saveMemo(streamerName, input.value, memoContainer);
  };

  input.addEventListener('blur', saveAndRestore);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      saveAndRestore();
    }
  });
}

async function saveMemo(streamerName, newMemo, container) {
  console.log("[치지직 메모] saveMemo 실행:", streamerName, newMemo);
  if (newMemo.trim()) {
    streamerMemos[streamerName] = newMemo.trim();
  } else {
    delete streamerMemos[streamerName];
  }

  await new Promise(resolve => {
    chrome.storage.local.set({memos: streamerMemos}, resolve); 
  });

  const memoSpan = document.createElement('span');
  memoSpan.className = 'streamer-memo';
  memoSpan.textContent = streamerMemos[streamerName] || '[메모]';
  memoSpan.title = '클릭해서 메모 수정';
  
  container.innerHTML = '';
  container.appendChild(memoSpan);
  console.log("[치지직 메모] 메모 저장 및 UI 업데이트 완료:", streamerName);
}

let livePageIntervalId = null; 
let livePageObserver = null; 

function startObservingLivePage() {
    console.log("[치지직 메모] startObservingLivePage 실행");
    stopLivePageObservation(); 

    let attempts = 0;
    const maxAttempts = 60; 
    const intervalTime = 500; 

    // MutationObserver 감지 시 setInterval 리셋 함수
    const resetInterval = () => {
        if (livePageIntervalId) {
            clearInterval(livePageIntervalId);
            livePageIntervalId = null;
        }
        attempts = 0; // 시도 횟수 리셋
        livePageIntervalId = setInterval(() => {
            console.log(`[치지직 메모] 시청 페이지 메모 주기적 적용 시도 중... (횟수: ${attempts + 1})`);
            if (applyMemoToStreamerInLivePage()) { 
                console.log("[치지직 메모] 시청 페이지 메모 적용 성공 (주기적 체크). 인터벌 중지.");
                clearInterval(livePageIntervalId);
                livePageIntervalId = null; 
            } else {
                attempts++;
                if (attempts >= maxAttempts) {
                    console.warn("[치지직 메모] 시청 페이지 메모 적용 실패: 최대 시도 횟수 도달. 주기적 체크 중지.");
                    clearInterval(livePageIntervalId);
                    livePageIntervalId = null;
                }
            }
        }, intervalTime);
    };

    const targetNode = document.querySelector(LIVE_INFO_PARENT_SELECTOR);
    const observeTarget = targetNode || document.body;
    console.log("[치지직 메모] 라이브 페이지 감시 대상:", observeTarget === document.body ? "body" : LIVE_INFO_PARENT_SELECTOR);

    livePageObserver = new MutationObserver((mutations) => {
        // MutationObserver 감지 시 setInterval 리셋. 
        // 이미 메모가 있다면 불필요한 재시작 방지 (중복 메모의 핵심 해결)
        if (!document.querySelector(LIVE_TITLE_SELECTOR + ' + .streamer-memo-container')) {
            console.log("[치지직 메모] MutationObserver 감지됨 (시청 페이지 변화), 주기적 체크 재시작.");
            resetInterval(); 
        } else {
            // 메모가 이미 삽입되어 있는 경우에도 여전히 감지되는 변화는 무시 (불필요한 로깅 줄임)
            // console.log("[치지직 메모] MutationObserver 감지됨 (메모 이미 존재).");
        }
    });
    // 감시 옵션: childList와 attributes만 감시, subtree는 false
    livePageObserver.observe(observeTarget, { childList: true, subtree: false, attributes: true, attributeFilter: ['class', 'style', 'id'] }); // ID 속성도 추가 감시

    // 초기 인터벌 시작
    resetInterval(); 
}

function stopLivePageObservation() {
    if (livePageIntervalId) {
        clearInterval(livePageIntervalId);
        livePageIntervalId = null;
        console.log("[치지직 메모] 시청 페이지 주기적 체크 인터벌 정지.");
    }
    if (livePageObserver) {
        livePageObserver.disconnect();
        livePageObserver = null;
        console.log("[치지직 메모] 시청 페이지 옵저버 정지.");
    }
}

main();
