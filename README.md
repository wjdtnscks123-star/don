# 로또 번호 추천기 (6/45)

브라우저에서 **랜덤 로또 번호(1~45 중 6개)** 를 추천해주는 간단한 웹페이지입니다. 설치 없이 실행됩니다.

## 실행 방법

1. 폴더에서 `index.html`을 더블클릭해서 브라우저로 여세요.
2. **추천 받기**를 누르면 세트별 번호가 생성됩니다.

## 기능

- 1~10세트 추천
- 포함/제외 번호 지정 (쉼표/공백 구분)
- 오름차순 정렬(기본) / 정렬 안 함
- 추천 결과 **모두 복사**
- 최근 추천 기록(브라우저 `localStorage`에 저장)

## 파일 구성

- `index.html`: 화면
- `style.css`: 스타일
- `script.js`: 로직 (랜덤 생성/검증/복사/기록)

---

# 뉴스 요약 챗봇

**키워드**를 입력하면 관련 **뉴스 10개**를 찾아 제목·요약(설명)을 채팅 형태로 보여줍니다. 서버 실행이 필요합니다.

## 준비

1. **News API 키 발급**  
   [https://newsapi.org](https://newsapi.org) 에서 무료 가입 후 API Key를 복사합니다.
2. **Node.js**  
   [https://nodejs.org](https://nodejs.org) 에서 LTS 버전 설치.
3. **Gemini API 키 발급 (요약/대화 기능용)**  
   Google AI Studio에서 Gemini API 키를 발급받습니다. (키는 코드에 넣지 말고 아래 방식으로 저장)

## API 키 입력 방법 (둘 중 하나)

**방법 1 – 파일에 넣기 (추천)**  
이 폴더에 **`news-api-key.txt`** 파일을 만들고, 그 안에 **API 키만** 한 줄로 붙여넣고 저장하세요.  
(앞뒤 공백/따옴표 없이 키만 넣으면 됩니다.)

요약/대화 기능을 쓰려면 **`gemini-api-key.txt`** 도 동일하게 만들고, 그 안에 **Gemini API 키만** 한 줄로 붙여넣어 저장하세요.

**방법 2 – 터미널에서 넣기**  
서버 실행할 때 환경변수로 넣습니다 (아래 실행 방법 참고).

## 서버 실행 방법 (처음부터)

### 1. Node.js 설치 여부 확인
- **Windows:** 시작 메뉴에서 **PowerShell** 또는 **명령 프롬프트**를 연 뒤 아래 입력 후 Enter.
  ```powershell
  node -v
  ```
  버전 번호(예: v20.10.0)가 나오면 설치된 것입니다.  
  안 나오면 [https://nodejs.org](https://nodejs.org) 에서 **LTS** 버전을 받아 설치한 뒤, 터미널을 다시 연다.

### 2. 프로젝트 폴더로 이동
- **Cursor / VS Code** 에서 이 프로젝트를 연 상태라면: 상단 메뉴 **터미널 → 새 터미널** 을 누르면 이미 이 폴더에서 열린다.
- **직접 터미널을 연 경우** 에는, `bird` 폴더가 있는 위치로 이동한다.  
  예: 바탕화면의 `bird` 라면
  ```powershell
  cd C:\Users\1\Desktop\bird
  ```
  (본인 경로에 맞게 `C:\Users\1\Desktop\bird` 부분을 바꾼다.)

### 3. API 키 준비
- 이 폴더에 **`news-api-key.txt`** 파일을 만들고, News API 키를 **한 줄**로 붙여넣어 저장한다.
- 요약/대화 기능을 쓰려면 **`gemini-api-key.txt`** 파일도 만들고, Gemini 키를 **한 줄**로 붙여넣어 저장한다.

### 4. 서버 실행
- 같은 터미널에서 아래만 입력하고 Enter.
  ```powershell
  node news-server.js
  ```
- `News chat server: http://localhost:3080` 이라고 나오면 성공이다.

### 5. 브라우저에서 열기
- 브라우저 주소창에 서버가 출력한 주소(예: **http://localhost:3081**) 입력 후 접속.
- 채팅창에 키워드(예: `인공지능`, `주식`)를 입력하고 **검색** 또는 Enter를 누른다.

## 사용 팁

- **뉴스 검색**: Enter
- **수집 뉴스로 대화 질문**: Shift + Enter

---

**서버 끄기:** 터미널에서 `Ctrl + C` 를 누른다.

## 파일 구성

- `news-chat.html`: 채팅 UI
- `news-chat.css`: 스타일
- `news-chat.js`: 채팅·API 호출 로직
- `news-server.js`: 정적 파일 제공 + `/api/news` (News API 호출)

