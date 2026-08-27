module.exports = {
  apps: [
    {
      name: 'srs-dashboard',
      script: 'pnpm',
      args: 'start',
      cwd: './',
      instances: 'max',
      exec_mode: 'cluster',
      autorestart: true,
      watch: false,
      max_memory_restart: '3G',
      env: {
        NODE_ENV: 'production',
        NODE_OPTIONS: '--max-old-space-size=3072',
        UV_THREADPOOL_SIZE: '64',
        PORT: 3000
      },
      error_file: './logs/err.log',
      out_file: './logs/out.log',
      log_file: './logs/combined.log',
      time: true,
      kill_timeout: 5000,
      wait_ready: true,
      listen_timeout: 30000,
      exp_backoff_restart_delay: 100,
      max_restarts: 10,
      min_uptime: '5s',
    }
  ]
};
