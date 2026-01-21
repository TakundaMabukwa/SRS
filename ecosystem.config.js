module.exports = {
  apps: [{
    name: 'SRS',
    script: 'npm',
    args: 'start',
    cwd: '/var/www/SRS',
    env: {
      NODE_ENV: 'production',
      PORT: 3001
    },
    env_file: '.env.local'
  }]
}
