import { AGENTIC_AI_ROUTES } from './agentic-ai.routes';

describe('Agentic AI routes', () => {
  it('defaults to incidents and provides deep-linkable incident and alert details', () => {
    const children = AGENTIC_AI_ROUTES[0].children ?? [];

    expect(children.find((route) => route.path === '')?.redirectTo).toBe('incidents');
    expect(children.map((route) => route.path)).toEqual([
      '',
      'incidents',
      'incidents/:incidentId',
      'alerts',
      'alerts/:alertId',
    ]);
  });
});
