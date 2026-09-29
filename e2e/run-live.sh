#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
WORKSPACE_DIR=$(cd "${ROOT_DIR}/.." && pwd)
AWS_PROFILE=${AWS_PROFILE:-capstone}
EXPECTED_AWS_ACCOUNT_ID=${EXPECTED_AWS_ACCOUNT_ID:-891377133321}
AWS_REGION=${AWS_REGION:-ap-southeast-1}
KEYCHAIN_SERVICE=${E2E_KEYCHAIN_SERVICE:-DenDenMushi E2E Cognito}
E2E_COGNITO_USERNAME=${E2E_COGNITO_USERNAME:-kei-admin@ddm.keiyam.me}
TARGET_TERRAFORM_DIR=${TARGET_TERRAFORM_DIR:-"${WORKSPACE_DIR}/target-hosts-setup"}
E2E_INJECTION_MARKER=${E2E_INJECTION_MARKER:-"${ROOT_DIR}/e2e/artifacts/.live-injection-active"}

for command in aws terraform security; do
  if ! command -v "${command}" >/dev/null 2>&1; then
    echo "Required command not found: ${command}" >&2
    exit 1
  fi
done

export AWS_PROFILE EXPECTED_AWS_ACCOUNT_ID E2E_COGNITO_USERNAME E2E_INJECTION_MARKER
ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
if [[ "${ACCOUNT}" != "${EXPECTED_AWS_ACCOUNT_ID}" ]]; then
  echo "Refusing live E2E in account ${ACCOUNT}; expected ${EXPECTED_AWS_ACCOUNT_ID}." >&2
  exit 1
fi

E2E_COGNITO_PASSWORD=$(security find-generic-password \
  -s "${KEYCHAIN_SERVICE}" -a "${E2E_COGNITO_USERNAME}" -w)
export E2E_COGNITO_PASSWORD
trap 'unset E2E_COGNITO_PASSWORD' EXIT

export E2E_LIVE=true
export E2E_BASE_URL=${E2E_BASE_URL:-https://api.ddm.keiyam.me}
export E2E_API_URL=${E2E_API_URL:-https://api.ddm.keiyam.me/ddm}
export E2E_EXPECTED_DISPLAY_NAME=${E2E_EXPECTED_DISPLAY_NAME:-kei-admin}
export E2E_TARGET_HOST_ID=${E2E_TARGET_HOST_ID:-$(terraform -chdir="${TARGET_TERRAFORM_DIR}" output -raw host_id)}
export E2E_DEMO_ALARM_NAME=${E2E_DEMO_ALARM_NAME:-$(terraform -chdir="${TARGET_TERRAFORM_DIR}" output -raw demo_app_unhealthy_alarm_name)}
export E2E_HEADLESS=${E2E_HEADLESS:-true}
export E2E_ARTIFACT_DIR=${E2E_ARTIFACT_DIR:-"${ROOT_DIR}/e2e/artifacts/$(date -u +%Y%m%dT%H%M%SZ)"}

mkdir -p "$(dirname "${E2E_INJECTION_MARKER}")"
rm -f -- "${E2E_INJECTION_MARKER}"

set +e
"${ROOT_DIR}/node_modules/.bin/mocha" \
  --no-config \
  --timeout 1500000 \
  --require tsx/cjs \
  --require "${ROOT_DIR}/e2e/support/setup.ts" \
  "${ROOT_DIR}/e2e/specs/live-core-workflow.live.ts"
STATUS=$?
set -e
unset E2E_COGNITO_PASSWORD

if [[ "${STATUS}" != "0" && -f "${E2E_INJECTION_MARKER}" ]]; then
  echo "Live E2E failed after demo injection; invoking bounded SSM recovery." >&2
  ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
  if [[ "${ACCOUNT}" == "${EXPECTED_AWS_ACCOUNT_ID}" ]]; then
    INSTANCE_ID=$(terraform -chdir="${TARGET_TERRAFORM_DIR}" output -raw instance_id)
    COMMAND_ID=$(aws ssm send-command \
      --region "${AWS_REGION}" \
      --instance-ids "${INSTANCE_ID}" \
      --document-name AWS-RunShellScript \
      --parameters 'commands=["sudo /usr/local/sbin/ddm-ops recover_demo_app"]' \
      --query 'Command.CommandId' \
      --output text)
    aws ssm wait command-executed \
      --region "${AWS_REGION}" \
      --command-id "${COMMAND_ID}" \
      --instance-id "${INSTANCE_ID}" || true
    for _ in $(seq 1 30); do
      ALARM_STATE=$(aws cloudwatch describe-alarms \
        --region "${AWS_REGION}" \
        --alarm-names "${E2E_DEMO_ALARM_NAME}" \
        --query 'MetricAlarms[0].StateValue' \
        --output text)
      [[ "${ALARM_STATE}" == "OK" ]] && break
      sleep 10
    done
  fi
fi

exit "${STATUS}"
