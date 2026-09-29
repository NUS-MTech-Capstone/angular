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
    console.log('  [live] Change Request form opened');

    await modal.findElement(By.css('input[formcontrolname="title"]')).sendKeys(title);
    await modal
      .findElement(By.css('textarea[formcontrolname="description"]'))
      .sendKeys('Live E2E approval-gated demo application recovery.');
    console.log('  [live] Change Request summary entered');

    const start = new Date(Date.now() + 5 * 60 * 1000);
    const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
    await this.enterDate('implementationStartAt', localMinute(start));
    await this.enterDate('implementationEndAt', localMinute(end));
    console.log('  [live] Change Request window entered');

    await this.selectMultiple('vmIds', hostId);
    console.log('  [live] Change Request target selected');

    await this.selectMultiple('implementerGroupIds', groupName);
    console.log('  [live] Change Request implementer group selected');

    const currentModal = await this.activeModal();
    const create = await currentModal.findElement(
      By.xpath(
        ".//div[contains(@class,'ant-modal-footer')]//button[.//span[normalize-space()='Create request']]",
      ),
    );
    await create.click();
    console.log('  [live] Change Request submitted');

    try {
      await this.driver.wait(until.stalenessOf(currentModal), config.pageLoadTimeoutMs);
    } catch (error) {
      const validationMessages = await this.visibleFormMessages();
      const suffix = validationMessages.length
        ? ` Visible form messages: ${validationMessages.join('; ')}`
        : '';
      throw new Error(`Change Request form did not close after submission.${suffix}`, {
        cause: error,
      });
    }

    await this.waitForRequest(title, 'Pending');
    console.log('  [live] Change Request is pending approval');
  }

  async approveRequest(title: string): Promise<void> {
    const row = await this.requestRow(title);
    const approve = await row.findElement(By.xpath(".//button[normalize-space()='Approve']"));
    await this.driver.wait(until.elementIsEnabled(approve), config.pageLoadTimeoutMs);
    await approve.click();
    await this.waitForRequest(title, 'Approved');
    console.log('  [live] Change Request is approved');
  }

  private async enterDate(controlName: string, value: string): Promise<void> {
    const modal = await this.activeModal();
    const input = await modal.findElement(
      By.css(`nz-date-picker[formcontrolname="${controlName}"] input`),
    );
    await input.click();
    await this.driver.executeScript(
      `
        arguments[0].addEventListener('keydown', (event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            event.stopPropagation();
          }
        }, { once: true });
      `,
      input,
    );
    await input.sendKeys(Key.chord(Key.META, 'a'), Key.BACK_SPACE, value, Key.ENTER);
    await this.driver.wait(async () => {
      const currentModal = await this.activeModal();
      const currentInput = await currentModal.findElement(
        By.css(`nz-date-picker[formcontrolname="${controlName}"] input`),
      );
      return (await currentInput.getAttribute('value')) === value;
    }, 10000);
  }

  private async selectMultiple(controlName: string, label: string): Promise<void> {
    await this.closeSelectDropdown();

    let lastError: unknown;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      let step = 'locating the control';
      try {
        const modal = await this.activeModal();
        const selector = await modal.findElement(
          By.css(`nz-select[formcontrolname="${controlName}"] .ant-select-selector`),
        );
        step = 'opening the dropdown';
        await this.driver.executeScript(
          'arguments[0].scrollIntoView({block: "center"});',
          selector,
        );
        await selector.click();

        step = 'filtering the options';
        const searchInput = await modal.findElement(
          By.css(
            `nz-select[formcontrolname="${controlName}"] input.ant-select-selection-search-input`,
          ),
        );
        await searchInput.sendKeys(label);

        step = 'finding the requested option';
        const option = await this.driver.wait(async () => {
          const options = await this.driver.findElements(
            By.xpath(
              `//div[contains(@class,'ant-select-item-option')][contains(normalize-space(.),'${label}')]`,
            ),
          );
          for (const candidate of options) {
            if (await candidate.isDisplayed()) {
              return candidate;
            }
          }
          return null;
        }, 10000);
        if (!option) {
          throw new Error(`Select option was not visible: ${label}`);
        }
        step = 'choosing the requested option';
        await option.click();
        step = 'confirming the selected value';
        await this.waitForSelectedValue(controlName, label);
        step = 'closing the dropdown';
        await this.closeSelectDropdown();
        return;
      } catch (error) {
        lastError = error;
        const detail = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
        console.log(`  [live] Selection attempt ${attempt + 1} failed while ${step}: ${detail}`);
        await this.closeSelectDropdown();
      }
    }
    throw lastError;
  }

  private async waitForSelectedValue(controlName: string, label: string): Promise<void> {
    await this.driver.wait(async () => {
      const modal = await this.activeModal();
      const selectedItems = await modal.findElements(
        By.css(`nz-select[formcontrolname="${controlName}"] .ant-select-selection-item`),
      );
      for (const item of selectedItems) {
        const title = (await item.getAttribute('title')) ?? '';
        const text = await item.getText();
        if (title.includes(label) || text.includes(label)) {
          return true;
        }
      }
      return false;
    }, 10000);
  }

  private async activeModal(): Promise<import('selenium-webdriver').WebElement> {
    const modal = await this.driver.wait(async () => {
      const modals = await this.driver.findElements(By.css('.ant-modal-content'));
      for (const candidate of modals) {
        if (await candidate.isDisplayed()) {
          return candidate;
        }
      }
      return null;
    }, config.pageLoadTimeoutMs);
    if (!modal) {
      throw new Error('Change Request modal is not visible.');
    }
    return modal;
  }

  private async closeSelectDropdown(): Promise<void> {
    const dropdowns = await this.driver.findElements(By.css('.ant-select-dropdown'));
    let hasVisibleDropdown = false;
    for (const dropdown of dropdowns) {
      if (await dropdown.isDisplayed()) {
        hasVisibleDropdown = true;
        break;
      }
    }
    if (!hasVisibleDropdown) {
      return;
    }

    const modal = await this.activeModal();
    const clickAway = await modal.findElement(By.css('.ant-modal-title'));
    await clickAway.click();
    await this.driver
      .wait(async () => {
        const currentDropdowns = await this.driver.findElements(By.css('.ant-select-dropdown'));
        for (const dropdown of currentDropdowns) {
          if (await dropdown.isDisplayed()) {
            return false;
          }
        }
        return true;
      }, 5000)
      .catch(() => undefined);
  }

  private async visibleFormMessages(): Promise<string[]> {
    const messages = await this.driver.findElements(
      By.css('.ant-form-item-explain-error, .ant-message-notice-content'),
    );
    const visible: string[] = [];
    for (const message of messages) {
      if (await message.isDisplayed()) {
        const text = (await message.getText()).trim();
        if (text) {
          visible.push(text);
        }
      }
    }
    return visible;
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
