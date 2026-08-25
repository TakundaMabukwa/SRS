module.exports = {
  apps: [
    {
      name: 'srs-dashboard',
      script: 'pnpm',
      args: 'start',
      cwd: './',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '3G',
      env: {
        NODE_ENV: 'production',
        NODE_OPTIONS: '--max-old-space-size=3072',
        UV_THREADPOOL_SIZE: '1',
        PORT: 3000
      },
      error_file: './logs/err.log',
      out_file: './logs/out.log',
      log_file: './logs/combined.log',
      time: true,
      kill_timeout: 5000,
      wait_ready: true,
      listen_timeout: 30000
    }
  ]
};
