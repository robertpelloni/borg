"use strict";
// Consensus gate: evaluates orchestrator state to enforce a minimum successful model count
// Policy is configurable via environment variables:
//   MIN_MODELS (default: 2)
//   ALLOW_STALE_DAYS (default: 14)
//   SOFT_FAIL (default: false) — when true, logs a warning instead of failing the job
//   STATE_PATH (default: ../AI_COORDINATION/orchestrator_state.json)

const fs = require("fs");
const path = require("path");

function loadJson(p) {
  try {
    const txt = fs.readFileSync(p, "utf8");
    return JSON.parse(txt);
  } catch (err) {
    console.error(`CONSENSUS_GATE_ERROR: failed to read/parse state file at ${p}:`, err.message);
    process.exit(2);
  }
}

function parseIsoDate(s) {
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

(function main() {
  const MIN_MODELS = parseInt(process.env.MIN_MODELS || "2", 10);
  const ALLOW_STALE_DAYS = parseInt(process.env.ALLOW_STALE_DAYS || "14", 10);
  const SOFT_FAIL = String(process.env.SOFT_FAIL || "false").toLowerCase() === "true";
  const STATE_PATH = process.env.STATE_PATH || path.resolve(__dirname, "../AI_COORDINATION/orchestrator_state.json");

  const state = loadJson(STATE_PATH);

  // Validate staleness
  const lastUpdatedStr = state.lastUpdated || state.updated || null;
  const lastUpdated = lastUpdatedStr ? parseIsoDate(lastUpdatedStr) : null;
  if (!lastUpdated) {
    const msg = `CONSENSUS_GATE_FAIL: missing or unparsable lastUpdated in state.`;
    if (SOFT_FAIL) {
      console.warn(msg);
      process.exit(0);
    }
    console.error(msg);
    process.exit(3);
  }
  const ageMs = Date.now() - lastUpdated.getTime();
  const maxAgeMs = ALLOW_STALE_DAYS * 24 * 60 * 60 * 1000;
  const isStale = ageMs > maxAgeMs;

  // Determine latest task summary if available
  let latestTask = null;
  if (Array.isArray(state.tasks) && state.tasks.length > 0) {
    const last = state.tasks[state.tasks.length - 1];
    if (Array.isArray(last) && last.length === 2 && last[1] && typeof last[1] === "object") {
      latestTask = last[1];
    }
  }

  // Derive metrics
  const consensus = (latestTask && latestTask.consensus) || state.consensus || {};
  const modelCount = Number(consensus.modelCount || 0);
  const recommendation = consensus.recommendation || "unknown";
  const status = (latestTask && latestTask.status) || "unknown";

  // Policy evaluation
  const passesModels = modelCount >= MIN_MODELS;
  const passesStatus = status === "completed"; // lenient; adjust if stricter status required
  const passesStaleness = !isStale;

  const summary = {
    statePath: STATE_PATH,
    lastUpdated: lastUpdatedStr,
    ageDays: Math.round(ageMs / (24 * 60 * 60 * 1000)),
    modelCount,
    minModelsRequired: MIN_MODELS,
    status,
    recommendation,
    allowStaleDays: ALLOW_STALE_DAYS,
    isStale,
    passes: passesModels && passesStatus && passesStaleness
  };

  console.log("CONSENSUS_GATE_SUMMARY:\n" + JSON.stringify(summary, null, 2));

  if (summary.passes) {
    console.log("CONSENSUS_GATE_PASS: requirements met.");
    process.exit(0);
  }

  const reasons = [];
  if (!passesModels) reasons.push(`modelCount(${modelCount}) < MIN_MODELS(${MIN_MODELS})`);
  if (!passesStatus) reasons.push(`status('${status}') != 'completed'`);
  if (!passesStaleness) reasons.push(`state is stale (> ${ALLOW_STALE_DAYS} days)`);

  const failMsg = `CONSENSUS_GATE_FAIL: ${reasons.join("; ")}`;
  if (SOFT_FAIL) {
    console.warn(failMsg);
    process.exit(0);
  } else {
    console.error(failMsg);
    process.exit(1);
  }
})();
