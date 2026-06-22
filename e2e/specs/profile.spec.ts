import { strict as assert } from 'node:assert';
import { afterEach, beforeEach, describe, it } from 'mocha';
import { WebDriver } from 'selenium-webdriver';
import { config } from '../config';
import { AppPage } from '../pages/app.page';
import { LoginPage } from '../pages/login.page';
import { ProfilePage } from '../pages/profile.page';
import { createDriver, quitDriver } from '../support/driver';

describe('Profile', () => {
  let driver: WebDriver;
  let loginPage: LoginPage;
  let appPage: AppPage;
  let profilePage: ProfilePage;

  beforeEach(async () => {
    driver = await createDriver();
    loginPage = new LoginPage(driver);
    appPage = new AppPage(driver);
    profilePage = new ProfilePage(driver);

    await loginPage.open();
    await loginPage.signInAsDevUser(config.defaultDevUserName);
  });

  afterEach(async () => {
    await quitDriver(driver);
  });

  it('opens the profile page from the header menu', async () => {
    await appPage.openProfileFromUserMenu();
    await profilePage.waitForLoad(config.defaultDevUserName);
    assert.equal(await profilePage.getUsername(), config.defaultDevUser);
  });

  it('logs out from the profile page', async () => {
    await appPage.openProfileFromUserMenu();
    await profilePage.waitForLoad(config.defaultDevUserName);
    await profilePage.logout();
    assert.match(await driver.getCurrentUrl(), /\/login$/);
  });
});
