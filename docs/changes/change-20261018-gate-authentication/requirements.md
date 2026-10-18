---
change: change-20261018-gate-authentication
role: requirements
---

# Requirements

- When an API or Web request presents credentials, the service shall verify the approved Gate connection online before exposing state.
- When Gate revokes a connection, its bearer tokens and Web cookies shall be rejected on the next request; another connection shall remain usable.
- While Gate is unavailable, protected requests shall fail closed without erasing UI proposals or manufacturing a write result.
- When an expired Web token is refreshed concurrently, one session-row lock shall serialize refresh rotation and bind the result to the same subject, client and connection.
- Existing user IDs, business rows, receipts, SQL migration identifiers and explicit identity mappings shall be preserved. No email matching, signup or automatic grants shall be introduced.
- Approved clients shall receive full access without OAuth feature scopes.
