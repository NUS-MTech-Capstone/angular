import { By, WebDriver } from 'selenium-webdriver';
import { waitForVisibleText } from '../support/driver';

export class ProfilePage {
  constructor(private readonly driver: WebDriver) {}

  async waitForLoad(displayName: string): Promise<void> {
    await waitForVisibleText(this.driver, '.profile-page h2', displayName);
  }

  async getUsername(): Promise<string> {
    const username = await this.driver.findElement({ css: '.profile-username' });
    return username.getText();
  }

  async logout(): Promise<void> {
    const button = await this.driver.findElement({ css: '.logout-btn' });
    await button.click();
  }
}
