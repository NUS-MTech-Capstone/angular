import { By, WebDriver } from 'selenium-webdriver';
import { waitForVisibleText } from '../support/driver';

export class AccessPage {
  constructor(private readonly driver: WebDriver) {}

  async waitForLoad(): Promise<void> {
    await waitForVisibleText(this.driver, '.access-sider .title', 'Access');
  }

  async selectSection(section: string): Promise<void> {
    const item = await this.driver.findElement(
      By.xpath(`//ul[contains(@class,'access-menu')]//li[normalize-space()='${section}']`),
    );
    await item.click();
  }

  async getActiveSection(): Promise<string> {
    const selected = await this.driver.findElement(
      By.css('.access-menu li.selected'),
    );
    return selected.getText();
  }

  async getSearchPlaceholder(): Promise<string> {
    const input = await this.driver.findElement({ css: '.search-bar input' });
    return input.getAttribute('placeholder');
  }
}
