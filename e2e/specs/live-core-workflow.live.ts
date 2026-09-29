import { strict as assert } from 'node:assert';
import { after, before, describe, it } from 'mocha';
import { WebDriver } from 'selenium-webdriver';
import { config } from '../config';
import { AccessPage } from '../pages/access.page';
import { AgenticAiPage } from '../pages/agentic-ai.page';
import { AppPage } from '../pages/app.page';
import { ChangeManagementPage } from '../pages/change-management.page';
import { LoginPage } from '../pages/login.page';
import { TerminalPage } from '../pages/terminal.page';
import { createDriver, quitDriver, waitForUrlContains } from '../support/driver';
import { authenticatedJson, pollFor } from '../support/live-api';
import { assertExpectedAwsAccount, waitForAlarmState } from '../support/live-aws';
import {
  captureEvidence,
  clearInjectionMarker,
  markInjectionActive,
} from '../support/live-evidence';

interface AuthProfile {
  name: string;
  roles: string[];
  permissions: string[];
}

interface ChangeRequest {
  id: string;
  title: string;
  status: string;
}

interface SessionRecord {
  sessionId: string;
  hostId: string;
  crId: string;
  status: string;
}

interface IncidentSummary {
  id: string;
  alarmName: string;
  hostId: string;
  state: string;
  createdAt: string;
}

interface IncidentDetail extends IncidentSummary {
  planHash: string;
  plan: { actions: Array<{ operationId: string }> };
  timeline: Array<{ eventType: string; metadata: Record<string, unknown> }>;
  approvalDecisions: Array<{
    submittedPlanHash: string;
    outcome: string;
  }>;
  postIncidentReport?: { finalState?: string; verificationSummary?: string };
}

