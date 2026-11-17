# KBO 통산 홈런 TOP 10 변화 (1982–2026)

인스타그램용 막대 레이스 영상.

- `kbo_hr_top10_reels.mp4`: 1080×1920 (릴스), 약 46초 (인트로·엔딩·배경음 포함)
- `kbo_hr_top10_feed.mp4`: 1080×1350 (피드 4:5)
- `*_last.png`: 2026 최종 순위 정지 이미지
- `data.py` / `season_hr.csv`: 선수별 시즌 홈런

다시 렌더링:

    pip install matplotlib
    python3 render.py 1080 1920 kbo_hr_top10_reels.mp4
    python3 render.py 1080 1350 kbo_hr_top10_feed.mp4
    python3 music.py kbo_hr_top10_reels.mp4.json bgm.wav   (배경음 합성 후 ffmpeg로 영상과 합치기)

## 데이터 상태
- 통산 합계(25명)와 2026 시즌 수치(최정 538, 최형우 437, 강민호 363)는 기사로 확인함.
- 일부 시즌별 분배, 특히 1980~90년대 중하위권 선수는 검증 전 초안이다. 게시 전 KBO 기록실이나 스탯티즈와 대조할 것.

# KBO 통산 도루 TOP 10 변화 (1982–2026)

- `kbo_sb_top10_reels.mp4` (1080×1920), `kbo_sb_top10_feed.mp4` (1080×1350), `kbo_sb_top10_*_last.png`
- 데이터: `data_sb.py` / `season_sb.csv`
- 렌더링: `python3 render.py 1080 1920 kbo_sb_top10_reels.mp4 sb`
- 통산 합계(전준호 549, 이종범 510, 이대형 505, 박해민 502, 정수근 474 등 13명)는 확인함. 시즌별 분배와 1980~90년대 선수(김응국, 이강돈, 이정훈, 이종운 등)의 수치는 검증 전 초안이다.
