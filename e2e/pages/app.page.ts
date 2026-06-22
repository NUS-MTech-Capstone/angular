import { By, WebDriver, until } from 'selenium-webdriver';
import { config } from '../config';

export class AppPage {
  constructor(private readonly driver: WebDriver) {}

  async getDisplayName(): Promise<string> {
    const name = await this.driver.findElement({ css: '.user-name' });
    return name.getText();
  }

  async isNavItemVisible(label: string): Promise<boolean> {
    const items = await this.driver.findElements(
      By.xpath(`//li[contains(@class,'rail-item')]//span[contains(@class,'rail-label') and normalize-space()='${label}']`),
    );
    return items.length > 0;
  }

  async navigateViaRail(label: string): Promise<void> {
    const item = await this.driver.findElement(
      By.xpath(`//li[contains(@class,'rail-item')]//span[contains(@class,'rail-label') and normalize-space()='${label}']/..`),
    );
    await item.click();
  }

  async waitForRoute(pathSuffix: string): Promise<void> {
    await this.driver.wait(until.urlContains(pathSuffix), config.pageLoadTimeoutMs);
  }

  async openProfileFromUserMenu(): Promise<void> {
    const menu = await this.driver.findElement({ css: '.user-menu' });
    await menu.click();

    const profileItem = await this.driver.wait(
      until.elementLocated(
        By.xpath("//li[contains(@class,'ant-dropdown-menu-item')][contains(., 'View Profile')]"),
      ),
      config.pageLoadTimeoutMs,
    );
    await profileItem.click();
    await this.waitForRoute('/profile');
  }

  async logoutFromHeader(): Promise<void> {
    const menu = await this.driver.findElement({ css: '.user-menu' });
    await menu.click();

    const logoutItem = await this.driver.wait(
      until.elementLocated(
        By.xpath("//li[contains(@class,'ant-dropdown-menu-item')][contains(., 'Logout')]"),
      ),
      config.pageLoadTimeoutMs,
    );
    await logoutItem.click();
    await this.driver.wait(until.urlContains('/login'), config.pageLoadTimeoutMs);
  }
}
