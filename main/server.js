// Startet die Website:  npm start   (Port über PORT, Standard 3000)
import { createApp } from './src/app.js';

const port = Number(process.env.PORT) || 3000;
const host = process.env.HOST || '0.0.0.0';
const server = createApp().listen(port, host, () => {
  console.log(`Website läuft auf http://localhost:${port}`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 5000).unref();
  });
}
