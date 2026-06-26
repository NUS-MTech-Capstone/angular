import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { WebDriver } from 'selenium-webdriver';

const execFileAsync = promisify(execFile);

function escapePowerShellSingleQuoted(value: string): string {
  return value.replace(/'/g, "''");
}

export async function activateBrowserWindow(driver: WebDriver): Promise<void> {
  await driver.switchTo().window(await driver.getWindowHandle());
  await driver.executeScript('window.focus();');

  let titleHint = 'Chrome';
  try {
    const pageTitle = (await driver.getTitle()).trim();
    if (pageTitle) {
      titleHint = pageTitle;
    }
  } catch {
    // Fall back to a generic Chrome window title match.
  }

  if (process.platform === 'win32') {
    const escapedTitle = escapePowerShellSingleQuoted(titleHint);
    await execFileAsync('powershell.exe', [
      '-NoProfile',
      '-Command',
      [
        '$ws = New-Object -ComObject WScript.Shell',
        `$activated = $ws.AppActivate('${escapedTitle}')`,
        'if (-not $activated) { $ws.AppActivate("Chrome") | Out-Null }',
      ].join('; '),
    ]);
  }

  await new Promise((resolve) => setTimeout(resolve, 600));
}
