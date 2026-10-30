---
id: change-20261030-mcp-events-webhook
kind: change
title: Deliver MCP Events to subscribed AI clients by webhook
status: draft
created: '2026-10-30'
profile: sdd@1
intent: The person sent Ask AI from an Action and no AI started work. Production logs
  showed that no client had subscribed to anything in the past week; ChatGPT, the
  AI the person uses, supports only the webhook delivery mode of the draft MCP Events
  extension, which Weave did not implement. The owner decided to add MCP Events webhook
  delivery so a subscribed AI is notified when the person sends Ask AI, without any
  always-on runtime.
outcomes:
- A 2026-07-28 client can list Weave's events and subscribe with a callback URL and
  signing secret; Weave verifies the callback before activating delivery.
- When a committed change makes collaboration work relevant to a subscribed connection
  (for example the person sends Ask AI or approves a request), Weave delivers a signed
  event to that connection's callback, with bounded retries, and never loses it to
  a process exit after commit.
- Delivery stops for a revoked connection; Gate answers whether a connection is still
  valid.
- Nothing runs, polls or holds connections while no change occurs; Cloud Run settings
  and billing stay unchanged.
- The delivery mechanics live in a module without Weave-domain dependencies so they
  can later become a shared Syntoria package.
scope:
- lib/**
- db/**
- tests/**
- scripts/**
- infra/**
- skills/action-tools/**
- ARCHITECTURE.md
- AGENTS.md
- docs/technical/**
non_goals:
- Changing the existing MCP resource subscription (resources/subscribe, GET SSE, subscriptions/listen).
- Poll or push delivery modes of MCP Events.
- Always-on runtime, instance-based billing, LISTEN/NOTIFY, or moving hosts (Railway).
- A shared Syntoria delivery service or package distribution in this change.
- Waking or starting AI work by Weave itself; the event is a hint and the subscribed
  AI decides what to do.
change_classes: []
governance:
  gate: auto
  reasons: []
members:
- role: requirements
  path: changes/change-20261030-mcp-events-webhook/requirements.md
  required: true
- role: implementation
  path: changes/change-20261030-mcp-events-webhook/implementation.md
  required: true
- role: verification
  path: changes/change-20261030-mcp-events-webhook/verification.md
  required: true
- role: ux
  path: changes/change-20261030-mcp-events-webhook/ux.md
  required: false
- role: consultation
  path: changes/change-20261030-mcp-events-webhook/consultations/delivery-recovery-and-sources.md
  required: false
promotion: []
unresolved_decisions: []
tags: []
owners: []
relations: []
source_paths: []
summary: Add MCP Events webhook delivery (events/list, subscribe, unsubscribe) so
  a subscribed AI such as ChatGPT is notified when Ask AI or other collaboration changes
  concern it, triggered from the write transaction via outbox and Cloud Tasks, with
  Gate connection checks and no always-on runtime.
---

## Summary

## Closure Notes
