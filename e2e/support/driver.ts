import 'chromedriver';
import { Builder, WebDriver, until } from 'selenium-webdriver';
import chrome from 'selenium-webdriver/chrome';
import { config } from '../config';

export async function createDriver(): Promise<WebDriver> {
  const options = new chrome.Options();
  options.addArguments('--no-sandbox', '--disable-dev-shm-usage', '--window-size=1440,900');

  if (config.headless) {
    options.addArguments('--headless=new', '--disable-gpu');
  }

  const driver = await new Builder()
    .forBrowser('chrome')
    .setChromeOptions(options)
    .build();

  await driver.manage().setTimeouts({
    implicit: config.implicitWaitMs,
    pageLoad: config.pageLoadTimeoutMs,
  });

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
