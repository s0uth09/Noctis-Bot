module.exports = {
  apps: [
    {
      name: 'noctis-haven',
      script: 'src/index.js',
      watch: false,
      max_memory_restart: '512M',
      env: { NODE_ENV: 'production' }
    }
  ]
};
