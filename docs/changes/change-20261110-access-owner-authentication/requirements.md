---
change: change-20261110-access-owner-authentication
role: requirements
---

# Requirements

Preserve the existing enabled user binding, all business ownership, history,
receipts, replay, Undo and unsaved browser proposals while replacing Gate with
Cloudflare Access. Keep the person distinct from the shared AI actor. Browser,
MCP and internal task routes enforce their own audience and actor contracts.
Require Gateway JWT verification and a dedicated Cloud Run invoker, with no
public backend permission. Keep deployment values and hosted results private.
