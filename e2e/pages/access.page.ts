import { By, WebDriver } from 'selenium-webdriver';
import { config } from '../config';
import { presentationPause, waitForVisibleText } from '../support/driver';

export class AccessPage {
  constructor(private readonly driver: WebDriver) {}

  async waitForLoad(): Promise<void> {
    await waitForVisibleText(this.driver, '.access-sider .title', 'Access');
    await presentationPause('Access page loaded');
  }
  async selectSection(section: string): Promise<void> {
    const item = await this.driver.findElement(
      By.xpath(`//ul[contains(@class,'access-menu')]//li[normalize-space()='${section}']`),
    );
    await this.driver.executeScript(
      'arguments[0].scrollIntoView({block: "center"});',
      item,
    );
    await item.click();
    await this.driver.wait(async () => {
      const selected = await this.driver.findElement(
        By.css('.access-menu li.selected'),
      );
      return (await selected.getText()) === section;
    }, config.pageLoadTimeoutMs);
    await presentationPause(`Selected ${section}`);
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

  async waitForServerTable(): Promise<void> {
    await this.driver.wait(async () => {
      const rows = await this.driver.findElements(
        By.css('.servers-table tbody tr.ant-table-row'),
      );
      return rows.length > 0;
    }, config.pageLoadTimeoutMs);
  }

  async getFirstServerHostname(): Promise<string> {
    await this.waitForServerTable();
    const cell = await this.driver.findElement(
      By.css('.servers-table tbody tr.ant-table-row td:first-child'),
    );
    return (await cell.getText()).trim();
  }

  async waitForServerRow(hostname: string): Promise<void> {
    await waitForVisibleText(this.driver, '.servers-table', hostname);
  }

  async prepareTerminalLaunchCapture(): Promise<void> {
    await this.driver.executeScript(`
      window.__ddmTerminalOpenUrl = null;
      const nativeOpen = window.open.bind(window);
      window.open = (url, target, features) => {
        window.__ddmTerminalOpenUrl = url;
        return nativeOpen(url, target, features);
      };
    `);
  }

  async getCapturedTerminalPath(): Promise<string | null> {
    return this.driver.executeScript<string | null>(
      'return window.__ddmTerminalOpenUrl;',
    );
  }

  async expandServerRow(hostname: string): Promise<void> {
    await this.waitForServerRow(hostname);
    const expandIcon = await this.driver.findElement(
      By.xpath(
        `//tr[.//td[normalize-space()='${hostname}']]//*[contains(@class,'ant-table-row-expand-icon')]`,
      ),
    );
    const expanded = await expandIcon.getAttribute('class');
    if (!expanded?.includes('ant-table-row-expanded')) {
      await expandIcon.click();
    }
    await this.driver.wait(async () => {
      const launchButtons = await this.driver.findElements(
        By.xpath(
          `//tr[.//td[normalize-space()='${hostname}']]/following-sibling::tr[1]//button[contains(@class,'btn-launch')]`,
        ),
      );
      return launchButtons.length > 0;
    }, config.pageLoadTimeoutMs);
  }

  async launchSshForServer(hostname: string): Promise<void> {
    await this.prepareTerminalLaunchCapture();
    await this.expandServerRow(hostname);
    const launchButton = await this.driver.findElement(
      By.xpath(
        `//tr[.//td[normalize-space()='${hostname}']]/following-sibling::tr[1]//button[contains(@class,'btn-launch')]`,
      ),
    );
    await launchButton.click();
    await presentationPause(`Launch SSH for ${hostname}`);
  }
}
