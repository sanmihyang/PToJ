# P를 위한 J

서버 없이 동작하는 일정 로드맵(flow chart) 웹 앱. 데이터는 브라우저(localStorage)에 저장됩니다.

- 배포 주소: https://sanmihyang.github.io/PToJ/
- 기획/개발 문서: 저장소 루트의 `planning_ops/`, `planning_dev/`, `doc/data/`

## 실행

```bash
npm install
npm run dev      # 개발 서버
npm test         # 테스트
npm run lint     # 린트
npm run build    # 빌드 (dist/)
npm run preview  # 빌드 결과 미리보기 (http://localhost:4173/PToJ/)
```

## 배포 (GitHub Pages)

1. sanmihyang/PToJ 저장소 Settings > Pages > Source 를 **GitHub Actions** 로 설정
2. main 브랜치에 push 하면 `.github/workflows/deploy.yml` 이 빌드 후 배포
3. 라우팅은 해시(`#/`) 방식이라 새로고침해도 404가 나지 않음