describe('Live core workflow', () => {
  let driver: WebDriver;
  let sessionId = '';

  before(async function () {
    this.timeout(60000);
    clearInjectionMarker();
    await assertExpectedAwsAccount();
    driver = await createDriver();
  });

  after(async function () {
    this.timeout(60000);
    if (driver && sessionId) {
      try {
        await authenticatedJson(driver, `/sessions/${sessionId}/close`, 'POST', {});
      } catch (error) {
        console.error(`Session close failed: ${(error as Error).message}`);
      }
    }
    if (driver) {
      await quitDriver(driver);
    }
  });

  it('creates approved access, uses SSH, and completes approval-gated recovery', async function () {
    this.timeout(1_500_000);

    await waitForAlarmState('OK', 60000);
    const loginPage = new LoginPage(driver);
    const appPage = new AppPage(driver);
    await loginPage.open();
    await loginPage.signInWithCognito(config.cognitoUsername, config.cognitoPassword);
    console.log('  [live] Cognito authentication complete');

    assert.equal(await appPage.getDisplayName(), config.expectedDisplayName);
    const profile = await authenticatedJson<AuthProfile>(driver, '/ddm/auth/me');
    assert.equal(profile.name, config.expectedDisplayName);
    assert.deepEqual(profile.roles, ['Admin']);
    for (const permission of ['change.create', 'change.approve', 'access.launch']) {
      assert.ok(profile.permissions.includes(permission), `Missing Admin permission ${permission}`);
    }

    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const title = `Live E2E demo recovery ${stamp}`;
    const changePage = new ChangeManagementPage(driver);
    await changePage.open();
    await changePage.createRequest(title, config.targetHostId, 'DenDenMushi Demo Operators');
    await changePage.approveRequest(title);
    console.log('  [live] Change Request created and approved');

    const changeRequest = await pollFor(
      'the approved Change Request API record',
      config.pageLoadTimeoutMs,
      async () => {
        const requests = await authenticatedJson<ChangeRequest[]>(driver, '/ddm/change-requests');
        return requests.find((request) => request.title === title && request.status === 'Approved');
      },
      2000,
    );
    await captureEvidence(driver, '01-approved-change-request.png');

    const accessPage = new AccessPage(driver);
    await driver.get(`${config.baseUrl}/access`);
    await accessPage.waitForLoad();
    await accessPage.selectChangeRequestByTitle(title);
    await accessPage.launchSshForServer(config.targetHostId);
    const terminalPath = await accessPage.getCapturedTerminalPath();
    assert.ok(terminalPath, 'Expected Access to open a terminal URL.');
    await driver.get(`${config.baseUrl}${terminalPath}`);
    await waitForUrlContains(driver, '/terminal');

    const terminal = new TerminalPage(driver);
    await terminal.waitForLoad();
    await terminal.waitForConnected(60000);
    await terminal.runCommand('echo __DDM_WHOAMI__; whoami');
    await terminal.waitForOutput('__DDM_WHOAMI__');
    await terminal.waitForOutput('ec2-user');
    await terminal.runCommand('echo __DDM_PWD__; pwd');
    await terminal.waitForOutput('/home/ec2-user');
    await terminal.runCommand('echo __DDM_HOSTNAME__; hostname');
    await terminal.waitForOutput(config.targetHostId);
    await terminal.runCommand(
      'curl -fsS http://127.0.0.1:18080/healthz >/dev/null && echo __DDM_DEMO_HEALTHY__',
    );
    await terminal.waitForOutput('__DDM_DEMO_HEALTHY__');
    await captureEvidence(driver, '02-connected-terminal.png');
    console.log('  [live] SSH commands and healthy demo check complete');

    const session = await pollFor(
      'the active SSH session record',
      60000,
      async () => {
        const response = await authenticatedJson<{ sessions: SessionRecord[] }>(
          driver,
          `/sessions?hostId=${encodeURIComponent(config.targetHostId)}&crId=${encodeURIComponent(changeRequest.id)}&status=ACTIVE&mine=true`,
        );
        return response.sessions.find((candidate) => candidate.status === 'ACTIVE');
      },
      2000,
    );
    sessionId = session.sessionId;

    const triggerAt = new Date();
    await terminal.runCommand(
      'curl -fsS -XPOST http://127.0.0.1:18080/admin/fail >/dev/null && echo __DDM_DEMO_FAILED__',
    );
    await terminal.waitForOutput('__DDM_DEMO_FAILED__');
    markInjectionActive();
    await terminal.runCommand(
      "code=$(curl -sS -o /dev/null -w '%{http_code}' http://127.0.0.1:18080/healthz); echo __DDM_UNHEALTHY__${code}",
    );
    await terminal.waitForOutput('__DDM_UNHEALTHY__503');
    console.log('  [live] Demo application failure injected');

    await waitForAlarmState('ALARM', config.alarmTimeoutMs);
    console.log('  [live] CloudWatch alarm reached ALARM');
    const incident = await pollFor(
      'a new incident awaiting exact-plan approval',
      config.incidentTimeoutMs,
      async () => {
        const response = await authenticatedJson<{ incidents: IncidentSummary[] }>(
          driver,
          `/incidents?hostId=${encodeURIComponent(config.targetHostId)}&limit=50`,
        );
        const candidate = response.incidents.find(
          (item) =>
            item.alarmName === config.demoAlarmName &&
            new Date(item.createdAt).getTime() >= triggerAt.getTime() - 30000,
        );
        if (candidate?.state === 'FAILED') {
          throw new Error(`Incident ${candidate.id} failed before approval.`);
        }
        return candidate?.state === 'AWAITING_APPROVAL' ? candidate : undefined;
      },
    );

    let detail = await authenticatedJson<IncidentDetail>(driver, `/incidents/${incident.id}`);
    assert.equal(detail.plan.actions.length, 1, 'Expected one reviewed remediation action.');
    const operationId = detail.plan.actions[0].operationId;
    assert.ok(
      ['recover_demo_app', 'restart_service', 'reload_service'].includes(operationId),
      `Unexpected remediation operation ${operationId}`,
    );
    assert.ok(detail.planHash, 'Expected a stored plan hash.');
    console.log('  [live] Incident reached AWAITING_APPROVAL');

    const terminalHandle = await driver.getWindowHandle();
    await driver.switchTo().newWindow('tab');
    const agentPage = new AgenticAiPage(driver);
    await agentPage.openIncident(incident.id, 'AWAITING_APPROVAL');
    await captureEvidence(driver, '03-awaiting-approval-plan.png');
    await agentPage.approveExactPlan(detail.planHash);
    console.log('  [live] Exact plan approved through the UI');

    detail = await pollFor(
      'approval-gated remediation to complete',
      config.remediationTimeoutMs,
      async () => {
        const current = await authenticatedJson<IncidentDetail>(
          driver,
          `/incidents/${incident.id}`,
        );
        if (current.state === 'FAILED' || current.state === 'REJECTED') {
          throw new Error(`Incident ${incident.id} entered terminal state ${current.state}.`);
        }
        return current.state === 'COMPLETED' ? current : undefined;
      },
    );
    assert.equal(detail.postIncidentReport?.finalState, 'COMPLETED');
    assert.match(detail.postIncidentReport?.verificationSummary ?? '', /service_status exit=0/);
    assert.match(detail.postIncidentReport?.verificationSummary ?? '', /health_check exit=0/);
    await agentPage.openIncident(incident.id, 'COMPLETED');
    await captureEvidence(driver, '04-completed-remediation.png');
    console.log('  [live] Bounded remediation and fixed verification completed');

    const eventTypes = new Set(detail.timeline.map((event) => event.eventType));
    for (const eventType of [
      'AlertReceived',
      'AgentTriaged',
      'EvidenceCollected',
      'PlanProposed',
      'PlanApproved',
      'VerificationOperationExecuted',
      'VerificationPassed',
    ]) {
      assert.ok(eventTypes.has(eventType), `Missing incident audit event ${eventType}`);
    }
    assert.ok(
      eventTypes.has('OperationExecuted') || eventTypes.has('RemediationExecuted'),
      'Missing bounded tool execution event.',
    );
    assert.ok(
      detail.approvalDecisions.some(
        (decision) =>
          decision.outcome === 'SUCCEEDED' && decision.submittedPlanHash === detail.planHash,
      ),
      'Exact plan-hash approval audit record was not retained.',
    );
    const auditText = JSON.stringify({
      timeline: detail.timeline,
      decisions: detail.approvalDecisions,
    });
    assert.doesNotMatch(auditText, /Bearer\s+|BEGIN [A-Z ]*PRIVATE KEY|eyJ[a-zA-Z0-9_-]+\./);

    await driver.close();
    await driver.switchTo().window(terminalHandle);
    await terminal.runCommand(
      'curl -fsS http://127.0.0.1:18080/healthz >/dev/null && echo __DDM_RECOVERY_VERIFIED__',
    );
    await terminal.waitForOutput('__DDM_RECOVERY_VERIFIED__', config.recoveryTimeoutMs);
    await waitForAlarmState('OK', config.recoveryTimeoutMs);
    clearInjectionMarker();
    console.log('  [live] Target health and CloudWatch alarm recovered');

    const closed = await authenticatedJson<SessionRecord>(
      driver,
      `/sessions/${sessionId}/close`,
      'POST',
      {},
    );
    assert.equal(closed.status, 'CLOSED');
    sessionId = '';
  });
});
