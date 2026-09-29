import { By, WebDriver, until } from 'selenium-webdriver';
import { config } from '../config';
import { waitForVisibleText } from '../support/driver';

export class AgenticAiPage {
  constructor(private readonly driver: WebDriver) {}

  async openIncident(incidentId: string, state: string): Promise<void> {
    await this.driver.get(
      `${config.baseUrl}/agentic-ai/incidents?incidentId=${encodeURIComponent(incidentId)}`,
    );
    await waitForVisibleText(this.driver, 'body', incidentId, 60000);
    await waitForVisibleText(this.driver, 'body', state, 60000);
  }

  async approveExactPlan(planHash: string): Promise<void> {
    await waitForVisibleText(this.driver, 'body', planHash);
    const approve = await this.driver.wait(
      until.elementLocated(
        By.xpath(
          "//button[normalize-space()='Approve' and ancestor::*[contains(@class,'ant-drawer')]]",
        ),
      ),
      config.pageLoadTimeoutMs,
    );
    await this.driver.wait(until.elementIsVisible(approve), config.pageLoadTimeoutMs);
    await approve.click();
    const confirmation = await this.driver.wait(
      until.elementLocated(By.css('.ant-modal-confirm')),
      config.pageLoadTimeoutMs,
    );
    await this.driver.wait(until.elementIsVisible(confirmation), config.pageLoadTimeoutMs);
    if (!(await confirmation.getText()).includes(planHash)) {
      throw new Error('Approval confirmation did not bind the exact incident plan hash.');
    }
    await confirmation
      .findElement(
        By.xpath(".//button[contains(@class,'ant-btn-primary')][normalize-space()='Approve']"),
      )
      .click();

    await this.driver.wait(async () => {
      const notices = await this.driver.findElements(By.css('.ant-message-notice-content'));
      for (const notice of notices) {
        if (!(await notice.isDisplayed())) {
          continue;
        }
        const text = (await notice.getText()).trim();
        if (text.includes('Remediation approved')) {
          return true;
        }
        const errorContent = await notice.findElements(By.css('.ant-message-error'));
        if (errorContent.length > 0) {
          throw new Error(`Exact-plan approval was rejected by the application: ${text}`);
        }
      }
      return false;
    }, config.pageLoadTimeoutMs);
  }
}
