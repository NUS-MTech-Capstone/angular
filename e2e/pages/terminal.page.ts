import { By, Key, WebDriver } from 'selenium-webdriver';
import { config } from '../config';

export class TerminalPage {
  constructor(private readonly driver: WebDriver) {}

  async waitForLoad(): Promise<void> {
    await this.driver.wait(async () => {
      const pages = await this.driver.findElements(By.css('.terminal-page'));
      return pages.length > 0;
    }, config.pageLoadTimeoutMs);
  }

  async waitForConnected(timeoutMs = config.pageLoadTimeoutMs): Promise<void> {
    await this.driver.wait(async () => {
      const elements = await this.driver.findElements(By.css('.session-state'));
      for (const element of elements) {
        if ((await element.getText()) === 'Connected') {
          return true;
        }
      }
      return false;
    }, timeoutMs);
  }

  async getSessionTarget(): Promise<string> {
    return (await this.driver.findElement(By.css('.session-target'))).getText();
  }

  async runCommand(command: string): Promise<void> {
    const host = await this.driver.findElement(By.css('.terminal-host'));
    await host.click();

    const textareas = await this.driver.findElements(
      By.css('.terminal-host .xterm-helper-textarea'),
    );
    if (textareas.length > 0) {
      await textareas[0].click();
      await textareas[0].sendKeys(command, Key.ENTER);
      return;
    }

    await this.driver.actions().sendKeys(command, Key.ENTER).perform();
  }

  async getTerminalText(): Promise<string> {
    const rows = await this.driver.findElements(By.css('.terminal-host .xterm-rows'));
    if (rows.length > 0) {
      return rows[0].getText();
    }

    return this.driver.executeScript<string>(
      `return document.querySelector('.terminal-host .xterm-rows')?.textContent ?? '';`,
    );
  }

  async waitForOutput(
    text: string,
    timeoutMs = config.pageLoadTimeoutMs,
  ): Promise<void> {
    await this.driver.wait(async () => {
      const screen = await this.getTerminalText();
      return screen.includes(text);
    }, timeoutMs);
  }

  async closeWindow(): Promise<void> {
    await this.driver.close();
  }
}
