/**
 * 주간 시간표 웹 애플리케이션 (Vanilla JS)
 * - 클린 코드 및 모던 웹 아키텍처
 * - 내 시간표 / 친구 시간표 전환 및 '시간표 겹쳐보기' (공통 공강 시간 자동 하이라이트)
 */

// 요일 및 시간 상수 설정
const DAYS = [
  { key: 'mon', label: '월', colIndex: 2 },
  { key: 'tue', label: '화', colIndex: 3 },
  { key: 'wed', label: '수', colIndex: 4 },
  { key: 'thu', label: '목', colIndex: 5 },
  { key: 'fri', label: '금', colIndex: 6 },
];

const START_HOUR = 9;  // 09:00
const END_HOUR = 18;   // 18:00

const STORAGE_KEYS = {
  my: 'timetable_my_courses_v2',
  friend: 'timetable_friend_courses_v2',
};

// 기본 샘플 친구 시간표 (초기 체험용)
const DEFAULT_FRIEND_COURSES = [
  {
    id: 'sample-f1',
    title: '데이터베이스',
    room: '공학관 204호',
    day: 'tue',
    start: 10,
    end: 12,
    owner: 'friend',
  },
  {
    id: 'sample-f2',
    title: '웹프로그래밍기초',
    room: 'IT관 402호',
    day: 'wed',
    start: 13,
    end: 16,
    owner: 'friend',
  },
  {
    id: 'sample-f3',
    title: '컴퓨터알고리즘',
    room: '본관 101호',
    day: 'fri',
    start: 11,
    end: 13,
    owner: 'friend',
  },
];

/**
 * 애플리케이션 상태 (State)
 */
let state = {
  currentView: 'my', // 'my' | 'friend' | 'overlay'
  myCourses: [],
  friendCourses: [],
};

/**
 * DOM 요소 캐싱
 */
const elements = {
  grid: document.getElementById('timetable-grid'),
  modal: document.getElementById('course-modal'),
  modalTitle: document.getElementById('modal-title'),
  openModalBtn: document.getElementById('open-modal-btn'),
  closeModalBtn: document.getElementById('close-modal-btn'),
  cancelModalBtn: document.getElementById('cancel-modal-btn'),
  courseForm: document.getElementById('course-form'),
  selectTarget: document.getElementById('course-target'),
  inputTitle: document.getElementById('course-title'),
  inputRoom: document.getElementById('course-room'),
  selectDay: document.getElementById('course-day'),
  selectStart: document.getElementById('course-start'),
  selectEnd: document.getElementById('course-end'),
  // 탭 제어 & 범례
  tabMy: document.getElementById('tab-my'),
  tabFriend: document.getElementById('tab-friend'),
  tabOverlay: document.getElementById('tab-overlay'),
  overlayLegend: document.getElementById('overlay-legend'),
  footerGuideText: document.getElementById('footer-guide-text'),
  // 공유 & 파일 입출력
  exportJsonBtn: document.getElementById('export-json-btn'),
  importJsonBtn: document.getElementById('import-json-btn'),
  shareUrlBtn: document.getElementById('share-url-btn'),
  jsonFileInput: document.getElementById('json-file-input'),
};

/**
 * LocalStorage 데이터 로드 및 저장
 */
function loadFromStorage() {
  try {
    const savedMy = localStorage.getItem(STORAGE_KEYS.my);
    const legacyMy = localStorage.getItem('timetable_courses_v1');
    state.myCourses = savedMy ? JSON.parse(savedMy) : (legacyMy ? JSON.parse(legacyMy) : []);

    const savedFriend = localStorage.getItem(STORAGE_KEYS.friend);
    state.friendCourses = savedFriend ? JSON.parse(savedFriend) : DEFAULT_FRIEND_COURSES;
  } catch (error) {
    console.error('데이터 복원 실패:', error);
    state.myCourses = [];
    state.friendCourses = DEFAULT_FRIEND_COURSES;
  }
}

function saveToStorage() {
  try {
    localStorage.setItem(STORAGE_KEYS.my, JSON.stringify(state.myCourses));
    localStorage.setItem(STORAGE_KEYS.friend, JSON.stringify(state.friendCourses));
  } catch (error) {
    console.error('데이터 저장 실패:', error);
  }
}

/**
 * UTF-8 Base64 인코딩 / 디코딩
 */
function encodeData(data) {
  const jsonString = JSON.stringify(data);
  const utf8Bytes = new TextEncoder().encode(jsonString);
  let binary = '';
  for (let i = 0; i < utf8Bytes.length; i++) {
    binary += String.fromCharCode(utf8Bytes[i]);
  }
  return encodeURIComponent(btoa(binary));
}

function decodeData(encodedString) {
  const binary = atob(decodeURIComponent(encodedString));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const jsonString = new TextDecoder().decode(bytes);
  return JSON.parse(jsonString);
}

