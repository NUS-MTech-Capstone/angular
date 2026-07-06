import { strict as assert } from 'node:assert';
import { afterEach, beforeEach, describe, it } from 'mocha';
import { WebDriver } from 'selenium-webdriver';
import { config } from '../config';
import { AccessPage } from '../pages/access.page';
import { AppPage } from '../pages/app.page';
import { LoginPage } from '../pages/login.page';
import { createDriver, quitDriver } from '../support/driver';

describe('Navigation', () => {
  let driver: WebDriver;
  let loginPage: LoginPage;
  let appPage: AppPage;

  beforeEach(async () => {
    driver = await createDriver();
    loginPage = new LoginPage(driver);
    appPage = new AppPage(driver);

    await loginPage.open();
    await loginPage.signInAsDevUser(config.defaultDevUserName);
  });

  afterEach(async () => {
    await quitDriver(driver);
  });

  it('shows primary nav items for an admin user', async () => {
    assert.equal(await appPage.isNavItemVisible('Access'), true);
    assert.equal(await appPage.isNavItemVisible('Resources'), true);
    assert.equal(await appPage.isNavItemVisible('Change Management'), true);
    assert.equal(await appPage.isNavItemVisible('Monitoring'), false);
    assert.equal(await appPage.isNavItemVisible('Identity'), true);
  });

  it('navigates to Inventory, Change Management, and Identity', async () => {
    await appPage.navigateViaRail('Resources');
    await appPage.waitForRoute('/inventory');

    await appPage.navigateViaRail('Change Management');
    await appPage.waitForRoute('/change-management');

    await appPage.navigateViaRail('Identity');
    await appPage.waitForRoute('/identity');
  });

  it('returns to Access from the icon rail', async () => {
    await appPage.navigateViaRail('Resources');
    await appPage.waitForRoute('/inventory');

    await appPage.navigateViaRail('Access');
    await appPage.waitForRoute('/access');

    const accessPage = new AccessPage(driver);
    await accessPage.waitForLoad();
  });
});
