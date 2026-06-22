import { ensureServicesAvailable } from './services';

export const mochaHooks = {
  beforeAll: async function (this: Mocha.Context) {
    this.timeout(15000);
    await ensureServicesAvailable();
  },
};
