# Fit Elite — Автодеплой Инструкция

## 📋 Шаг 1: Создать GitHub репозиторий

1. Зайти на https://github.com/new
2. Название: `fit-elite-pwa`
3. Visibility: **Public** или **Private** (на ваш выбор)
4. **НЕ** нажимать "Initialize with README"
5. Нажать **Create repository**

## 📋 Шаг 2: Запушить код

Выполнить команды в терминале:

```bash
cd "c:/PROJECTS/FIT ELITE"

# Добавить все файлы
git add -A

# Сделать первый коммит
git commit -m "Initial commit: Fit Elite PWA"

# Добавить remote (замените YOUR_USERNAME на ваш GitHub логин)
git remote add origin https://github.com/YOUR_USERNAME/fit-elite-pwa.git

# Запушить
git branch -M main
git push -u origin main
```

## 📋 Шаг 3: Подключить Vercel

1. Зайти на https://vercel.com
2. Войти через GitHub
3. Нажать **Add New Project**
4. Выбрать `fit-elite-pwa` из списка
5. Нажать **Deploy**

## 📋 Шаг 4: Готово!

Через 1-2 минуты получите URL:
```
https://fit-elite-pwa-xxxx.vercel.app
```

## 🔄 Автообновления

Теперь каждый `git push` будет автоматически деплоить изменения!

```bash
# Внесли изменения → закоммитили → запушили
git add -A
git commit -m "Fixed set logger UI"
git push

# Vercel автоматически обновит сайт через 1-2 минуты
```

## 📱 Тестирование на телефоне

1. Открыть URL из Vercel на телефоне
2. **iOS Safari:** Поделиться → "На экран «Домой»"
3. **Android Chrome:** Меню → "Добавить на гл. экран"

## 🎯 Быстрые команды

```bash
# Локальный запуск
npm run dev

# Деплой (альтернатива автодеплою)
npm run deploy

# Коммит и пуш
npm run git:commit "Fix bug" && npm run git:push
```
