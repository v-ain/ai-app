## Проектируем ядро бизнес-логики

авторизация Better-Auth + Redis + Postgres, защита маршрутов, рендер дашборда. Фундамент собран.
оживляем шаблон реальными данными и архитектурой, чтобы превратить статическую витрину в полноценное рентабельное приложение на 3000–5000 строк кода.

Чтобы все элементы шаблона — 4 карточки с цифрами, интерактивный график за 7/30/90 дней, таблица с редактированием Target и Limit, назначение ответственного и выезжающая панель Drawer

развернем архитектуру модульного монолита:

• Модуль БД (shared/db/schema.ts): добавляем бизнес-таблицы (например, projects / streams, metrics_daily, events_log) с индексами для быстрой аналитики и связью с user.id.
• Модуль аналитики и репозиториев (modules/analytics/):
• Репозиторий с SQL-агрегацией в Drizzle (sum, count, расчет процентов роста за период) + кэширование тяжелых выборок в Redis (TTL 60s).
• Серверные экшены (Server Actions) с Zod-валидацией для обновления колонок Target / Limit, смены статуса и добавления новых записей прямо из таблицы.
• Публичный API-шлюз (app/api/v1/ingest/route.ts) + Воркер (worker.ts):
• Реальный HTTP-эндпоинт с проверкой API-ключа, который принимает события/платежи/затраты, кладет их в очередь BullMQ (Redis), а фоновый воркер агрегирует их в PostgreSQL, мгновенно обновляя цифры на карточках и графиках.
Какой именно бизнес-домен зашиваем в таблицы и воркер для этих карточек с цифрами — Агрегатор выручки и подписок (MRR / платежи), Трекер расходов на API и облака (с лимитами и алертами) или Аналитическую CRM-воронку? Выбирай, и я сразу дам готовую схему таблиц для shared/db/schema.ts и сидер для красивых начальных данных.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

Полный сквозной конвейер: шлюз принял запрос с токеном, рассчитал стоимость в микродолларах ($0.0795) и поставил задачу в очередь Redis, откуда её подхватил фоновый воркер и обновил показатели в PostgreSQL.

Итог собранной архитектуры

• Фронтенд и рендеринг: Next.js 16 (App Router) в режиме output: "standalone" с Partial Prerendering (PPR), стримингом через <Suspense> и Server Actions с валидацией Zod.
• Авторизация и безопасность: Better-Auth с хранением сессий в Redis (secondaryStorage), защитой от IDOR в запросах к БД и SHA-256 хешированием API-ключей.
• Высоконагруженный приемник и очереди: REST-шлюз /api/v1/ingest с кэшированием метаданных ключа в Redis, атомарной блокировкой при превышении Hard Limit (429 Too Many Requests) и асинхронной обработкой через BullMQ в отдельном контейнере worker.
• Хранение данных: PostgreSQL 17 с модульной схемой Drizzle ORM и хранением денежных сумм в целых микродолларах (microUsd).
• Продакшен-инфраструктура: Multi-stage Dockerfile, оркестрация 6 сервисов (postgres, redis, migrator, web, worker, caddy) с учетом SELinux в Fedora и развертывание в одну команду через ./deploy.sh.

1. Проверь .gitignore: убедись, что .env.prod не попадает в индекс Git.
2. Зафиксируй рабочую сборку в репозитории:bash
   git add .
   git commit -m "feat: complete AI FinOps platform with PPR dashboard, BullMQ worker, and Podman deployment"

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
