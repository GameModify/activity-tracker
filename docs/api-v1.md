# HTTP API v1

Базовый адрес: `http://127.0.0.1:3536`. JSON; `Authorization: Bearer <ключ>`. Токены создаются локально в `data/credentials.json`. API без Origin предназначен локальному клиенту; Chrome Origin разрешён с действующим ключом. Веб-страницы не подключаются напрямую: сайт использует собственный серверный адаптер.

| Метод и маршрут | Ключ | Результат |
| --- | --- | --- |
| GET /health | не требуется | ok, api_version |
| GET /v1/status | read | device_id, paused, desktop_available, desktop_error, desktop_at, browser_at |
| GET /v1/intervals?cursor=0 | read | api_version, device_id, cursor, has_more, intervals |
| GET /v1/rules | read | список правил |
| PUT /v1/rules | read | замена правил, массив до 200 элементов |
| POST /v1/pause | read | `{ "paused": true }`, ответ status |
| POST /v1/observations | ingest | массив наблюдений, от 1 до 40 элементов, ответ 202 |

Все времена в Unix milliseconds; отсутствие времени источника передаётся null. Источники: windows и chrome. В interval передаются id (UUID), sequence (целое > 0), channel, source, activity (строка или null), title, start_at, end_at, rule_id (UUID или null), closed (boolean). Интервалы с нулевой длительностью возможны; клиент не должен превращать их в активный таймер.

В странице максимум 500 интервалов по возрастанию sequence. Ответ содержит последнее изменение каждого интервала, а не все промежуточные heartbeat. Cursor нужно сохранять после успешного сохранения страницы. При has_more продолжить со следующим cursor. При смене device_id начать с cursor=0. Обновление закрытого интервала после ручной обработки клиентом не должно перезаписывать исправления клиента.

Rule: id, name, enabled, field (app/title/url/host/kind), operator (equals/contains), value, activity, priority (0–1000). Больший приоритет побеждает; при равенстве используется порядок id. Правило не исполняет регулярные выражения или произвольный код.

Observation: event_id (UUID), channel (префикс chrome:), timestamp, source=chrome, kind (focus/media), app, title, url, active, playing, idle_ms. Повтор event_id идемпотентен. Наблюдения старше часа или более чем на 2 секунды из будущего отклоняются. Разбор всего пакета выполняется до применения. Ошибки: 400 формат/значения, 401 ключ, 403 Host/Origin, 404 маршрут.

Совместимые добавления могут расширять ответы v1. Изменение смысла времени, cursor или обязательных полей требует новой версии API. Канонические Zod-схемы: src/domain/contracts.ts.

## Состояние воспроизведения

GET /v1/status дополнительно возвращает playback: список channel, title, playing, observed_at и необязательных position_seconds / duration_seconds. Список содержит только сигналы моложе 15 секунд. Пауза плеера сохраняет его состояние до следующего сигнала или истечения срока; глобальная пауза очищает список. Новые поля наблюдения media_count, position_seconds и duration_seconds необязательны для совместимости. Позиция плеера не меняет длительность интервалов.

## Действия и ресурсы

Наблюдения могут содержать interaction_at (время последнего действия страницы), idle_timeout_ms=300000 и resource_id/resource_kind. Новые виды ресурсов: app, document, game, voice. Для kind=voice требуется voice_connected=true; голосовые интервалы формирует локальный Windows-сборщик. Интервалы дополнительно передают app и ресурс. Правила поддерживают поле resource_id и оператор within для папки и подпапок. Status содержит foreground и voice (connected/disconnected/unknown). Неизвестное или просроченное состояние не подтверждает соединение.

Status может содержать game: последнее состояние игрового канала windows:game. После ухода из игры оно остаётся active до пятиминутного порога; foreground продолжает отражать реальное активное окно. Потеря сигналов более 15 секунд сбрасывает удержание игры.
