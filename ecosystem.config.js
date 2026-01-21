module.exports = {
  apps: [
    {
      name: 'srs-dashboard',
      script: 'npm',
      args: 'start',
      cwd: './',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1536M',
      env: {
        NODE_ENV: 'production',
        NODE_OPTIONS: '--max-old-space-size=1536',
        UV_THREADPOOL_SIZE: '2',
        PORT: 3000
      },
      error_file: './logs/err.log',
      out_file: './logs/out.log',
      log_file: './logs/combined.log',
      time: true
    }
  ]
};
