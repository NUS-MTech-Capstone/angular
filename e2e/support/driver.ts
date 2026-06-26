import 'chromedriver';
import { Builder, WebDriver, until } from 'selenium-webdriver';
import chrome from 'selenium-webdriver/chrome';
import { config } from '../config';
import { activateBrowserWindow } from './foreground';
import { isRecordingActive, startBrowserRecording } from './recording';

export async function presentationPause(
  scene?: string,
  ms = config.stepDelayMs,
): Promise<void> {
  if (!config.presentation || config.skipActionPauses || ms <= 0) {
    return;
  }

  if (scene) {
    console.log(`  [demo pause] ${scene} (${ms}ms)`);
  }

  await new Promise((resolve) => setTimeout(resolve, ms));
}

export async function presentationScene(scene: string): Promise<void> {
  if (!config.presentation || config.sceneDelayMs <= 0) {
    return;
  }

  console.log(`  [demo pause] ${scene} (${config.sceneDelayMs}ms)`);
  await new Promise((resolve) => setTimeout(resolve, config.sceneDelayMs));
}

let recordingStarted = false;

export async function beginRecordingWhenBrowserReady(
  driver: WebDriver,
): Promise<void> {
  if (!config.record || config.headless || recordingStarted || isRecordingActive()) {
    return;
  }

  recordingStarted = true;
  await activateBrowserWindow(driver);
  console.log('Browser brought to foreground — starting recording');
  await startBrowserRecording(driver);
}

export async function createDriver(): Promise<WebDriver> {
  const options = new chrome.Options();
  options.addArguments(
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--disable-popup-blocking',
  );

  if (config.headless) {
    options.addArguments('--headless=new', '--disable-gpu', '--window-size=1440,900');
  } else if (config.record || config.presentation) {
    options.addArguments(
      '--start-maximized',
      '--window-position=0,0',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
    );
  } else {
    options.addArguments('--window-size=1440,900');
  }

  const driver = await new Builder()
    .forBrowser('chrome')
    .setChromeOptions(options)
    .build();

  await driver.manage().setTimeouts({
    implicit: config.implicitWaitMs,
    pageLoad: config.pageLoadTimeoutMs,
  });

  if (!config.headless) {
    await driver.manage().window().maximize();
    await activateBrowserWindow(driver);
    if (config.record || config.presentation) {
      console.log('Chrome opened (visible, maximized, foreground)');
      await new Promise((resolve) => setTimeout(resolve, 1200));
    }
  }

  return driver;
}

export async function quitDriver(driver: WebDriver): Promise<void> {
  await driver.quit();
}

export async function waitForUrlContains(
  driver: WebDriver,
  fragment: string,
  timeoutMs = config.pageLoadTimeoutMs,
): Promise<void> {
  await driver.wait(until.urlContains(fragment), timeoutMs);
}

export async function waitForVisibleText(
  driver: WebDriver,
  cssSelector: string,
  text: string,
  timeoutMs = config.pageLoadTimeoutMs,
): Promise<void> {
  await driver.wait(async () => {
    const elements = await driver.findElements({ css: cssSelector });
    for (const element of elements) {
      if ((await element.getText()).includes(text)) {
        return true;
      }
    }
    return false;
  }, timeoutMs);
}
