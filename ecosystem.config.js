module.exports = {
  apps: [
    {
      name: "norin-b",
      script: "dist/src/main.js",
      cwd: "/home/nozima/od/rent-norin/backend",
      interpreter: "/home/nozima/.nvm/versions/node/v20.19.6/bin/node",
      watch: false,
      env: {
        NODE_ENV: "production",
        // Bind backend only to localhost (nginx proxies to it)
        HOST: "127.0.0.1",
      },
      // Добавляем настройки для лучшей стабильности
      max_memory_restart: "1G",
      restart_delay: 4000,
      max_restarts: 10,
      min_uptime: "10s",
      // Автоматический перезапуск при сбоях
      autorestart: true,
      // Логирование
      log_file: "./logs/combined.log",
      out_file: "./logs/out.log",
      error_file: "./logs/error.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      instances: 1,        // Явно указать один экземпляр
      exec_mode: "fork",   // Режим fork
      kill_timeout: 5000,  // Время ожидания перед убийством процесса
    },
    {
      name: "norin-frontend",
      script: "node_modules/.bin/next", // Прямой запуск Next.js
      // Bind Next.js only to localhost (nginx proxies to it)
      args: "start -H 127.0.0.1 -p 3009",
      interpreter: "/home/nozima/.nvm/versions/node/v20.19.6/bin/node",
      cwd: "/home/nozima/od/rent-norin/frontend",
      watch: false,
      autorestart: true,
      max_restarts: 10, // Максимум 10 перезапусков
      min_uptime: "10s", // Минимум 10 секунд работы
      max_memory_restart: "500M", // Перезапуск при превышении памяти (уменьшено для защиты от перегрузки)
      restart_delay: 4000, // Задержка 4 секунды перед перезапуском
      env: {
        NODE_ENV: "production",
        PORT: 3009,
        NEXT_PUBLIC_DOMAIN: "https://norin.kord.uz",
      },
      instances: 1,        // Явно указать один экземпляр
      exec_mode: "fork",   // Режим fork
      kill_timeout: 5000,  // Время ожидания перед убийством процесса
      listen_timeout: 10000, // Таймаут для прослушивания
      // Добавляем логирование для отладки
      merge_logs: true,
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      // Игнорируем изменения в директориях, которые могут вызывать перезапуски
      ignore_watch: [
        "node_modules",
        ".next",
        "logs",
        "*.log"
      ],
    },
  ],
};