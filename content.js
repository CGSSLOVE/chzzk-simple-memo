// 스트리머 닉네임을 기반으로 메모를 저장할 객체
let streamerMemos = {};

// 치지직 방송 목록 (전체 방송, 팔로잉 채널)에서 스트리머 닉네임이 있는 요소의 클래스 이름
const LIST_NICKNAME_SELECTOR = '.name_text__yQG50';

// 치지직 방송 시청 페이지에서 방송 제목 선택자
const LIVE_TITLE_SELECTOR = 'h2.video_information_title__jrLfG'; // 방송 제목
// 치지직 방송 시청 페이지에서 스트리머 링크 선택자 (이 링크에서 스트리머 ID를 추출)
const LIVE_STREAMER_LINK_SELECTOR = 'a.video_information_link__2OrbG'; 

// 저장소에서 메모를 불러와 화면에 적용하는 메인 함수
async function main() {
  console.log("메인 함수 실행 시작!");
  const result = await new Promise(resolve => {
    chrome.storage.local.get(['streamerMemos'], resolve);
  });
  streamerMemos = result.streamerMemos || {};
  console.log("저장된 메모 불러오기 완료:", streamerMemos);
  
  if (window.location.href.includes('/live/')) {
    console.log("현재 페이지: 라이브 시청 페이지");
    observeLivePageAndApplyMemo();
  } else {
    console.log("현재 페이지: 일반 목록 페이지 (전체/팔로잉)");
    
    document.addEventListener('DOMContentLoaded', () => {
        console.log("DOMContentLoaded 이벤트 발생 (목록 페이지)");
        applyMemosToListItems();
    });

    window.addEventListener('load', () => {
        console.log("window.load 이벤트 발생 (목록 페이지)");
        applyMemosToListItems();
    });

    const observer = new MutationObserver((mutations) => {
      console.log("MutationObserver 감지됨 (목록 페이지 변화)");
      let appliedCount = 0;
      for (const mutation of mutations) {
        if (mutation.addedNodes.length) {
          mutation.addedNodes.forEach(node => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              if (node.matches('li')) {
                applyMemoToStreamerInList(node);
                appliedCount++;
              }
              node.querySelectorAll('li').forEach(liNode => {
                applyMemoToStreamerInList(liNode);
                appliedCount++;
              });
            }
          });
        }
      }
      if (appliedCount > 0) {
        console.log(`새로운 li 요소에 메모 ${appliedCount}개 적용 시도 완료.`);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }
}

// 방송 목록 아이템에 메모를 적용하는 함수
function applyMemoToStreamerInList(streamerNode) {
  const nicknameElement = streamerNode.querySelector(LIST_NICKNAME_SELECTOR);

  if (!nicknameElement || streamerNode.querySelector('.streamer-memo-container')) {
    return;
  }

  const streamerName = nicknameElement.textContent.trim();
  if (!streamerName) return;

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
  console.log("목록 페이지 메모 추가 완료:", streamerName);
}

// 페이지에 현재 존재하는 모든 li 요소에 메모 적용 시도 (초기 로딩 및 재시도용)
function applyMemosToListItems() {
    const listItems = document.querySelectorAll('li');
    console.log(`초기 또는 재시도 시 로드된 li 요소 개수: ${listItems.length}`);
    listItems.forEach(li => {
        if (!li.querySelector('.streamer-memo-container')) {
            applyMemoToStreamerInList(li);
        }
    });
}


// 방송 시청 페이지에 메모를 적용하는 함수
function applyMemoToStreamerInLivePage() {
    console.log("applyMemoToStreamerInLivePage 실행");
    const titleElement = document.querySelector(LIVE_TITLE_SELECTOR);
    const streamerLinkElement = document.querySelector(LIVE_STREAMER_LINK_SELECTOR); // 스트리머 링크 요소

    if (!titleElement) {
        console.log("제목 요소를 찾을 수 없음 (시청 페이지)");
        return;
    }
    if (!streamerLinkElement || !streamerLinkElement.href) {
        console.log("스트리머 링크 요소를 찾을 수 없거나 href 없음 (시청 페이지)");
        return;
    }
    if (titleElement.querySelector('.streamer-memo-container')) {
        console.log("이미 메모 컨테이너 존재 (시청 페이지)");
        return;
    }

    // href 속성에서 스트리머 ID 또는 닉네임을 추출
    // 예: https://chzzk.naver.com/bdc57cc4217173f0e89f63fba2f1c6e5 -> bdc57cc4217173f0e89f63fba2f1c6e5 추출
    const href = streamerLinkElement.href;
    const parts = href.split('/');
    // 보통 마지막 부분이 ID나 닉네임일 가능성이 높습니다.
    // 만약 스트리머ID가 고유한 키로 적합하다면 이 값을 streamerName으로 사용
    const streamerId = parts[parts.length - 1]; 
    
    // 이 ID를 메모의 키로 사용합니다. 실제 닉네임 텍스트는 사이트에 따라 다르게 표시될 수 있습니다.
    // 만약 메모를 실제 닉네임으로 저장하고 싶다면, 이 ID로 API 호출을 통해 닉네임을 가져와야 합니다.
    // 일단 여기서는 추출된 ID를 메모 키로 사용하고, 화면에는 "[메모]"로 표시하겠습니다.
    // 실제 닉네임을 가져오는 로직은 나중에 추가할 수 있습니다.
    const streamerName = streamerId; // 메모의 키로 사용할 스트리머 이름/ID

    if (!streamerName) {
        console.log("스트리머 이름/ID 추출 실패 (시청 페이지)");
        return;
    }
    console.log("시청 페이지에서 추출된 스트리머 ID:", streamerName);


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
    console.log("시청 페이지 메모 추가 완료:", streamerName);
}

// 메모 클릭 시 입력 필드를 띄우고 저장하는 공통 로직
async function handleMemoClick(streamerName, memoContainer) {
  console.log("handleMemoClick 실행:", streamerName);
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

// 메모를 저장하고 UI를 업데이트하는 함수
async function saveMemo(streamerName, newMemo, container) {
  console.log("saveMemo 실행:", streamerName, newMemo);
  if (newMemo.trim()) {
    streamerMemos[streamerName] = newMemo.trim();
  } else {
    delete streamerMemos[streamerName];
  }

  await new Promise(resolve => {
    chrome.storage.local.set({ streamerMemos }, resolve);
  });

  // UI를 다시 텍스트 형태로 복원
  const memoSpan = document.createElement('span');
  memoSpan.className = 'streamer-memo';
  memoSpan.textContent = streamerMemos[streamerName] || '[메모]';
  memoSpan.title = '클릭해서 메모 수정';
  
  container.innerHTML = '';
  container.appendChild(memoSpan);
  console.log("메모 저장 및 UI 업데이트 완료:", streamerName);
}

// 라이브 시청 페이지의 동적인 변화를 감지하고 메모를 적용하는 함수
function observeLivePageAndApplyMemo() {
  console.log("observeLivePageAndApplyMemo 실행");
  // DOMContentLoaded 시점에 한 번 시도
  applyMemoToStreamerInLivePage();

  // 방송 제목, 스트리머 링크 등이 동적으로 로드되거나 변경될 수 있으므로 MutationObserver 사용
  const observer = new MutationObserver((mutations) => {
    console.log("MutationObserver 감지됨 (시청 페이지)");
    let titleFound = document.querySelector(LIVE_TITLE_SELECTOR);
    let streamerLinkFound = document.querySelector(LIVE_STREAMER_LINK_SELECTOR);
    let memoContainerExists = document.querySelector(LIVE_TITLE_SELECTOR + ' + .streamer-memo-container');

    // 제목과 스트리머 링크가 모두 있고, 아직 메모 컨테이너가 없으면 적용
    if (titleFound && streamerLinkFound && !memoContainerExists) {
      console.log("새로운 제목/스트리머 링크 감지, 시청 페이지 메모 적용 시도");
      applyMemoToStreamerInLivePage();
    }
  });

  // 방송 정보 영역 전체 또는 body를 감시
  observer.observe(document.body, { childList: true, subtree: true });
}

// 스크립트 실행 시작
main();
