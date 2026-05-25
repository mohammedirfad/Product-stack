import { createApp } from './app.js';
import { assertSecureConfig, config } from './config/index.js';

assertSecureConfig(config);

const { app } = await createApp(config);

app.listen(config.apiPort, () => {
  console.log(`API server running on ${config.apiBaseUrl}`);
  console.log(`Swagger UI available on ${config.apiBaseUrl}/api-docs`);
});
