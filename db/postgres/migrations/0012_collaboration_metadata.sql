-- Caller-managed operational text kept beside the human-facing proposal and report text. It is
-- returned by reads and never shown in the UI. Records saved before this migration had none, which
-- is the empty text they now state. Collaboration bodies are serialized JSON objects that begin with
-- a key, so the member is spliced in front without reinterpreting any stored text.
UPDATE state.collaborations SET body='{"metadata":"",'||substr(body,2)
 WHERE left(body,2)='{"' AND position('"metadata":' in body)=0;
UPDATE state.collaboration_history SET body='{"metadata":"",'||substr(body,2)
 WHERE left(body,2)='{"' AND position('"metadata":' in body)=0;
