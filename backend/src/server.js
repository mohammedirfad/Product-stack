import { createApp } from './app.js';
import { assertSecureConfig, config } from './config/index.js';

assertSecureConfig(config);

const { app } = await createApp(config);

app.listen(config.apiPort, () => {
  console.log(`API server running on http://localhost:${config.apiPort}`);
  console.log(`Swagger UI available on http://localhost:${config.apiPort}/api-docs`);
});
