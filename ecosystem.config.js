module.exports = {
  apps: [{
    name: 'eps-dashboard',
    script: 'npm',
    args: 'start',
    cwd: '/var/www/EPS-Dashboard',
    env: {
      NODE_ENV: 'production',
      PORT: 3001
    },
    env_file: '.env.local'
  }]
}
