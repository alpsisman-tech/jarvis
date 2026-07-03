// n8n Workflow SDK source for "Jarvis · Backend (Syncs, Briefing, Actions)".
// Recreate it in any n8n instance via the MCP create-from-code flow or keep as
// reference. See README.md in this folder for the activation checklist.
import { workflow, node, trigger, sticky, placeholder, newCredential, switchCase, expr } from '@n8n/workflow-sdk';

const whoopSchedule = trigger({
  type: 'n8n-nodes-base.scheduleTrigger',
  version: 1.3,
  config: {
    name: 'Every 30 Min',
    parameters: { rule: { interval: [{ field: 'minutes', minutesInterval: 30 }] } },
    position: [240, 200]
  },
  output: [{}]
});

const syncWhoop = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Sync WHOOP',
    parameters: {
      method: 'POST',
      url: placeholder('https://YOUR-JARVIS-APP/api/whoop/sync'),
      authentication: 'genericCredentialType',
      genericAuthType: 'httpBearerAuth'
    },
    credentials: { httpBearerAuth: newCredential('Jarvis Access Token') },
    position: [540, 200]
  },
  output: [{ ok: true, recovery: 14, sleep: 14, strain: 14 }]
});

const garminSchedule = trigger({
  type: 'n8n-nodes-base.scheduleTrigger',
  version: 1.3,
  config: {
    name: 'Every 2 Hours',
    parameters: { rule: { interval: [{ field: 'hours', hoursInterval: 2 }] } },
    position: [240, 380]
  },
  output: [{}]
});

const syncGarmin = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Sync Garmin',
    parameters: {
      method: 'POST',
      url: placeholder('https://YOUR-JARVIS-APP/api/garmin/sync'),
      authentication: 'genericCredentialType',
      genericAuthType: 'httpBearerAuth'
    },
    credentials: { httpBearerAuth: newCredential('Jarvis Access Token') },
    position: [540, 380]
  },
  output: [{ ok: true, runs: 5, daily: 7 }]
});

const briefingSchedule = trigger({
  type: 'n8n-nodes-base.scheduleTrigger',
  version: 1.3,
  config: {
    name: 'Daily 06:30',
    parameters: { rule: { interval: [{ field: 'days', daysInterval: 1, triggerAtHour: 6, triggerAtMinute: 30 }] } },
    position: [240, 560]
  },
  output: [{}]
});

const sendBriefing = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Send Morning Briefing',
    parameters: {
      method: 'POST',
      url: placeholder('https://YOUR-JARVIS-APP/api/briefing'),
      authentication: 'genericCredentialType',
      genericAuthType: 'httpBearerAuth'
    },
    credentials: { httpBearerAuth: newCredential('Jarvis Access Token') },
    position: [540, 560]
  },
  output: [{ ok: true, sent_to: 'alp.sisman@gmail.com' }]
});

const actionsWebhook = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: {
    name: 'Jarvis Actions Webhook',
    parameters: { httpMethod: 'POST', path: 'jarvis-actions', responseMode: 'responseNode' },
    position: [240, 820]
  },
  output: [{ body: { action: 'send_briefing', payload: {} } }]
});

const routeAction = switchCase({
  version: 3.4,
  config: {
    name: 'Route Action',
    parameters: {
      mode: 'rules',
      rules: {
        values: [
          { renameOutput: true, outputKey: 'sync_whoop', conditions: { options: { caseSensitive: false, leftValue: '', typeValidation: 'loose' }, conditions: [{ leftValue: expr('{{ $json.body?.action ?? $json.action }}'), operator: { type: 'string', operation: 'equals' }, rightValue: 'sync_whoop' }], combinator: 'and' } },
          { renameOutput: true, outputKey: 'sync_garmin', conditions: { options: { caseSensitive: false, leftValue: '', typeValidation: 'loose' }, conditions: [{ leftValue: expr('{{ $json.body?.action ?? $json.action }}'), operator: { type: 'string', operation: 'equals' }, rightValue: 'sync_garmin' }], combinator: 'and' } },
          { renameOutput: true, outputKey: 'send_briefing', conditions: { options: { caseSensitive: false, leftValue: '', typeValidation: 'loose' }, conditions: [{ leftValue: expr('{{ $json.body?.action ?? $json.action }}'), operator: { type: 'string', operation: 'equals' }, rightValue: 'send_briefing' }], combinator: 'and' } }
        ]
      },
      options: { fallbackOutput: 'extra', renameFallbackOutput: 'unknown_action' }
    },
    position: [540, 820]
  }
});

const actionSyncWhoop = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Action: Sync WHOOP',
    parameters: {
      method: 'POST',
      url: placeholder('https://YOUR-JARVIS-APP/api/whoop/sync'),
      authentication: 'genericCredentialType',
      genericAuthType: 'httpBearerAuth'
    },
    credentials: { httpBearerAuth: newCredential('Jarvis Access Token') },
    position: [840, 680]
  },
  output: [{ ok: true, recovery: 14, sleep: 14, strain: 14 }]
});

const actionSyncGarmin = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Action: Sync Garmin',
    parameters: {
      method: 'POST',
      url: placeholder('https://YOUR-JARVIS-APP/api/garmin/sync'),
      authentication: 'genericCredentialType',
      genericAuthType: 'httpBearerAuth'
    },
    credentials: { httpBearerAuth: newCredential('Jarvis Access Token') },
    position: [840, 820]
  },
  output: [{ ok: true, runs: 5, daily: 7 }]
});

const actionSendBriefing = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Action: Send Briefing',
    parameters: {
      method: 'POST',
      url: placeholder('https://YOUR-JARVIS-APP/api/briefing'),
      authentication: 'genericCredentialType',
      genericAuthType: 'httpBearerAuth'
    },
    credentials: { httpBearerAuth: newCredential('Jarvis Access Token') },
    position: [840, 960]
  },
  output: [{ ok: true, sent_to: 'alp.sisman@gmail.com' }]
});

const respondOk = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: {
    name: 'Respond OK',
    parameters: { respondWith: 'firstIncomingItem' },
    position: [1140, 820]
  },
  output: [{ ok: true }]
});

const respondUnknown = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: {
    name: 'Respond Unknown Action',
    parameters: {
      respondWith: 'json',
      responseBody: '{ "ok": false, "error": "unknown action — use sync_whoop, sync_garmin or send_briefing" }',
      options: { responseCode: 400 }
    },
    position: [840, 1100]
  },
  output: [{ ok: false }]
});

const notes = sticky(
  '## Jarvis Backend\n\nScheduled syncs + morning briefing + the agent action webhook.\n\n**Setup:**\n1. Replace the placeholder URLs with your deployed app URL.\n2. Create the "Jarvis Access Token" Bearer credential = your JARVIS_ACCESS_TOKEN env value.\n3. Copy the production webhook URL into the app env as N8N_WEBHOOK_URL.',
  [whoopSchedule, syncWhoop],
  { color: 4 }
);

export default workflow('jarvis-backend', 'Jarvis · Backend (Syncs, Briefing, Actions)')
  .add(notes)
  .add(whoopSchedule)
  .to(syncWhoop)
  .add(garminSchedule)
  .to(syncGarmin)
  .add(briefingSchedule)
  .to(sendBriefing)
  .add(actionsWebhook)
  .to(routeAction
    .onCase(0, actionSyncWhoop.to(respondOk))
    .onCase(1, actionSyncGarmin.to(respondOk))
    .onCase(2, actionSendBriefing.to(respondOk))
    .onCase(3, respondUnknown));
