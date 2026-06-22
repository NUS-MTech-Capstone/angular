import { strict as assert } from 'node:assert';
import { afterEach, beforeEach, describe, it } from 'mocha';
import { WebDriver } from 'selenium-webdriver';
import { config } from '../config';
import { LoginPage } from '../pages/login.page';
import { AppPage } from '../pages/app.page';
import { createDriver, quitDriver } from '../support/driver';

describe('Login', () => {
  let driver: WebDriver;
  let loginPage: LoginPage;
  let appPage: AppPage;

  beforeEach(async () => {
    driver = await createDriver();
    loginPage = new LoginPage(driver);
    appPage = new AppPage(driver);
  });

  afterEach(async () => {
    await quitDriver(driver);
  });

  it('shows the DenDenMushi login page in dev mode', async () => {
    await loginPage.open();
    assert.equal(await loginPage.getErrorMessage(), null);
  });

  it('signs in with a dev user and lands on Access', async () => {
    await loginPage.open();
    await loginPage.signInAsDevUser(config.defaultDevUserName);

    assert.match(await driver.getCurrentUrl(), /\/access$/);
    assert.equal(await appPage.getDisplayName(), config.defaultDevUserName);
  });
});
