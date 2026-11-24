import 'dotenv/config';
import { createApp } from './app.js';
import { initAdmin } from './firebase.js';

const port = Number(process.env.PORT) || 4000;
const admin = initAdmin(); // may switch a demo-* project to the emulators, so read the env after it
const usingEmulators = Boolean(process.env.FIRESTORE_EMULATOR_HOST);

createApp(admin).listen(port, '0.0.0.0', () => {
  console.log(`Gatehood API on http://0.0.0.0:${port} (${usingEmulators ? 'emulators' : 'real Firebase project'})`);
});
