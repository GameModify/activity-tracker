# Архитектура Activity Tracker

Самостоятельный сервис со своей базой, зависимостями, сборкой и CI. Репозиторий содержит сервис и его Chrome-сборщик. Клиентские приложения используют только версионированный API; импортов из клиентских репозиториев и общей SQLite нет.

## Модули

- `src/domain`: контракты наблюдений/интервалов/правил и классификация. Не зависит от инфраструктуры.
- `src/application`: порты хранения и сборщиков, формирование интервалов и управление сбором.
- `src/adapters/windows`: типизированная граница Win32 через Koffi, без административных прав.
- `src/adapters/sqlite`: сохранение, транзакции, идентичность устройства и монотонная последовательность изменений.
- `src/adapters/http`: проверка входных данных и scoped-ключей, только loopback.
- `src/bootstrap.ts`: создание зависимостей, жизненный цикл и периодический опрос. `src/main.ts` запускает сервис; `src/desktop.ts` связывает его с Windows-оболочкой.
- `src/tray-worker.ts`: отдельный поток для значка и нативного меню. Типизированные проверяемые сообщения передают команды основному потоку, где работают сборщики, SQLite и HTTP.
- `desktop-ui`: независимая локальная страница подключения и паузы, разделяет только публичные DTO.
- `extension`: Chrome Manifest V3, фокус вкладки, состояния медиаплееров, настройка разрешений. Разделяет только публичные транспортные контракты.

`npm run check` проверяет направления статических и динамических импортов. Между модулями передаются предметные DTO. JSON разбирается на границах HTTP и SQLite; модели проверяются Zod.

## Обмен с клиентами

Клиент хранит последний cursor и запрашивает изменения по sequence. Обновлённый интервал получает новую sequence, сохраняя id. Device ID сохраняется вместе с базой; после замены базы клиент должен сбросить cursor для нового устройства. Завершённость интервала передаётся явно. Клиент отвечает за выбор категории, принятие записи и защиту ручных исправлений.

Сервис не знает категорий, игр или внутренних таблиц Time & Games. Метки правил нейтральны к потребителю. Отдельный репозиторий выбран для самостоятельного жизненного цикла трекера; расширение находится рядом с сервисом как его источник данных. Возможность отдельных релизов не требует разделять сборщики и правила на дополнительные сетевые сервисы.

## Доступ и наблюдения

API слушает 127.0.0.1, проверяет Host и браузерный Origin. Ключ отправки не даёт чтения истории или управления. Принимаются типизированные ограниченные по размеру пакеты Chrome. Токены не выводятся в журналы. Для первого подключения доступны настройки из трея или локальный файл ключей. Статические файлы панели не содержат секретов; /v1/connection требует управляющий read-ключ. Собственный Origin панели допускается только вместе с Bearer-авторизацией. Служба Windows в Session 0 для сбора окон не используется: процесс запускается в пользовательской сессии.

Источники: [Win32 services](https://learn.microsoft.com/en-us/windows/win32/services/interactive-services), [Koffi output parameters](https://koffi.dev/output), [Chrome extension service workers](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle), [ActivityWatch architecture](https://docs.activitywatch.net/en/latest/architecture.html).

## Windows distribution

The Windows x64 distribution uses Node.js SEA with a small bootstrap loading bundled CommonJS service and tray-worker modules from disk. Koffi remains an external native dependency shipped with the executable. The executable uses the GUI subsystem; a terminal is not required. The tray owns its Win32 window and synchronous menu on its dedicated worker thread. Keeping the menu open does not block the service event loop. Explorer restart restores the icon.

The per-user installer and portable archive share the same data location under the user profile (`.activity-tracker`). Runtime shutdown stops native hooks and the Windows probe, closes intervals at the last observation, then closes HTTP and SQLite. The single-instance mutex is scoped by port. Autostart is optional and disabled by default. Release artifacts contain program files and the Chrome collector, without development data or credentials.

References: [Node.js SEA](https://nodejs.org/download/release/v24.21.0/docs/api/single-executable-applications.html), [Windows notification icons](https://learn.microsoft.com/en-us/windows/win32/api/shellapi/ns-shellapi-notifyicondataw), [Koffi callbacks](https://koffi.dev/callbacks), [per-user Inno Setup](https://jrsoftware.org/ishelp/topic_setup_privilegesrequired.htm).

The desktop data directory is outside AppData because a packaged launching host can redirect AppData to a private per-package cache. Legacy migration resolves the source directory through GetFinalPathNameByHandleW before opening any SQLite sidecars or credentials, then uses SQLite backup and validates the snapshot. Starting from a different host backs up that host's legacy source without replacing an existing shared database or credentials. Windows CI starts the packaged executable twice with different LocalAppData roots and the same profile to verify the default location and credentials.

Reference: [Windows AppData virtualization](https://learn.microsoft.com/en-us/windows/uwp/porting/desktop-to-uwp-behind-the-scenes).