/**
 * 특정 시간 슬롯이 공통 공강인지 판별
 */
function isCommonFreeSlot(dayKey, hour) {
  const myHasClass = state.myCourses.some(
    (c) => c.day === dayKey && hour >= c.start && hour < c.end
  );
  const friendHasClass = state.friendCourses.some(
    (c) => c.day === dayKey && hour >= c.start && hour < c.end
  );
  return !myHasClass && !friendHasClass;
}

/**
 * 그리드 기본 배경 구조 렌더링 (시간 라벨 및 배경 셀)
 */
function renderGridStructure() {
  // 헤더 6개를 제외한 동적 요소 초기화
  while (elements.grid.children.length > 6) {
    elements.grid.removeChild(elements.grid.lastChild);
  }

  const isOverlayMode = state.currentView === 'overlay';

  // 9시부터 17시까지 9개 시간 행 생성
  for (let hour = START_HOUR; hour < END_HOUR; hour++) {
    const rowIndex = hour - START_HOUR + 2; // Row 1은 헤더

    // 1. 좌측 시간 표시 셀 (1열)
    const timeLabel = document.createElement('div');
    timeLabel.className = 'time-slot-label';
    timeLabel.style.gridColumn = '1';
    timeLabel.style.gridRow = `${rowIndex}`;
    timeLabel.textContent = `${String(hour).padStart(2, '0')}:00`;
    elements.grid.appendChild(timeLabel);

    // 2. 월~금 배경 격자 셀 (2열~6열)
    DAYS.forEach((day) => {
      const cell = document.createElement('div');
      cell.className = 'grid-cell';
      cell.style.gridColumn = `${day.colIndex}`;
      cell.style.gridRow = `${rowIndex}`;

      // 겹쳐보기 모드일 때 두 사람 모두 수업이 없으면 공통 공강 하이라이트
      if (isOverlayMode && isCommonFreeSlot(day.key, hour)) {
        cell.classList.add('common-free-slot');
      }

      elements.grid.appendChild(cell);
    });
  }
}

/**
 * 수업 카드 렌더링
 */
