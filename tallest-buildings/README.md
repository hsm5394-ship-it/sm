# 세계에서 가장 높은 건물 TOP 20

20위부터 1위까지 건물이 차례로 올라오는 스카이라인 카운트다운 영상(인스타그램용, 42초).

- `tallest_top20_reels.mp4`: 1080×1920 (릴스)
- `tallest_top20_feed.mp4`: 1080×1350 (피드 4:5)
- `*_last.png`: 마지막 장면(전체 스카이라인과 순위표)
- `buildings.py`: 순위·이름·도시·높이·완공 연도·실루엣 스타일

기준은 2026년 완공 건물, CTBUH 건축 높이(안테나 제외, 첨탑 포함)다. 실루엣은 높이만 실제 비율이고 모양은 단순화했다. 롯데월드타워는 금색으로 강조한다.

다시 렌더링:

    python3 render.py 1080 1920 out.mp4
    python3 music.py out.mp4.json bgm.wav
    ffmpeg -i out.mp4 -i bgm.wav -c:v copy -c:a aac -shortest final.mp4
