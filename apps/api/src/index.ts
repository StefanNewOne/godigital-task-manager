import { createApp } from './app.js';
import { env } from './env.js';

createApp().listen(env.API_PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`gd-api слуша на :${env.API_PORT}`);
});
