# Roller Earth 40075 — сайт Konstantin Lyuik с результатами из Strava

Проект: кругосветное путешествие на роликах за 4 года (40 075 км — длина экватора). Официальная запись о сингапурском рекорде: https://singaporerecords.com/longest-round-singapore-inline-skating-in-24-hours/

Статический сайт (один HTML‑файл) + автоматическое обновление данных из Strava через GitHub Actions. Хостинг — GitHub Pages. Всё бесплатно; единственная возможная трата — собственный домен.

## Структура

```
index.html                  — готовая страница (собирается из src/page.html)
src/page.html               — исходник страницы (правки делать здесь, затем node scripts/build.mjs)
data/strava.json            — данные Strava (сейчас ДЕМО; обновляется автоматически)
assets/                     — фото рекорда
scripts/fetch-strava.mjs    — забирает активности из Strava API и пишет data/strava.json
scripts/get-refresh-token.mjs — одноразовое получение refresh token
scripts/build.mjs           — сборка index.html из src/page.html
scripts/serve.mjs           — локальный просмотр: node scripts/serve.mjs → http://localhost:8080
scripts/make-demo-data.py   — генератор демо‑данных (можно удалить после подключения Strava)
.github/workflows/update-strava.yml — расписание обновления (каждые 2 часа)
```

## Локальный просмотр

```bash
node scripts/build.mjs
node scripts/serve.mjs
```
Открыть http://localhost:8080 (данные пока демо).

## Запуск за 6 шагов

### 1. Создать репозиторий на GitHub
1. github.com → New repository → имя, например `konstantin-lyuik` → Public → Create.
2. Загрузить все файлы из этой папки (Add file → Upload files) или через git:
   ```bash
   git init && git add . && git commit -m "Site" && git branch -M main
   git remote add origin https://github.com/<логин>/<репозиторий>.git && git push -u origin main
   ```

### 2. Включить GitHub Pages
Settings → Pages → Source: **Deploy from a branch** → Branch: `main`, папка `/ (root)` → Save.
Через 1–2 минуты сайт доступен по адресу `https://<логин>.github.io/<репозиторий>/` (пока с демо‑данными).

### 3. Создать приложение Strava API (делает Константин со своего аккаунта)
1. Войти в Strava → https://www.strava.com/settings/api → Create an App.
2. Заполнить: Application Name — например `Konstantin Lyuik site`; Category — Visualizer; Website — адрес сайта из шага 2; **Authorization Callback Domain — `localhost`**.
3. Загрузить любую иконку (обязательное поле).
4. Записать **Client ID** и **Client Secret**.

### 4. Получить refresh token (один раз)
На компьютере с Node.js 18+ (https://nodejs.org):
```bash
STRAVA_CLIENT_ID=12345 STRAVA_CLIENT_SECRET=abc... node scripts/get-refresh-token.mjs
```
Скрипт выведет ссылку → открыть её в браузере, где выполнен вход в Strava Константина → Authorize.
Браузер перейдёт на `http://localhost/exchange_token?...&code=XXXX` (страница не откроется — это нормально). Скопировать значение `code=` из адресной строки, вставить в терминал. Скрипт выведет `STRAVA_REFRESH_TOKEN`.

### 5. Добавить секреты в GitHub
Settings → Secrets and variables → Actions → New repository secret, три штуки:
- `STRAVA_CLIENT_ID`
- `STRAVA_CLIENT_SECRET`
- `STRAVA_REFRESH_TOKEN`

Необязательно: Variables → `STRAVA_JOURNEY_START` — дата старта кругосветки в формате `YYYY-MM-DD`. Счётчик «X km of 40,075» на главной считает километры с этой даты (поле `journey` в `data/strava.json`). Пока переменная не задана — используется 2026-10-06 (старт 6 октября 2026, прописан в workflow).

Необязательно: Variables → `STRAVA_SPORT_TYPES` — какие виды активности учитывать в статистике. По умолчанию `InlineSkate`. Для всех видов — `ALL`; несколько через запятую: `InlineSkate,Ride`.

### 6. Запустить первое обновление
Actions → **Update Strava data** → Run workflow. Через минуту `data/strava.json` обновится, баннер «Demo data» на сайте исчезнет. Дальше обновление идёт автоматически каждые 2 часа.

## Что заполнить вручную (помечено на сайте жёлтым «[To be confirmed]»)
В `src/page.html`:
- раздел **About**: биография, другие результаты и соревнования, экипировка/тренер;
- раздел **Facts**: Based in, Born;
- раздел **The club**: абзац о клубе RollerEarth 40075.
- ссылка на профиль спортсмена в Strava подставится автоматически после подключения.

После правок выполнить `node scripts/build.mjs` (пересобирает `index.html`) и загрузить изменения.

## Видео
Чтобы встроить YouTube Shorts прямо на сайт: в `src/page.html` в блоке `SITE` указать ID роликов, например
`youtubeShortIds: ["abc123XYZ", "def456UVW"]` (ID — часть ссылки после `/shorts/`). Пересобрать.

## Домен

Сайт: https://rollerearth40075.com (регистратор Fozzy, DNS у Fozzy: 4 записи A на 185.199.108–111.153 и CNAME www → wch2026.github.io). Файл `CNAME` в корне репозитория не удалять.

## Свой домен (общая инструкция)
Купить домен (≈10–15 USD в год) → у регистратора создать CNAME‑запись `www` → `<логин>.github.io` → в GitHub Settings → Pages → Custom domain ввести домен → включить Enforce HTTPS.

## Ограничения Strava
- Бесплатный API: 200 запросов за 15 минут, 2 000 в день. Сайт делает 2–3 запроса каждые 2 часа.
- На сайте показываются только данные самого спортсмена (его активности). Данные других участников клуба Strava показывать по правилам API нельзя.
- Strava требует указания «Powered by Strava» — оно есть в подвале сайта.
- Если Константин сделает активность приватной, она всё равно попадёт в статистику (scope `activity:read_all`), но ссылка на неё будет открываться только ему. Чтобы исключить приватные — заменить scope на `activity:read` в `get-refresh-token.mjs` и получить токен заново.
