module.exports = {
  launch: {
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  },
  browserContext: 'incognito',
  server: {
    command: 'node scripts/testServer.js',
    port: 4173,
    launchTimeout: 20000,
    usedPortAction: 'kill',
  },
};
