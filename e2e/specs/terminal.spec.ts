import { strict as assert } from 'node:assert';
import { afterEach, beforeEach, describe, it } from 'mocha';
import { WebDriver } from 'selenium-webdriver';
import { config } from '../config';
import { AccessPage } from '../pages/access.page';
import { LoginPage } from '../pages/login.page';
import { TerminalPage } from '../pages/terminal.page';
import {
  createDriver,
  quitDriver,
  waitForUrlContains,
} from '../support/driver';

describe('SSH terminal session', () => {
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

  it('opens a terminal from Access, runs commands, and closes the session', async function () {
    this.timeout(90000);

    const hostname = await accessPage.getFirstServerHostname();
    await accessPage.launchSshForServer(hostname);

    const terminalPath = await accessPage.getCapturedTerminalPath();
    assert.ok(terminalPath, 'Expected Access to open a terminal URL');

    await driver.get(`${config.baseUrl}${terminalPath}`);
    await waitForUrlContains(driver, '/terminal');

    const terminalPage = new TerminalPage(driver);
    await terminalPage.waitForLoad();
    await terminalPage.waitForConnected();

    const sessionTarget = await terminalPage.getSessionTarget();
    assert.match(
      sessionTarget,
      new RegExp(hostname.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
    );

    await terminalPage.runCommand('whoami');
    await terminalPage.waitForOutput('ec2-user');

    await terminalPage.runCommand('pwd');
    await terminalPage.waitForOutput('/home/ec2-user');

    await terminalPage.runCommand('hostname');
    await terminalPage.waitForOutput(hostname);

    await driver.get(`${config.baseUrl}/access`);
    await accessPage.waitForLoad();
    assert.equal(await accessPage.getActiveSection(), 'Change Requests');
  });
});
