# 63빌딩 3D 조립 애니메이션

여의도 63빌딩(63스퀘어)의 구조와 건축 순서를 설명하는 60초 세로 영상(1080×1920, 30fps).
Three.js로 씬을 만들고, Puppeteer로 프레임을 한 장씩 캡처한 뒤 FFmpeg로 MP4로 묶는다.

- 결과물: `output/63building.mp4`
- 조사 내용과 출처: `facts.md` · 씬 구성: `storyboard.md`
- 정적 모델 확인용 스크린샷: `output/static_model.png` · 10초 저해상도 테스트: `output/test_10s_lowres.mp4`

## 실행

필요한 것: Node.js 18+, FFmpeg, Chrome/Chromium.

```bash
npm install                 # three, puppeteer-core, 한글 폰트(Noto Sans KR)
node render.js              # 전체 렌더 → output/63building.mp4 (4코어 소프트웨어 렌더 기준 약 20~30분)
```

Chrome은 `PUPPETEER_EXECUTABLE_PATH` → `/opt/pw-browsers/chromium` → 시스템 chromium/chrome 순으로 찾는다.
없으면 `npm i puppeteer`(Chrome 포함)를 설치하면 그쪽을 먼저 쓴다.

```bash
node render.js --scale 0.5 --from 17 --to 27 --out output/test.mp4   # 일부 구간 저해상도 테스트
node render.js --still 57 --out output/still.png                      # t=57초 한 장
node render.js --workers 2 --crf 20 --keep-frames                     # 워커 수 / 화질 / 프레임 보존
node render.js --config other.json --out output/other.mp4             # 다른 건물 설정으로 렌더
sh sheet.sh name "3 10 25"                                            # 여러 시점 검수용 스틸 (output/check/)
```

브라우저에서 미리 보기: 프로젝트 폴더를 정적 서버로 띄우고(`npx serve .` 등)
`/src/index.html?w=540&h=960&play` (재생) 또는 `&frame=900` (특정 프레임).

## 구조

| 파일 | 역할 |
|---|---|
| `config.json` | 건물 데이터·단계·자막·카메라·조명. 코드 수정 없이 여기만 바꾸면 된다 |
| `src/main.js` | 절차적 모델링 + 프레임 기반 애니메이션 (`window.setFrame(n)`) |
| `src/index.html` | 캔버스와 자막·타임라인 오버레이(HTML/CSS) |
| `render.js` | 로컬 서버 → Puppeteer 캡처(워커별 브라우저) → FFmpeg 인코딩 |

결정론: 애니메이션은 시계가 아니라 프레임 번호의 순수 함수다. `setFrame(n)`이 `t = n / fps`로
모든 부품·카메라·조명·자막을 배치하고 한 번 렌더하므로, 어떤 순서로 캡처해도 같은 프레임이 나온다. 난수도 고정 시드.

## 다른 건물로 바꾸기 (`config.json`)

- `building`: `floors`, `basements`, `height`(총 높이), `crownHeight`(옥탑), `basementDepth`,
  `profile`(높이 비율 `t`별 평면 가로 `x`·세로 `z` — 단면 곡선은 이 점들을 매끄럽게 보간), `core` 크기, 기둥 간격(`baysX/Z`), 유리 패널 분할.
- `foundation`: 암반 깊이, 피어 격자·지름, 터파기 범위.
- `colors`: 유리·철골·콘크리트·지반 색.
- `phases`: 단계별 시작/끝 시간, 자막(`step`/`title`/`desc`), 타임라인 날짜 범위. 조립 타이밍은 각 단계 길이에 비례해 자동으로 맞춰진다.
  단계 `id`(hook, foundation, basement, steel, envelope, finish, ending)는 유지해야 한다.
- `timeline`, `labels`(3D 위치에 붙는 말풍선), `camera.keys`(시간별 타깃·방위각·고도·거리), `light`(낮→노을).

주변 지형(여의도·한강)은 `src/main.js`의 `terrain` 블록에 있다. 다른 도시라면 그 부분만 교체하면 된다.

## 알아둘 점

- 평면 치수와 단면 곡선, 코어 형태는 확인된 도면값이 아니라 비례를 맞춘 가정이다(`facts.md` 3절).
- 철골 → 슬래브·커튼월을 단계로 나눈 것은 설명용 단순화다. 실제로는 겹쳐서 진행된다.
- 소리는 없다.
