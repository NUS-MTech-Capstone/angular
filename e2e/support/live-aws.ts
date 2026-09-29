import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { config } from '../config';
import { pollFor } from './live-api';

const execFileAsync = promisify(execFile);

async function awsText(args: string[]): Promise<string> {
  const { stdout } = await execFileAsync('aws', [
    ...args,
    '--profile',
    config.awsProfile,
    '--output',
    'text',
  ]);
  return stdout.trim();
}

export async function assertExpectedAwsAccount(): Promise<void> {
  const account = await awsText(['sts', 'get-caller-identity', '--query', 'Account']);
  if (account !== config.expectedAwsAccountId) {
    throw new Error(
      `Refusing live E2E in AWS account ${account}; expected ${config.expectedAwsAccountId}.`,
    );
  }
}

export async function waitForAlarmState(
  expectedState: 'ALARM' | 'OK',
  timeoutMs: number,
): Promise<void> {
  await pollFor(
    `CloudWatch alarm ${config.demoAlarmName} to reach ${expectedState}`,
    timeoutMs,
    async () => {
      const state = await awsText([
        'cloudwatch',
        'describe-alarms',
        '--region',
        'ap-southeast-1',
        '--alarm-names',
        config.demoAlarmName,
        '--query',
        'MetricAlarms[0].StateValue',
      ]);
      return state === expectedState ? true : undefined;
    },
    10000,
  );
}
