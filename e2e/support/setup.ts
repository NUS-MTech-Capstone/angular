import { ensureServicesAvailable } from './services';
import { getActiveRecordingPath, stopSuiteRecording } from './recording';
import { config } from '../config';

export const mochaHooks = {
  beforeAll: async function (this: Mocha.Context) {
    this.timeout(config.presentation ? 300000 : 15000);
    await ensureServicesAvailable();
  },

  afterAll: async function (this: Mocha.Context) {
    if (!config.record || config.headless) {
      return;
    }

    if (config.presentation && config.recordTailMs > 0) {
      console.log(`  [demo pause] Ending presentation (${config.recordTailMs}ms)`);
      await new Promise((resolve) => setTimeout(resolve, config.recordTailMs));
    }

    const recordingPath = await stopSuiteRecording();
    if (recordingPath) {
      console.log(`Saved E2E recording: ${recordingPath}`);
    } else {
      const activePath = getActiveRecordingPath();
      if (activePath) {
        console.log(`Saved E2E recording: ${activePath}`);
      }
    }
  },
};
