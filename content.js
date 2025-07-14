// 스트리머 닉네임을 기반으로 메모를 저장할 객체
let streamerMemos = {};

// 스트리머 닉네임이 있는 요소의 클래스 이름
const NICKNAME_SELECTOR = '.name_text__yQG50';

// 저장소에서 메모를 불러와 화면에 적용하는 함수
function loadMemosAndApply() {
  chrome.storage.local.get(['streamerMemos'], (result) => {
    streamerMemos = result.streamerMemos || {};
    // 페이지의 모든 방송 목록 아이템을 대상으로 함수 실행
    document.querySelectorAll('li').forEach(applyMemoToStreamer);
  });
}

// 각 방송 아이템에 메모를 적용하는 함수
function applyMemoToStreamer(streamerNode) {
  const nicknameElement = streamerNode.querySelector(NICKNAME_SELECTOR);

  // 닉네임 요소가 없거나, 이미 메모가 추가된 경우 중복 실행 방지
  if (!nicknameElement || streamerNode.querySelector('.streamer-memo-container')) {
    return;
  }

  const streamerName = nicknameElement.textContent.trim();
  if (!streamerName) return;

  // 메모를 감쌀 컨테이너 생성
  const memoContainer = document.createElement('span');
  memoContainer.className = 'streamer-memo-container';

  // 메모 내용을 표시할 요소 생성
  const memoSpan = document.createElement('span');
  memoSpan.className = 'streamer-memo';
  memoSpan.textContent = streamerMemos[streamerName] || '[메모]'; // 메모가 없으면 '[메모]'라고 표시
  memoSpan.title = '클릭해서 메모 수정';

  // 메모 수정/저장 로직
  memoContainer.addEventListener('click', (event) => {
    event.preventDefault();  // 링크 이동 등 기본 동작을 막습니다.
    event.stopPropagation(); // 클릭 이벤트가 부모에게 전달되는 것을 막습니다.

    // 이미 수정 중이면 아무것도 안 함
    if (memoContainer.querySelector('input')) return;

    const currentMemo = streamerMemos[streamerName] || '';

    // 텍스트를 입력창으로 변경
    memoContainer.innerHTML = `<input type="text" value="${currentMemo}" class="memo-input" placeholder="메모를 입력해주세요..">`;
    const input = memoContainer.querySelector('input');
    input.focus();

    // 입력창에서 포커스가 벗어나면 저장
    input.addEventListener('blur', () => {
      saveMemo(streamerName, input.value, memoContainer);
    });

    // 엔터 키를 눌러도 저장
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        saveMemo(streamerName, input.value, memoContainer);
      }
    });
  });

  memoContainer.appendChild(memoSpan);
  // 닉네임 요소 바로 뒤에 메모 컨테이너 삽입
  nicknameElement.insertAdjacentElement('afterend', memoContainer);
}

// 메모를 저장하고 UI를 업데이트하는 함수
function saveMemo(streamerName, newMemo, container) {
  if (newMemo.trim()) {
    streamerMemos[streamerName] = newMemo.trim();
  } else {
    // 메모 내용이 비어있으면 해당 메모 삭제
    delete streamerMemos[streamerName];
  }

  // 변경된 메모 객체를 저장소에 저장
  chrome.storage.local.set({ streamerMemos: streamerMemos }, () => {
    // UI를 다시 텍스트 형태로 복원
    const memoSpan = document.createElement('span');
    memoSpan.className = 'streamer-memo';
    memoSpan.textContent = streamerMemos[streamerName] || '[메모]';
    memoSpan.title = '클릭해서 메모 수정';

    container.innerHTML = ''; // 기존 input 삭제
    container.appendChild(memoSpan);
  });
}

// 페이지에 새로운 방송 목록이 추가되는 것을 감지하여 자동으로 메모 적용
const observer = new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    if (mutation.addedNodes.length) {
      // 추가된 노드들 중에서 방송 목록(li)이 있는지 확인
      mutation.addedNodes.forEach(node => {
        if (node.nodeType === 1 && node.matches('li')) {
          applyMemoToStreamer(node);
        }
        // 자식 노드들도 검사
        if (node.querySelectorAll) {
            node.querySelectorAll('li').forEach(applyMemoToStreamer);
        }
      });
    }
  });
});

// body 전체의 변화를 감시 시작
observer.observe(document.body, { childList: true, subtree: true });

// 페이지가 처음 로드될 때 함수 실행
loadMemosAndApply();
