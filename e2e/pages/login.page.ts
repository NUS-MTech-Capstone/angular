import { By, Key, WebDriver, until } from 'selenium-webdriver';
import { config } from '../config';
import {
  beginRecordingWhenBrowserReady,
  presentationPause,
  waitForUrlContains,
  waitForVisibleText,
} from '../support/driver';

export class LoginPage {
  constructor(private readonly driver: WebDriver) {}

  async open(): Promise<void> {
    await this.driver.get(`${config.baseUrl}/login`);
    await waitForVisibleText(this.driver, '.login-brand h1', 'DenDenMushi');
    if (!config.live) {
      await beginRecordingWhenBrowserReady(this.driver);
    }
    await presentationPause('Login page loaded');
  }

  async signInAsDevUser(displayName: string): Promise<void> {
    const button = await this.driver.findElement(
      By.xpath(
        `//button[contains(@class,'dev-user-btn')][.//span[contains(@class,'dev-user-name') and normalize-space()='${displayName}']]`,
      ),
    );
    await button.click();
    await waitForUrlContains(this.driver, '/access');
    await presentationPause('Signed in');
  }

  async signInWithCognito(username: string, password: string): Promise<void> {
    const loginButton = await this.driver.findElement(
      By.xpath("//button[normalize-space()='Login']"),
    );
    await loginButton.click();

    const usernameInput = await this.driver.wait(
      until.elementLocated(
        By.css('input#signInFormUsername, input[name="username"], input[type="email"]'),
      ),
      config.pageLoadTimeoutMs,
    );
    const passwordInput = await this.driver.wait(
      until.elementLocated(
        By.css('input#signInFormPassword, input[name="password"], input[type="password"]'),
      ),
      config.pageLoadTimeoutMs,
    );

    await usernameInput.clear();
    await usernameInput.sendKeys(username);
    await passwordInput.clear();
    await passwordInput.sendKeys(password, Key.ENTER);
    await waitForUrlContains(this.driver, '/access', 60000);
    await beginRecordingWhenBrowserReady(this.driver);
  }

  async getErrorMessage(): Promise<string | null> {
    const alerts = await this.driver.findElements({ css: '.login-error' });
    if (alerts.length === 0) {
      return null;
    }
    return alerts[0].getText();
  }
}
