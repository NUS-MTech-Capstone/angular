import { mkdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { WebDriver } from 'selenium-webdriver';
import { config } from '../config';

export function markInjectionActive(): void {
  mkdirSync(dirname(config.injectionMarker), { recursive: true });
  writeFileSync(config.injectionMarker, new Date().toISOString(), { mode: 0o600 });
}

export function clearInjectionMarker(): void {
  try {
    unlinkSync(config.injectionMarker);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }
  }
}

export async function captureEvidence(driver: WebDriver, filename: string): Promise<string> {
  mkdirSync(config.artifactDir, { recursive: true });
  const path = `${config.artifactDir}/${filename}`;
  writeFileSync(path, await driver.takeScreenshot(), {
    encoding: 'base64',
    mode: 0o600,
  });
  return path;
}
