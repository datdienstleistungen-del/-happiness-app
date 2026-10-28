/**
 * NeXus Continuous Radar Events API
 * Serves verified real-world corporate trigger events from the continuous research radar.
 * Supports filtering by category, mandate_priority, reality_check_status, and search query.
 * Provides POST endpoint for Human-in-the-Loop review and decision persistence.
 */

import fs from 'fs';
import path from 'path';

const REALITY_CHECK_LABELS = {
  MANDAT_BELEGT: "Mandat belegt (Externe Suche / Vergabe nachgewiesen)",
  MANDAT_PLAUSIBEL: "Mandat plausibel (Bedarf plausibel, Suche unbestätigt)",
  BEOBACHTEN: "Beobachten (Frühes / generelles Signal auf Watchlist)",
  VERWERFEN: "Verwerfen (Gelöst / Abgeschlossen / Ungeeignet)"
};

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
      }
    };
  }

  const candidatePaths = [
    path.resolve(process.cwd(), 'public', 'data', 'continuous_radar_events.json'),
    path.resolve(process.cwd(), 'data', 'research', 'continuous_radar_events.json'),
    path.resolve(process.cwd(), 'dist', 'data', 'continuous_radar_events.json'),
    path.resolve(__dirname, '..', '..', 'public', 'data', 'continuous_radar_events.json'),
    path.resolve(__dirname, '..', '..', 'data', 'research', 'continuous_radar_events.json'),
    path.resolve(__dirname, '..', '..', 'dist', 'data', 'continuous_radar_events.json')
  ];
  const candidateHistoryPaths = [
    path.resolve(process.cwd(), 'public', 'data', 'continuous_radar_history.json'),
    path.resolve(process.cwd(), 'data', 'research', 'continuous_radar_history.json'),
    path.resolve(process.cwd(), 'dist', 'data', 'continuous_radar_history.json'),
    path.resolve(__dirname, '..', '..', 'public', 'data', 'continuous_radar_history.json'),
    path.resolve(__dirname, '..', '..', 'data', 'research', 'continuous_radar_history.json'),
    path.resolve(__dirname, '..', '..', 'dist', 'data', 'continuous_radar_history.json')
  ];

  let rawData = null;
  let loadedFromPath = null;
  for (const p of candidatePaths) {
    if (fs.existsSync(p)) {
      try {
        const content = fs.readFileSync(p, 'utf-8');
        rawData = JSON.parse(content);
        loadedFromPath = p;
        break;
      } catch {
        // try next
      }
    }
  }

  let rawHistory = null;
  let loadedHistoryPath = null;
  for (const p of candidateHistoryPaths) {
    if (fs.existsSync(p)) {
      try {
        const content = fs.readFileSync(p, 'utf-8');
        rawHistory = JSON.parse(content);
        loadedHistoryPath = p;
        break;
      } catch {
        // try next
      }
    }
  }

  const params = event.queryStringParameters || {};

  // =========================================================================
  // VIEW=HISTORY: Return Radar Run History & Telemetry
  // =========================================================================
  if (params.view === 'history') {
    const runs = rawHistory?.runs || [];
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        status: 'OK',
        total_runs: runs.length,
        last_updated: rawHistory?.last_updated || null,
        runs: runs,
        latest_run: runs[0] || null,
        storage_info: {
          loaded_from: loadedHistoryPath,
          source_file_exists: Boolean(loadedHistoryPath)
        }
      })
    };
  }

  // =========================================================================
  // POST Handler: Human-in-the-Loop Review Persistence
  // =========================================================================
  if (event.httpMethod === 'POST') {
    try {
      const body = JSON.parse(event.body || '{}');
      const { event_id, reviewer_decision, reviewer_notes, confirmed } = body;

      if (!event_id) {
        return {
          statusCode: 400,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify({ error: 'event_id is required' })
        };
      }

      if (!rawData || !Array.isArray(rawData.events)) {
        return {
          statusCode: 404,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify({ error: 'Event store not found or empty' })
        };
      }

      const targetEvent = rawData.events.find(e => e.event_id === event_id);
      if (!targetEvent) {
        return {
          statusCode: 404,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify({ error: `Event with id ${event_id} not found` })
        };
      }

      // Initialize reality check structure if missing
      if (!targetEvent.reality_check) {
        targetEvent.reality_check = {};
      }
      if (!Array.isArray(targetEvent.reality_check_history)) {
        targetEvent.reality_check_history = [];
      }

      const oldStatus = targetEvent.reality_check.status || 'BEOBACHTEN';
      const newStatus = reviewer_decision || oldStatus;
      const nowIso = new Date().toISOString();

      // Record Human-in-the-Loop decision
      targetEvent.reality_check.human_review = {
        reviewed: true,
        reviewed_at: nowIso,
        reviewer_decision: newStatus,
        reviewer_notes: (reviewer_notes || '').trim(),
        confirmed: Boolean(confirmed)
      };

      if (newStatus !== oldStatus) {
        targetEvent.reality_check_history.push({
          evaluated_at: nowIso,
          previous_status: oldStatus,
          new_status: newStatus,
          status_changed: true,
          reviewer_notes: (reviewer_notes || '').trim(),
          transition_rationale: `Human-in-the-Loop Entscheidung: Status manuell von ${oldStatus} auf ${newStatus} gesetzt.`
        });
        targetEvent.reality_check.status = newStatus;
        targetEvent.reality_check.status_label = REALITY_CHECK_LABELS[newStatus] || newStatus;
      } else if (confirmed) {
        targetEvent.reality_check_history.push({
          evaluated_at: nowIso,
          previous_status: oldStatus,
          new_status: oldStatus,
          status_changed: false,
          reviewer_notes: (reviewer_notes || '').trim(),
          transition_rationale: `Human-in-the-Loop Bestätigung: System-Einstufung ${oldStatus} durch Prüfer bestätigt.`
        });
      }

      targetEvent.last_checked_at = nowIso;
      rawData.last_updated = nowIso;

      // Persist to primary data and mirror to public if filesystem allows
      let writeSuccess = false;
      let writeError = null;
      const targetWritePath = loadedFromPath || candidatePaths[0];
      try {
        if (targetWritePath) {
          fs.writeFileSync(targetWritePath, JSON.stringify(rawData, null, 2), 'utf-8');
          writeSuccess = true;
        }
      } catch (err) {
        writeError = err.message;
        console.warn('Primary file write skipped/failed (expected on Netlify read-only runtime):', err.message);
      }
      try {
        const publicWritePath = candidatePaths.find(p => p.includes('public')) || candidatePaths[0];
        if (publicWritePath && publicWritePath !== targetWritePath) {
          fs.writeFileSync(publicWritePath, JSON.stringify(rawData, null, 2), 'utf-8');
        }
      } catch (err) {
        // secondary mirror
      }

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({
          status: 'OK',
          persistence_mode: writeSuccess ? 'filesystem_durable' : 'client_storage_required',
          warning: writeSuccess ? null : 'Serverless filesystem is read-only (Netlify AWS Lambda). Changes must be mirrored in client-side localStorage.',
          message: 'Human review processed successfully',
          event: targetEvent
        })
      };
    } catch (err) {
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: 'Failed to process human review', details: err.message })
      };
    }
  }

  // =========================================================================
  // GET Handler: Serves continuous radar events with filtering
  // =========================================================================
  try {
    if (!rawData) {
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          status: 'EMPTY',
          total_events: 0,
          events: []
        })
      };
    }

    let events = rawData.events || [];
    const category = params.category;
    const priority = params.priority;
    const realityCheckStatus = params.reality_check_status;
    const freshness = params.freshness;
    const q = (params.q || '').toLowerCase().trim();

    if (category) {
      events = events.filter(e => e.category === category);
    }

    if (priority) {
      events = events.filter(e => e.mandate_priority === priority);
    }

    if (realityCheckStatus) {
      events = events.filter(e => e.reality_check && e.reality_check.status === realityCheckStatus);
    }

    if (freshness) {
      const targetFreshness = (freshness === 'HOT' || freshness === 'HOT_FIRST_MOVER') ? 'HOT_FIRST_MOVER' : freshness;
      events = events.filter(e => e.freshness_category === targetFreshness);
    }

    if (q) {
      events = events.filter(e => {
        const text = `${e.company_name} ${e.description} ${e.evidence_text} ${e.mandate_rationale} ${e.reality_check?.rationale || ''}`.toLowerCase();
        return text.includes(q);
      });
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        status: 'OK',
        total_events: events.length,
        version: rawData.version || '1.3.0',
        last_updated: rawData.last_updated,
        events
      })
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        error: 'Failed to load continuous radar events',
        details: err.message
      })
    };
  }
};
