import { strict as assert } from 'node:assert';
import { afterEach, beforeEach, describe, it } from 'mocha';
import { WebDriver } from 'selenium-webdriver';
import { config } from '../config';
import { AccessPage } from '../pages/access.page';
import { LoginPage } from '../pages/login.page';
import { createDriver, quitDriver, waitForVisibleText } from '../support/driver';

describe('Access page', () => {
  let driver: WebDriver;
  let loginPage: LoginPage;
  let accessPage: AccessPage;

  beforeEach(async () => {
    driver = await createDriver();
    loginPage = new LoginPage(driver);
    accessPage = new AccessPage(driver);

    await loginPage.open();
    await loginPage.signInAsDevUser(config.defaultDevUserName);
    await accessPage.waitForLoad();
  });

  afterEach(async () => {
    await quitDriver(driver);
  });

  it('defaults to the Change Requests section', async () => {
    assert.equal(await accessPage.getActiveSection(), 'Change Requests');
    assert.match(
      await accessPage.getSearchPlaceholder(),
      /Search change request/i,
    );
  });

  it('does not show the Servers or Proxies sections', async () => {
    const menuText = await driver.findElement({ css: '.access-menu' }).getText();
    assert.doesNotMatch(menuText, /Servers/);
    assert.doesNotMatch(menuText, /Proxies/);
  });

  it('switches to the Sessions section', async () => {
    await accessPage.selectSection('Sessions');
    assert.equal(await accessPage.getActiveSection(), 'Sessions');
    await waitForVisibleText(driver, '.access-content', 'Active Sessions');
  });
});
