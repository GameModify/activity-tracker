import { startTracking, registerSignals } from './bootstrap.ts';
import { applicationConfiguration } from './configuration.ts';
void startTracking(applicationConfiguration())
  .then(registerSignals)
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : 'Не удалось запустить Activity Tracker');
    process.exitCode = 1;
  });
