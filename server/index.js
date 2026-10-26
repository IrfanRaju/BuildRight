import 'dotenv/config';
import { createApp } from './app.js';
import { connectDatabase } from './services/database.js';

const { app, env } = createApp();

const server = app.listen(env.port, () => {
  console.info(`BuildRight API listening on http://localhost:${env.port}`);
});

connectDatabase(env.mongoUri);

export { app, server };
