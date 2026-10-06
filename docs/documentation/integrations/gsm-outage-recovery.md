# GSM Outage Recovery

## Source

- `scripts/recover-gsm-outage.ts`

## Responsibility

One-off recovery for GSM tasks whose webhooks arrived while the GSM API was not reachable from the server (for example, on 2026-10-06, when GSM stopped accepting username/password sign-in from integrations). Those webhooks were stored and acknowledged, so GSM does not resend them. However, the fresh task fetch and the POD PDF download failed.

For every `OrderGsmTask` with `lastWebhookAt >= --since`, the script fetches the current task from GSM and then:

- logs differences between the order and GSM for driver, subcontractor and license plate (`[REVIEW]`);
- fills `driver`, `secondDriver`, `licensePlate` and `subcontractor` only where the order field is empty. It never overwrites a value. A subcontractor filled by the script is a name only and is not linked to a membership;
- updates the local task `state` when GSM reports a different one;
- downloads the POD PDF for completed tasks that have no `pod:{taskId}` attachment, using `syncPodPdfWithRetry`.

It does not change order status. It cannot find orders where "Send to GSM" failed, because failed sends leave no record; resend those from the dashboard.

## Usage

The script loads `.env`. Check the `Database:` line it prints before running with `--apply`.

- Dry run: `npm run recover:gsm-outage -- --since "2026-10-06T14:45:00+02:00"`
- Apply: `npm run recover:gsm-outage -- --since "2026-10-06T14:45:00+02:00" --apply`
