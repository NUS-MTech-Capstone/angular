import { formatChangeRequestNumber } from './change-request.utils';

describe('formatChangeRequestNumber', () => {
  it('uses the last 8 hex digits so demo seed UUIDs stay unique', () => {
    expect(
      formatChangeRequestNumber('d0000001-0000-4000-8000-000000000001'),
    ).toBe('CR-00000001');
    expect(
      formatChangeRequestNumber('d0000001-0000-4000-8000-000000000002'),
    ).toBe('CR-00000002');
    expect(
      formatChangeRequestNumber('d0000001-0000-4000-8000-000000000003'),
    ).toBe('CR-00000003');
  });

  it('formats arbitrary UUIDs consistently', () => {
    expect(
      formatChangeRequestNumber('a1b2c3d4-e5f6-7890-abcd-ef1234567890'),
    ).toBe('CR-34567890');
  });
});
