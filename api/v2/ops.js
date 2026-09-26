// One deployed function for the machine-to-machine endpoints, so the project
// stays within the Hobby plan's 12-functions-per-deployment limit. Public URLs
// are unchanged: vercel.json rewrites each one here with `?op=`, and every
// handler keeps its own method check and auth.
//
//   /api/csp-report         -> _cspReport.js     (browser CSP reports, public)
//   /api/v2/security-alert  -> _securityAlert.js (pg_cron, ALERT_CRON_SECRET)
//   /api/agent/transmit     -> _agentTransmit.js (AI agents, AGENT_SECRET_KEY)
import cspReport from './_cspReport.js';
import securityAlert from './_securityAlert.js';
import agentTransmit from './_agentTransmit.js';

const HANDLERS = {
  'csp-report': cspReport,
  'security-alert': securityAlert,
  'agent-transmit': agentTransmit,
};

export default function handler(req, res) {
  const op = Array.isArray(req.query?.op) ? req.query.op[0] : req.query?.op;
  const route = Object.hasOwn(HANDLERS, op) ? HANDLERS[op] : null;
  if (!route) return res.status(404).json({ error: 'NOT_FOUND' });
  return route(req, res);
}
