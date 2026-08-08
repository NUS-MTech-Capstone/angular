import { strict as assert } from 'node:assert';
import { after, before, describe, it } from 'mocha';
import { WebDriver } from 'selenium-webdriver';
import { config } from '../config';
import { AccessPage } from '../pages/access.page';
import { AppPage } from '../pages/app.page';
import { LoginPage } from '../pages/login.page';
import { ProfilePage } from '../pages/profile.page';
import {
  createDriver,
  presentationPause,
  presentationScene,
  quitDriver,
} from '../support/driver';

describe('DenDenMushi presentation walkthrough', () => {
  let driver: WebDriver;
  let loginPage: LoginPage;
  let appPage: AppPage;
  let accessPage: AccessPage;
  let profilePage: ProfilePage;

  before(async function () {
    this.timeout(300000);
    driver = await createDriver();
    loginPage = new LoginPage(driver);
    appPage = new AppPage(driver);
    accessPage = new AccessPage(driver);
    profilePage = new ProfilePage(driver);
  });

  after(async () => {
    await quitDriver(driver);
  });

  it('demonstrates login, access, navigation, profile, and logout', async function () {
    this.timeout(300000);

    await loginPage.open();
    await presentationScene('Login page');

    await loginPage.signInAsDevUser(config.defaultDevUserName);
    await accessPage.waitForLoad();
    await presentationScene('Access — Change Requests');

    await accessPage.selectSection('Sessions');
    await presentationScene('Access — Sessions');

    await appPage.navigateViaRail('Resources');
    await appPage.waitForRoute('/inventory');
    await presentationScene('Inventory');

    await appPage.navigateViaRail('Change Management');
    await appPage.waitForRoute('/change-management');
    await presentationScene('Change Management');

    await appPage.navigateViaRail('Identity');
    await appPage.waitForRoute('/identity');
    await presentationScene('Identity');

    await appPage.navigateViaRail('Access');
    await appPage.waitForRoute('/access');
    await accessPage.waitForLoad();
    await presentationScene('Return to Access');

    await appPage.openProfileFromUserMenu();
    await profilePage.waitForLoad(config.defaultDevUserName);
    assert.match(await profilePage.getUsername(), new RegExp(config.defaultDevUser));
    await presentationScene('User profile');

    await appPage.logoutFromHeader();
    await presentationPause('Logout complete');
  });
});
