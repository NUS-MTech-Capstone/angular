import { By, Key, WebDriver, until } from 'selenium-webdriver';
import { config } from '../config';
import { waitForVisibleText } from '../support/driver';

function localMinute(value: Date): string {
  const pad = (part: number) => String(part).padStart(2, '0');
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())} ${pad(value.getHours())}:${pad(value.getMinutes())}`;
}

export class ChangeManagementPage {
  constructor(private readonly driver: WebDriver) {}

  async open(): Promise<void> {
    await this.driver.get(`${config.baseUrl}/change-management`);
    await waitForVisibleText(this.driver, '.header-actions', 'New change request');
  }

  async createRequest(title: string, hostId: string, groupName: string): Promise<void> {
    await this.driver.findElement(By.xpath("//button[contains(.,'New change request')]")).click();
    const modal = await this.driver.wait(
      until.elementLocated(By.css('.ant-modal-content')),
      config.pageLoadTimeoutMs,
    );
    await this.driver.wait(until.elementIsVisible(modal), config.pageLoadTimeoutMs);

    await modal.findElement(By.css('input[formcontrolname="title"]')).sendKeys(title);
    await modal
      .findElement(By.css('textarea[formcontrolname="description"]'))
      .sendKeys('Live E2E approval-gated demo application recovery.');

    const start = new Date(Date.now() + 5 * 60 * 1000);
    const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
    await this.enterDate(modal, 'implementationStartAt', localMinute(start));
    await this.enterDate(modal, 'implementationEndAt', localMinute(end));
    await this.selectMultiple(modal, 'vmIds', hostId);
    await this.selectMultiple(modal, 'implementerGroupIds', groupName);

    const create = await modal.findElement(
      By.xpath(
        ".//div[contains(@class,'ant-modal-footer')]//button[.//span[normalize-space()='Create request']]",
      ),
    );
    await create.click();
    await this.driver.wait(until.stalenessOf(modal), config.pageLoadTimeoutMs);
    await this.waitForRequest(title, 'Pending');
  }

  async approveRequest(title: string): Promise<void> {
    const row = await this.requestRow(title);
    const approve = await row.findElement(By.xpath(".//button[normalize-space()='Approve']"));
    await this.driver.wait(until.elementIsEnabled(approve), config.pageLoadTimeoutMs);
    await approve.click();
    await this.waitForRequest(title, 'Approved');
  }

  private async enterDate(
    modal: import('selenium-webdriver').WebElement,
    controlName: string,
    value: string,
  ): Promise<void> {
    const input = await modal.findElement(
      By.css(`nz-date-picker[formcontrolname="${controlName}"] input`),
    );
    await input.click();
    await input.clear();
    await input.sendKeys(value, Key.ENTER, Key.ESCAPE);
  }

  private async selectMultiple(
    modal: import('selenium-webdriver').WebElement,
    controlName: string,
    label: string,
  ): Promise<void> {
    const selector = await modal.findElement(
      By.css(`nz-select[formcontrolname="${controlName}"] .ant-select-selector`),
    );
    await this.driver.executeScript('arguments[0].scrollIntoView({block: "center"});', selector);
    await selector.click();
    const option = await this.driver.wait(
      until.elementLocated(
        By.xpath(
          `//div[contains(@class,'ant-select-item-option')][contains(normalize-space(.),'${label}')]`,
        ),
      ),
      config.pageLoadTimeoutMs,
    );
    await this.driver.wait(until.elementIsVisible(option), config.pageLoadTimeoutMs);
    await option.click();
    await this.driver.actions().sendKeys(Key.ESCAPE).perform();
  }

  private async requestRow(title: string): Promise<import('selenium-webdriver').WebElement> {
    return this.driver.wait(
      until.elementLocated(By.xpath(`//tr[td[normalize-space()='${title}']]`)),
      config.pageLoadTimeoutMs,
    );
  }

  private async waitForRequest(title: string, status: string): Promise<void> {
    await this.driver.wait(async () => {
      const rows = await this.driver.findElements(
        By.xpath(`//tr[td[normalize-space()='${title}']]`),
      );
      return rows.length > 0 && (await rows[0].getText()).includes(status);
    }, config.pageLoadTimeoutMs);
  }
}
