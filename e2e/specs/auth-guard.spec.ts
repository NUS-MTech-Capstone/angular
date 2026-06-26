import { strict as assert } from 'node:assert';
import { afterEach, beforeEach, describe, it } from 'mocha';
import { WebDriver } from 'selenium-webdriver';
import { config } from '../config';
import { LoginPage } from '../pages/login.page';
import { createDriver, quitDriver, waitForUrlContains, waitForVisibleText } from '../support/driver';

describe('Auth guards', () => {
  let driver: WebDriver;
  let loginPage: LoginPage;

  beforeEach(async () => {
    driver = await createDriver();
    loginPage = new LoginPage(driver);
  });

  afterEach(async () => {
    await quitDriver(driver);
  });

  it('redirects unauthenticated users from protected routes to login', async () => {
    await driver.get(`${config.baseUrl}/inventory`);
    await waitForVisibleText(driver, '.login-brand h1', 'DenDenMushi');
    assert.match(await driver.getCurrentUrl(), /\/login$/);
  });

  it('redirects the home route to login when signed out', async () => {
    await driver.get(config.baseUrl);
    await waitForVisibleText(driver, '.login-brand h1', 'DenDenMushi');
    assert.match(await driver.getCurrentUrl(), /\/login$/);
  });

  it('allows an employee dev user to reach Access but not Identity', async () => {
    await loginPage.open();
    await loginPage.signInAsDevUser('Evan Employee');

    await driver.get(`${config.baseUrl}/access`);
    assert.match(await driver.getCurrentUrl(), /\/access$/);

    await driver.get(`${config.baseUrl}/identity`);
    await waitForUrlContains(driver, '/profile');
    assert.match(await driver.getCurrentUrl(), /\/profile$/);
  });
});