function renderCourses() {
  const existingCards = elements.grid.querySelectorAll('.course-card');
  existingCards.forEach((card) => card.remove());

  let coursesToRender = [];
  const view = state.currentView;

  if (view === 'my') {
    coursesToRender = state.myCourses.map((c) => ({ ...c, owner: 'my' }));
  } else if (view === 'friend') {
    coursesToRender = state.friendCourses.map((c) => ({ ...c, owner: 'friend' }));
  } else {
    // 겹쳐보기 모드: 두 시간표 모두 포함
    coursesToRender = [
      ...state.myCourses.map((c) => ({ ...c, owner: 'my' })),
      ...state.friendCourses.map((c) => ({ ...c, owner: 'friend' })),
    ];
  }

  coursesToRender.forEach((course) => {
    const dayObj = DAYS.find((d) => d.key === course.day);
    if (!dayObj) return;

    const colStart = dayObj.colIndex;
    const rowStart = course.start - START_HOUR + 2;
    const rowEnd = course.end - START_HOUR + 2;

    const card = document.createElement('div');
    card.className = 'course-card';
    card.dataset.id = course.id;
    card.dataset.owner = course.owner;

    card.style.gridColumn = `${colStart}`;
    card.style.gridRow = `${rowStart} / ${rowEnd}`;

    // 색상 구분 (나: 블루 계열, 친구: 주황 계열)
    const isMy = course.owner === 'my';
    if (isMy) {
      card.style.backgroundColor = '#eff6ff';
      card.style.borderColor = '#bfdbfe';
      card.style.borderWidth = '1px';
      card.style.borderStyle = 'solid';
      card.style.color = '#1e40af';
    } else {
      card.style.backgroundColor = '#fff7ed';
      card.style.borderColor = '#fed7aa';
      card.style.borderWidth = '1px';
      card.style.borderStyle = 'solid';
      card.style.color = '#9a3412';
    }

    // 겹쳐보기 모드 시 좌우 분할 클래스 적용
    if (view === 'overlay') {
      card.classList.add(isMy ? 'overlay-my' : 'overlay-friend');
    }

    const badgeText = isMy ? '👤 나' : '👥 친구';
    const badgeClass = isMy ? 'badge-my' : 'badge-friend';

    card.innerHTML = `
      <span class="delete-badge" title="클릭 시 삭제">✕</span>
      <div>
        <span class="course-badge ${badgeClass}">${badgeText}</span>
        <div class="course-name">${escapeHtml(course.title)}</div>
      </div>
      <div>
        <div class="course-info">📍 ${escapeHtml(course.room)}</div>
        <div class="course-info">${String(course.start).padStart(2, '0')}:00 - ${String(course.end).padStart(2, '0')}:00</div>
      </div>
    `;

    card.addEventListener('click', () => handleDeleteCourse(course.id, course.title, course.owner));
    elements.grid.appendChild(card);
  });
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * 뷰 전환 처리 ('my' | 'friend' | 'overlay')
 */
function switchView(viewName) {
  state.currentView = viewName;

  // 탭 스타일 활성화
  elements.tabMy.classList.toggle('active', viewName === 'my');
  elements.tabFriend.classList.toggle('active', viewName === 'friend');
  elements.tabOverlay.classList.toggle('active', viewName === 'overlay');

  // 범례 표시 여부
  elements.overlayLegend.classList.toggle('hidden', viewName !== 'overlay');

  // 안내 텍스트 변경
  if (viewName === 'overlay') {
    elements.footerGuideText.textContent =
      '✨ 겹쳐보기 모드: 좌측(파란색)은 내 수업, 우측(주황색)은 친구 수업이며 연초록색 칸은 둘 다 비어있는 공통 공강입니다.';
  } else if (viewName === 'friend') {
    elements.footerGuideText.textContent =
      '👥 친구 시간표를 보고 있습니다. 수업을 추가하거나 클릭하여 수정/삭제할 수 있습니다.';
  } else {
    elements.footerGuideText.textContent =
      '👤 내 시간표를 보고 있습니다. 등록된 수업을 클릭하면 삭제할 수 있습니다.';
  }

  // 그리드 배경 및 수업 재렌더링
  renderGridStructure();
  renderCourses();
}

/**
 * 모달 열기 및 닫기
 */
function openModal() {
  elements.courseForm.reset();
  // 현재 보고 있는 탭에 맞춰 등록 대상 기본 선택
  elements.selectTarget.value = state.currentView === 'friend' ? 'friend' : 'my';
  elements.selectStart.value = '9';
  elements.selectEnd.value = '11';
  elements.modal.classList.remove('hidden');
  elements.inputTitle.focus();
}

function closeModal() {
  elements.modal.classList.add('hidden');
}

/**
 * 수업 등록 처리
 */
function handleAddCourse(event) {
  event.preventDefault();

  const target = elements.selectTarget.value; // 'my' | 'friend'
  const title = elements.inputTitle.value.trim();
  const room = elements.inputRoom.value.trim();
  const day = elements.selectDay.value;
  const start = parseInt(elements.selectStart.value, 10);
  const end = parseInt(elements.selectEnd.value, 10);

  // 1. 유효성 검사: 종료 > 시작
  if (end <= start) {
    alert('종료 시간은 시작 시간보다 늦어야 합니다.');
    elements.selectEnd.focus();
    return;
  }

  // 2. 대상 시간표 가져오기
  const targetList = target === 'my' ? state.myCourses : state.friendCourses;

  // 3. 중복 검사
  const isOverlapping = targetList.some((course) => {
    if (course.day !== day) return false;
    return Math.max(start, course.start) < Math.min(end, course.end);
  });

  if (isOverlapping) {
    const ownerName = target === 'my' ? '내 시간표' : '친구 시간표';
    alert(`${ownerName}의 선택한 시간대에 이미 등록된 수업이 존재합니다.`);
    return;
  }

  // 4. 새 수업 객체 생성
  const newCourse = {
    id: Date.now().toString(),
    title,
    room,
    day,
    start,
    end,
    owner: target,
  };

  targetList.push(newCourse);
  saveToStorage();

  // 5. 화면 갱신
  renderGridStructure();
  renderCourses();
  closeModal();
}

/**
 * 수업 삭제 처리
 */
function handleDeleteCourse(id, title, owner) {
  const ownerLabel = owner === 'my' ? '내 수업' : '친구 수업';
  const isConfirmed = confirm(`'${title}' (${ownerLabel})을 삭제하시겠습니까?`);
  if (!isConfirmed) return;

  if (owner === 'my') {
    state.myCourses = state.myCourses.filter((c) => c.id !== id);
  } else {
    state.friendCourses = state.friendCourses.filter((c) => c.id !== id);
  }

  saveToStorage();
  renderGridStructure();
  renderCourses();
}

/**
 * 1. 시간표 내보내기 (JSON 다운로드)
 */
function handleExportJson() {
  const exportPayload = {
    myCourses: state.myCourses,
    friendCourses: state.friendCourses,
    exportedAt: new Date().toISOString(),
  };

  const jsonString = JSON.stringify(exportPayload, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const downloadUrl = URL.createObjectURL(blob);

  const now = new Date().toISOString().slice(0, 10);
  const anchor = document.createElement('a');
  anchor.href = downloadUrl;
  anchor.download = `timetable_compare_${now}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(downloadUrl);
}

/**
 * 2. 시간표 불러오기 (JSON 파일 업로드)
 */
function handleTriggerImport() {
  elements.jsonFileInput.click();
}

function handleFileImport(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);

      if (data.myCourses || data.friendCourses) {
        // 복합 구조 파일
        if (data.myCourses) state.myCourses = data.myCourses;
        if (data.friendCourses) state.friendCourses = data.friendCourses;
        alert('시간표 데이터를 성공적으로 불러왔습니다.');
      } else if (Array.isArray(data)) {
        // 단일 배열 파일: 어디에 반영할지 묻기
        const target = confirm(
          '불러온 시간표를 어디에 등록하시겠습니까?\n\n[확인]: 친구 시간표로 등록\n[취소]: 내 시간표로 등록'
        ) ? 'friend' : 'my';

        if (target === 'friend') {
          state.friendCourses = data.map((c) => ({ ...c, owner: 'friend' }));
        } else {
          state.myCourses = data.map((c) => ({ ...c, owner: 'my' }));
        }
        alert('시간표를 성공적으로 등록했습니다.');
      } else {
        throw new Error('유효한 시간표 데이터 형식이 아닙니다.');
      }

      saveToStorage();
      renderGridStructure();
      renderCourses();
    } catch (err) {
      alert('파일 불러오기 실패: ' + err.message);
    } finally {
      elements.jsonFileInput.value = '';
    }
  };

  reader.readAsText(file);
}

/**
 * 3. 공유용 URL 생성 (Base64 인코딩 후 복사)
 */
async function handleShareUrl() {
  const sharePayload = {
    myCourses: state.myCourses,
    friendCourses: state.friendCourses,
  };

  const encoded = encodeData(sharePayload);
  const shareUrl = `${window.location.origin}${window.location.pathname}?data=${encoded}`;

  try {
    await navigator.clipboard.writeText(shareUrl);
    alert('🔗 친구와 함께 볼 수 있는 공유 URL이 복사되었습니다!\n친구에게 링크를 전달해보세요.');
  } catch (err) {
    prompt('아래 링크를 복사하여 공유하세요:', shareUrl);
  }
}

/**
 * 4. URL 파라미터에서 공유된 시간표 자동 로드
 */
function checkUrlParams() {
  const urlParams = new URLSearchParams(window.location.search);
  const encodedData = urlParams.get('data');

  if (!encodedData) return false;

  try {
    const imported = decodeData(encodedData);
    if (imported) {
      if (imported.myCourses || imported.friendCourses) {
        state.myCourses = imported.myCourses || [];
        state.friendCourses = imported.friendCourses || [];
      } else if (Array.isArray(imported)) {
        state.friendCourses = imported;
      }

      // 공유받은 링크로 진입 시 바로 '겹쳐보기' 모드로 세팅
      state.currentView = 'overlay';

      const shouldSave = confirm(
        '🔗 친구가 공유한 시간표를 불러왔습니다!\n\n이 시간표를 내 브라우저에 저장하시겠습니까?\n[확인]: 저장하기\n[취소]: 임시 확인'
      );

      if (shouldSave) {
        saveToStorage();
      }

      window.history.replaceState({}, '', window.location.pathname);
      return true;
    }
  } catch (err) {
    console.error('공유 파라미터 파싱 오류:', err);
  }

  return false;
}

/**
 * 이벤트 리스너 등록 및 초기화
 */
function init() {
  loadFromStorage();

  const loadedFromUrl = checkUrlParams();

  // 뷰 초기 렌더링
  switchView(state.currentView);

  // 탭 전환 이벤트
  elements.tabMy.addEventListener('click', () => switchView('my'));
  elements.tabFriend.addEventListener('click', () => switchView('friend'));
  elements.tabOverlay.addEventListener('click', () => switchView('overlay'));

  // 모달 제어 이벤트
  elements.openModalBtn.addEventListener('click', openModal);
  elements.closeModalBtn.addEventListener('click', closeModal);
  elements.cancelModalBtn.addEventListener('click', closeModal);

  elements.modal.addEventListener('click', (e) => {
    if (e.target === elements.modal) closeModal();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !elements.modal.classList.contains('hidden')) {
      closeModal();
    }
  });

  // 수업 등록 폼 제출 이벤트
  elements.courseForm.addEventListener('submit', handleAddCourse);

  // 파일 및 공유 이벤트
  elements.exportJsonBtn.addEventListener('click', handleExportJson);
  elements.importJsonBtn.addEventListener('click', handleTriggerImport);
  elements.jsonFileInput.addEventListener('change', handleFileImport);
  elements.shareUrlBtn.addEventListener('click', handleShareUrl);
}

// DOM 준비 완료 후 실행
document.addEventListener('DOMContentLoaded', init);
