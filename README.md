# Telegram Login на GitHub Pages

Сайт с авторизацией через Telegram (@api_by_fteam_bot) и генерацией реферальных ссылок.

## Установка
1. Загрузите файлы в репозиторий GitHub.
2. Настройте Cloudflare Worker с токеном `7268726713:AAGzXcVvva3EbT-pvLUGVYpH4ZAe2GTEG5c` и URL `https://aboba.qwertyuiop19818.workers.dev`.
3. Включите GitHub Pages в настройках репозитория.
4. Настройте кастомный домен `fillsteam.ru` в настройках GitHub Pages.

## Бэкенд
Cloudflare Worker обрабатывает команду `/start` и авторизацию через Telegram Login Widget.
