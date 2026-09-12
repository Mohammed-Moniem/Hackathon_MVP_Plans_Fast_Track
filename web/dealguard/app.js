'use strict';

(() => {
  const $ = (id) => document.getElementById(id);
  const escape = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const number = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
  const finite = (value) => typeof value === 'number' && Number.isFinite(value);
  const money = (value) => finite(value) ? `AED ${number.format(value)}` : 'Not available';
  const largeMoney = (value) => finite(value) ? `<span class="currency">AED</span>${number.format(value)}` : '—';
  const time = (value) => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 'Time unavailable' : new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Dubai' }).format(date) + ' GST';
  };
  const fullTime = (value) => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Dubai' }).format(date) + ' GST';
  };
  const arrow = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7v10h10M7 17 17 7"/></svg>';
  // These are editable example messages from src/fixtures.ts, never fabricated analysis.
  const examples = {
    initial: 'For the same service scope, our revised offer is AED 1,050,000 per year plus AED 90,000 one-time setup, provided you commit to 36 months. Payment terms are net 30 days.',
    followup: 'We can agree to your AED 1,040,000 annual price, zero setup fee and net 60 payment terms, but only for a 48-month commitment. Please accept today.',
  };
  const statuses = {
    draft: ['Processing', 'processing', 'Review in progress'],
    pending: ['Needs approval', 'pending', 'A counteroffer for your review'],
    blocked: ['On hold', 'warning', 'Pause. The terms need attention.'],
    held: ['On hold', 'warning', 'Pause. The terms need attention.'],
    rejected: ['Rejected', 'neutral', 'Counteroffer rejected'],
    stale: ['Stale', 'neutral', 'A newer offer needs review'],
    sending: ['Sending', 'processing', 'Waiting for a delivery receipt'],
    sent: ['Sent', 'success', 'Counteroffer delivered'],
    uncertain: ['Delivery uncertain', 'warning', 'Delivery needs verification'],
    failed: ['Review failed', 'danger', 'This review could not complete'],
  };
  const activityLabels = {
    supplier_message: 'Supplier message received', proposal_staged: 'Decision staged', approval_requested: 'Buyer approval requested',
    policy_block: 'Policy hold applied', approval_recorded: 'Approval recorded', proposal_rejected: 'Counteroffer rejected',
    send_started: 'Delivery started', counteroffer_sent: 'Counteroffer delivered', delivery_uncertain: 'Delivery is uncertain',
    reconciliation_pending: 'No delivery receipt found', agent_failed: 'Review failed', agent_started: 'Agent review started',
    agent_progress: 'Review progress', tool_result: 'Review step completed',
  };
  let state = null;
  let busy = null;
  let connected = false;
  let selectedId = null;
  let showAllActivity = false;
  let requestedMode = null;
  let pollTimer = null;
  let polling = false;
  let epoch = 0;
  let stateSignature = '';
  let busySince = 0;
  let lastStatus = '';
  let lastGoodAt = 0;
  let lastMessageSignature = '';
  let lastEvidenceSignature = '';
  let lastServerError = '';
  let copyTimer;

  function announce(text) { $('announcement').textContent = text; }
  function showError(error, title = 'Unable to complete request') {
    $('error-title').textContent = title;
    $('error-message').textContent = error instanceof Error ? error.message : String(error);
    $('error-banner').hidden = false;
  }
  function hideError() { $('error-banner').hidden = true; }
  function currentProposal() { return selectedId ? state?.proposals.find((p) => p.id === selectedId) ?? state?.proposal : state?.proposal; }
  function isHistorical(p) { return Boolean(p && state?.thread && p.version !== state.thread.version); }
  function running() { return state?.busy === true || state?.thread?.runStatus === 'running' || state?.proposal?.status === 'sending' || state?.proposal?.status === 'draft'; }
  function blockedByEarlierDelivery(p) { return state?.proposals.some((other) => other.id !== p?.id && ['sending', 'uncertain'].includes(other.status)); }

  async function request(path, body) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), body === undefined ? 15000 : 320000);
    try {
      const response = await fetch(`/api/dealguard/${path}`, {
        method: body === undefined ? 'GET' : 'POST',
        headers: { Accept: 'application/json', ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        credentials: 'same-origin', cache: 'no-store', signal: controller.signal,
      });
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) throw new Error(`The server returned an unexpected response (HTTP ${response.status}). Check that the DealGuard API is running.`);
      let data;
      try { data = await response.json(); } catch { throw new Error('The server returned unreadable JSON. Refresh to retrieve the current state.'); }
      if (!response.ok || typeof data?.error === 'string' && !data?.capabilities) throw new Error(typeof data?.error === 'string' ? data.error : `Request failed (HTTP ${response.status}).`);
      if (!data || !['live', 'replay'].includes(data.mode) || !data.capabilities || !Array.isArray(data.proposals) || !Array.isArray(data.evidence) || !Array.isArray(data.audit)) throw new Error('The server response is missing required DealGuard state. Please refresh after the API is ready.');
      return { ...data, patterns: data.patterns || {}, thread: data.thread || null, proposal: data.proposal || null };
    } catch (error) {
      if (error.name === 'AbortError') throw new Error(body === undefined ? 'The state request timed out. The workspace will reconnect automatically.' : 'The request timed out. It may still finish on the server; check the latest state before taking another action.');
      if (error instanceof TypeError) throw new Error('Cannot reach the DealGuard server. Check the local server connection; the workspace will reconnect automatically.');
      throw error;
    } finally { clearTimeout(timer); }
  }

  function acceptState(next) {
    const wasDisconnected = !connected;
    state = next;
    connected = true;
    lastGoodAt = Date.now();
    if (selectedId && !state.proposals.some((p) => p.id === selectedId)) selectedId = null;
    const signature = JSON.stringify(next);
    if (signature !== stateSignature) {
      stateSignature = signature;
      render();
    } else { renderControls(); }
    $('sync-status').textContent = 'Up to date';
    $('sync-status').classList.remove('offline');
    $('sync-status').title = `Last state received at ${time(new Date(lastGoodAt).toISOString())}`;
    if (wasDisconnected && ['Workspace unavailable', 'Connection lost · showing last known state', 'Connection lost'].includes($('error-title').textContent)) hideError();
    const serverError = next.error && next.thread?.runStatus === 'failed' ? `${next.thread.key}:${next.thread.version}:${next.error}` : '';
    if (serverError && serverError !== lastServerError) showError(next.error, 'Review failed');
    lastServerError = serverError;
  }

  function schedulePoll() {
    clearTimeout(pollTimer);
    if (document.hidden) return;
    pollTimer = setTimeout(() => refresh(false), busy || running() ? 1500 : connected ? 5000 : 4000);
  }

  async function refresh(manual = false) {
    if (polling) return;
    polling = true;
    const requestEpoch = epoch;
    if (manual) { hideError(); $('sync-status').textContent = 'Refreshing…'; }
    try {
      const next = await request('state');
      if (requestEpoch === epoch) acceptState(next);
    } catch (error) {
      if (requestEpoch === epoch) {
        connected = false;
        $('sync-status').textContent = state ? 'State may be stale' : 'Disconnected';
        $('sync-status').classList.add('offline');
        if (manual || !state || !$('error-banner').hidden) showError(error, state ? 'Connection lost · showing last known state' : 'Workspace unavailable');
        else showError(error, 'Connection lost · showing last known state');
        renderControls();
      }
    } finally { polling = false; schedulePoll(); }
  }

  async function mutate(action, body) {
    if (busy || !state || !connected) return false;
    if (action === 'message' && running()) return false;
    busy = action;
    busySince = Date.now();
    epoch++;
    hideError();
    renderControls();
    schedulePoll();
    try {
      const next = await request(action, body);
      epoch++;
      if (action === 'message' || action === 'reset') selectedId = null;
      if (action === 'reset') { showAllActivity = false; $('supplier-input').value = ''; }
      acceptState(next);
      if (action === 'message') announce('Supplier review updated. Inspect the recommendation and exact counteroffer.');
      if (action === 'reject') announce('Counteroffer rejected.');
      if (action === 'approve') announce(next.proposal?.status === 'sent' ? next.mode === 'replay' ? 'Replay delivery simulated. No Slack message was sent.' : 'A delivery receipt was received.' : 'Approval response received. Review the current approval and delivery status.');
      if (action === 'reconcile') announce(next.proposal?.status === 'sent' ? 'Delivery receipt found.' : 'Receipt check complete. Review the delivery status.');
      return true;
    } catch (error) {
      showError(error, `${{ message: 'Review could not complete', reset: 'Mode change failed', approve: 'Approval could not complete', reject: 'Rejection could not complete', reconcile: 'Receipt check could not complete' }[action] || 'Request failed'}`);
      // Never repeat a mutation after an ambiguous response. Refresh only.
      connected = false;
      $('sync-status').textContent = 'Checking state…';
      await refresh(false);
      return false;
    } finally { busy = null; renderControls(); schedulePoll(); }
  }

  function render() {
    const p = currentProposal();
    renderHeader(p);
    renderComparison(p);
    renderRecommendation(p);
    renderMessages();
    renderActivity();
    renderEvidence(p);
    renderChanges(p);
    renderControls();
  }

  function renderHeader(p) {
    const live = state.mode === 'live';
    $('mode-replay').setAttribute('aria-pressed', String(!live));
    $('mode-live').setAttribute('aria-pressed', String(live));
    $('mode-dot').classList.toggle('neutral-dot', !live);
    $('mode-description').textContent = live ? 'Live analysis · synthetic business records. Supplier delivery requires authorized Slack transport.' : 'Replay workspace · scripted analysis and simulated delivery. No live AI or Slack messages.';
    $('capabilities').innerHTML = `<span class="capability ${state.capabilities.agents ? 'available' : ''}">${state.capabilities.agents ? 'Agents configured' : 'Agents unavailable'}</span><span class="capability ${state.capabilities.slack ? 'available' : ''}">${state.capabilities.slack ? 'Slack configured' : 'Slack disconnected'}</span>`;
    $('offer-version').textContent = state.thread ? `Offer v${state.thread.version}` : 'No offer yet';
    $('decision-jump').hidden = !p;
    if (p) { const status = statuses[p.status] || ['Review decision', 'neutral']; $('decision-jump').textContent = `${status[0]} ↓`; $('decision-jump').className = `badge ${status[1]}`; }
    $('evidence-count').textContent = state.evidence.length;
    $('proposal-selector-wrap').hidden = state.proposals.length < 2;
    const options = [...state.proposals].sort((a, b) => b.version - a.version);
    $('proposal-selector').innerHTML = options.map((proposal) => `<option value="${escape(proposal.id)}" ${p?.id === proposal.id ? 'selected' : ''}>Offer v${escape(proposal.version)}${proposal.version === state.thread?.version ? ' · current' : ' · history'}</option>`).join('');
  }

  function budgetNote(metrics) {
    if (!metrics || !finite(metrics.budgetVariance)) return ['Budget comparison unavailable', ''];
    return metrics.budgetVariance === 0 ? ['At annual budget', ''] : [`${money(Math.abs(metrics.budgetVariance))} ${metrics.budgetVariance > 0 ? 'over' : 'under'} budget`, metrics.budgetVariance > 0 ? 'over' : 'under'];
  }

  function renderComparison(p) {
    $('comparison-empty').hidden = Boolean(p);
    $('comparison-data').hidden = !p;
    if (!p) {
      const reviewing = state.thread?.runStatus === 'running' || state.busy;
      const failed = state.thread?.runStatus === 'failed';
      $('comparison-empty').querySelector('h3').textContent = reviewing ? 'Building the commercial comparison' : failed ? 'The comparison is not available yet' : 'Start with the supplier’s offer';
      $('comparison-empty').querySelector('p').textContent = reviewing ? 'The supplier message has been received. Costs will appear once the review returns validated commercial terms.' : failed ? 'The review did not complete. Inspect the activity log, then edit and resubmit the supplier message.' : 'Paste the terms below or load the initial example. DealGuard will compare costs and prepare a buyer review.';
      $('comparison-empty').querySelector('a').hidden = Boolean(reviewing);
      return;
    }
    $('incoming-cost').innerHTML = largeMoney(p.incomingMetrics?.annualizedCost);
    $('proposed-cost').innerHTML = largeMoney(p.proposedMetrics?.annualizedCost);
    for (const [side, metrics] of [['incoming', p.incomingMetrics], ['proposed', p.proposedMetrics]]) {
      const [label, className] = budgetNote(metrics);
      $(`${side}-cost-note`).textContent = label;
      $(`${side}-cost-note`).className = `money-caption ${className}`;
    }
    const terms = [
      ['Annual recurring', 'annualRecurring', money], ['One-time setup', 'setupFee', money],
      ['Contract length', 'termMonths', (value) => finite(value) ? `${value} months` : 'Not available'],
      ['Payment terms', 'paymentDays', (value) => finite(value) ? value === 0 ? 'Due immediately' : `Net ${value} days` : 'Not available'],
    ];
    $('terms-body').innerHTML = terms.map(([label, key, format]) => `<tr><td>${label}</td><td>${escape(format(p.incomingTerms?.[key]))}</td><td class="${p.proposedTerms && p.incomingTerms && p.proposedTerms[key] !== p.incomingTerms[key] ? 'changed' : ''}">${escape(format(p.proposedTerms?.[key]))}</td></tr>`).join('') + `<tr class="commitment-row"><td>Total commitment</td><td>${escape(money(p.incomingMetrics?.totalCommitment))}</td><td>${escape(money(p.proposedMetrics?.totalCommitment))}</td></tr>`;
    const incoming = p.incomingMetrics?.annualizedCost, proposed = p.proposedMetrics?.annualizedCost;
    if (finite(incoming) && finite(proposed)) {
      const delta = Math.round((incoming - proposed) * 100) / 100;
      $('comparison-outcome').innerHTML = `${arrow}<div><strong>${delta === 0 ? 'No annualized cost change requested' : `${escape(money(Math.abs(delta)))} ${delta > 0 ? 'lower' : 'higher'} annualized cost requested`}</strong><p>Supplier agreement is unconfirmed. A shorter commitment is not cash savings.</p></div>`;
    } else $('comparison-outcome').innerHTML = p.incomingTerms && p.policy?.blocks?.length ? '<div><strong>No counteroffer while this review is on hold</strong><p>The supplier costs are shown. Resolve the policy hold before proposing new terms.</p></div>' : '<div><strong>A complete comparison is not available</strong><p>Clarify missing terms before a commitment can be reviewed.</p></div>';
  }

  function renderRecommendation(p) {
    $('recommendation-empty').hidden = Boolean(p);
    $('recommendation-data').hidden = !p;
    let status = p ? statuses[p.status] || [p.status, 'neutral', 'Review the current decision'] : ['Waiting', 'neutral', ''];
    if (p?.status === 'sent' && p.mode === 'replay') status = ['Simulated', 'success', 'Replay counteroffer delivered'];
    if (p?.status === 'sent' && !p.receipt) status = ['Receipt missing', 'warning', 'Delivery receipt unavailable'];
    if (!p && state.thread?.runStatus === 'failed') status = ['Review failed', 'danger', ''];
    if (!p && state.thread?.runStatus === 'running') status = ['Processing', 'processing', ''];
    $('proposal-status').textContent = status[0];
    $('proposal-status').className = `badge ${status[1]}`;
    if (status[0] !== lastStatus) { announce(status[0]); lastStatus = status[0]; }
    if (!p) {
      $('recommendation-empty').querySelector('h3').textContent = state.thread?.runStatus === 'failed' ? 'The review could not complete.' : state.thread?.runStatus === 'running' ? 'Reviewing the supplier’s offer…' : 'A clear decision, with context.';
      $('recommendation-empty').querySelector('p').textContent = state.thread?.runStatus === 'failed' ? 'See the activity log for the failure. You can edit and resubmit the supplier message.' : 'Review the recommendation, its evidence, and the exact outgoing terms before you approve.';
      return;
    }
    $('decision-headline').textContent = status[2];
    $('rationale').textContent = p.rationale || 'A complete recommendation is not yet available.';
    $('cited-count').textContent = `(${p.evidenceRefs?.length || 0})`;
    const policy = p.policy || { roles: [], reasons: [], blocks: [] };
    const blocks = policy.blocks || [];
    $('policy-section').innerHTML = blocks.length ? `<div class="policy-hold"><h3>On hold · no outgoing approval</h3><ul>${blocks.map((reason) => `<li>${escape(reason)}</li>`).join('')}</ul></div>` : `<h3>Approval route</h3>${(policy.roles || []).map((role) => `<div class="approval-role"><span>${escape(role)}</span><span class="badge ${p.approvals?.[role] ? 'success' : 'pending'}">${p.approvals?.[role] ? 'Approved' : p.status === 'pending' ? 'Awaiting approval' : 'Not approved'}</span></div>`).join('')}${policy.reasons?.length ? `<ul class="policy-reasons">${policy.reasons.map((reason) => `<li>${escape(reason)}</li>`).join('')}</ul>` : ''}`;
    $('counteroffer-text').textContent = p.text || (p.incomingTerms && blocks.length ? 'No outgoing wording has been proposed. Resolve the policy hold with a revised supplier offer.' : 'No actionable counteroffer is available. The supplier’s terms need clarification.');
    $('counteroffer-note').textContent = blocks.length ? 'Reference only. This wording cannot be approved while the proposal is held.' : isHistorical(p) ? 'Historical wording. Only the current offer can be approved.' : 'Approval uses this exact stored wording. It is not acceptance of the supplier’s offer.';
    $('counteroffer-note').hidden = !p.text;
    $('copy-counteroffer').disabled = !p.text;
    $('copy-counteroffer').textContent = 'Copy text';
    $('proposal-reference').textContent = `Offer v${p.version} · ${isHistorical(p) ? 'Historical proposal' : 'Proposal'} ${p.id} · ${p.mode === 'live' ? 'Live analysis' : 'Replay'}`;
    $('delivery-details').hidden = !p.receipt && !['uncertain', 'sending', 'sent'].includes(p.status);
    $('delivery-details').className = `delivery-details ${p.status === 'uncertain' || p.status === 'sent' && !p.receipt ? 'uncertain' : ''}`;
    if (p.receipt) {
      $('delivery-details').innerHTML = `<h3>${p.mode === 'replay' ? 'Simulated receipt · replay only' : 'Slack delivery receipt'}</h3><p>${p.mode === 'replay' ? 'No live Slack message was sent.' : 'Receipt received for the exact counteroffer.'} Supplier acceptance is still unconfirmed.</p><dl><dt>Channel</dt><dd>${escape(p.receipt.channel)}</dd><dt>Message</dt><dd>${escape(p.receipt.messageTs)}</dd><dt>Received</dt><dd>${escape(fullTime(p.receipt.at))}</dd></dl>`;
    } else {
      const title = p.status === 'uncertain' ? 'No confirmed delivery receipt' : p.status === 'sent' ? 'The server has not supplied a receipt' : 'Waiting for the transport response';
      $('delivery-details').innerHTML = `<h3>${title}</h3><p>${p.status === 'uncertain' ? 'Check for an existing receipt. This will not resend the counteroffer.' : 'Delivery is not confirmed by this view. Refresh state to check for a receipt.'}</p>`;
    }
  }

  function renderControls() {
    const p = currentProposal();
    const occupied = Boolean(busy || running());
    $('mode-replay').disabled = !state || !connected || occupied;
    $('mode-live').disabled = !state || !connected || occupied;
    $('refresh').disabled = Boolean(busy === 'reset');
    $('example-initial').disabled = Boolean(busy);
    $('example-followup').disabled = Boolean(busy);
    $('supplier-input').disabled = Boolean(busy);
    const agentUnavailable = state?.mode === 'live' && !state.capabilities.agents;
    $('composer-hint').textContent = state?.mode === 'replay' ? 'Replay recognizes the two exact examples. Custom or edited terms need live analysis. Nothing is sent to the supplier.' : 'Edit before review. This input does not message the supplier. Up to 4,000 characters.';
    $('message-submit').disabled = !state || !connected || occupied || agentUnavailable || !$('supplier-input').value.trim();
    $('message-submit').firstChild.textContent = busy === 'message' || state?.thread?.runStatus === 'running' ? 'Reviewing…' : agentUnavailable ? 'Live analysis unavailable' : 'Review offer';
    $('processing-banner').hidden = !occupied;
    const action = busy || (state?.proposal?.status === 'sending' ? 'approve' : 'message');
    $('processing-title').textContent = { message: 'Reviewing supplier terms', reset: 'Starting a fresh negotiation', approve: state?.mode === 'replay' ? 'Recording approval and simulating delivery' : 'Recording approval and checking delivery', reject: 'Recording your rejection', reconcile: 'Checking for a delivery receipt' }[action] || 'Updating the workspace';
    $('processing-detail').textContent = action === 'message' ? state?.mode === 'replay' ? 'Running the explicitly labelled replay and checking commercial policy.' : 'Reading the offer, checking policy, and preparing an exact counteroffer.' : 'Waiting for the server’s current state. This view will update automatically.';
    if (!p) return;
    const pending = p.status === 'pending';
    const historical = isHistorical(p);
    const slackUnavailable = p.mode === 'live' && !state.capabilities.slack;
    const policyHeld = Boolean(p.policy?.blocks?.length);
    const earlierUncertain = blockedByEarlierDelivery(p);
    $('approve').hidden = !pending;
    $('reject').hidden = !pending;
    $('reconcile').hidden = p.status !== 'uncertain';
    $('approve').disabled = !connected || occupied || historical || policyHeld || slackUnavailable || earlierUncertain || !p.text;
    $('reject').disabled = !connected || occupied || historical || policyHeld;
    $('reconcile').disabled = !connected || Boolean(busy) || slackUnavailable;
    $('approve').textContent = slackUnavailable ? 'Slack approval unavailable' : p.mode === 'replay' ? 'Approve & simulate delivery' : 'Approve exact counteroffer';
    let note = '';
    if (!connected) note = 'The connection is unavailable. Actions are paused until fresh state is received.';
    else if (historical && p.status !== 'uncertain') note = 'You are inspecting an earlier offer. Select the current offer to review the active decision.';
    else if (pending && slackUnavailable) note = 'Slack is disconnected. Live approval and delivery are unavailable. You can review the analysis or switch to replay for a simulated approval.';
    else if (pending && earlierUncertain) note = 'An earlier counteroffer has unconfirmed delivery. Select that offer and check its receipt before another approval.';
    else if (pending) note = p.mode === 'replay' ? 'This records a replay approval and simulates delivery. It does not send a Slack message.' : 'Approve only after reviewing the exact text. The server enforces approver authorization and required roles before delivery.';
    else if (p.status === 'blocked' || p.status === 'held') note = 'Resolve the policy hold with a new supplier message. No counteroffer is approved for delivery.';
    else if (p.status === 'stale') note = 'A newer supplier message invalidated this proposal. Review the latest offer before approving.';
    else if (p.status === 'rejected') note = 'This counteroffer was rejected. Submit a new supplier message to start another review.';
    else if (p.status === 'uncertain') note = slackUnavailable ? 'Slack is disconnected. Receipt verification is unavailable until transport is configured.' : 'Automatic resend is disabled. Check for a receipt to reconcile this delivery.';
    else if (p.status === 'failed') note = 'The review failed. Inspect activity, then edit or resubmit the supplier message.';
    else if (p.status === 'draft') note = 'The review must complete successfully before any approval is available.';
    else if (p.status === 'sending') note = 'Delivery is in progress. Further approval is disabled.';
    else if (p.status === 'sent') note = 'Terms remain a counterproposal, subject to supplier response and final contract review.';
    $('approval-note').textContent = note;
  }

  function renderMessages() {
    const messages = state.thread?.messages || [];
    const signature = JSON.stringify(messages);
    $('message-count').textContent = `${messages.length} ${messages.length === 1 ? 'message' : 'messages'}`;
    $('conversation-subtitle').textContent = state.mode === 'replay' ? 'Replay messages · delivery is simulated.' : 'Messages submitted to this negotiation. Live analysis uses the configured agent.';
    if (signature === lastMessageSignature) return;
    lastMessageSignature = signature;
    const list = $('messages');
    const nearBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 60;
    list.innerHTML = messages.length ? messages.map((message) => `<article class="message ${message.kind === 'buyer' ? 'buyer' : 'supplier'}"><div class="message-heading"><strong>${message.kind === 'buyer' ? 'DealGuard' : 'Supplier'}</strong><span class="message-label">${message.kind === 'buyer' ? state.mode === 'replay' ? 'Simulated counteroffer' : 'Counteroffer' : 'Incoming terms'}</span><time datetime="${escape(message.at)}" title="${escape(fullTime(message.at))}">${escape(time(message.at))}</time></div><p>${escape(message.text)}</p></article>`).join('') : '<p class="empty-text">No messages received. Your first offer starts the negotiation.</p>';
    if (nearBottom) list.scrollTop = list.scrollHeight;
  }

  function renderChanges(p) {
    const previous = [...state.proposals].filter((other) => other.version < p?.version && other.proposedTerms).sort((a, b) => b.version - a.version)[0];
    const oldTerm = previous?.proposedTerms?.termMonths, newTerm = p?.incomingTerms?.termMonths;
    const changed = finite(oldTerm) && finite(newTerm) && oldTerm !== newTerm;
    $('change-alert').hidden = !changed;
    if (!changed) return;
    const held = p.policy?.blocks?.length;
    $('change-alert').innerHTML = `<div><strong>The follow-up changes the commitment</strong><p>${previous.status === 'sent' ? 'The previous counteroffer requested' : 'The previous proposal specified'} ${escape(oldTerm)} months; the supplier now requests ${escape(newTerm)}.${held ? ' The current offer is on hold.' : ' Review the revised terms before approving.'}</p></div><div class="term-change">${escape(oldTerm)} → ${escape(newTerm)}<small>months</small></div>`;
  }

  function renderActivity() {
    const events = [...state.audit].reverse();
    const expanded = new Set([...$('activity-list').querySelectorAll('details[open]')].map((item) => item.dataset.event));
    const summaries = {
      supplier_message: 'Supplier terms received. Earlier unexecuted proposals require a fresh review.',
      proposal_staged: 'A draft decision is recorded; approval awaits successful review.',
      approval_requested: 'The counteroffer is ready for the required buyer approval.',
      policy_block: 'The current terms are on hold. Review the cited policy before continuing.',
      approval_recorded: 'An approval was recorded against the exact stored counteroffer.',
      proposal_rejected: 'The counteroffer was rejected. No supplier message was sent.',
      send_started: state.mode === 'replay' ? 'The approved counteroffer entered simulated delivery.' : 'The approved counteroffer entered delivery; a receipt is still required.',
      counteroffer_sent: state.mode === 'replay' ? 'A simulated receipt was recorded. No live Slack message was sent.' : 'A delivery receipt was recorded. Supplier acceptance remains unconfirmed.',
      delivery_uncertain: 'No delivery receipt is confirmed. Check the receipt before any further action.',
      reconciliation_pending: 'No receipt was found. The counteroffer has not been resent.',
      agent_failed: 'The review could not complete. No approval is available for this decision.',
    };
    $('activity-toggle').hidden = events.length <= 5;
    $('activity-toggle').textContent = showAllActivity ? 'Show recent' : `Show all (${events.length})`;
    $('activity-toggle').setAttribute('aria-expanded', String(showAllActivity));
    $('activity-list').innerHTML = events.length ? (showAllActivity ? events : events.slice(0, 5)).map((event) => {
      const stepFailed = event.type === 'tool_result' && /: failed\b/.test(event.detail);
      const title = stepFailed ? 'Review step failed' : event.type === 'counteroffer_sent' && state.mode === 'replay' ? 'Replay delivery simulated' : activityLabels[event.type] || String(event.type).replaceAll('_', ' ');
      const tone = stepFailed || /fail/.test(event.type) ? 'danger' : /block|uncertain|reconciliation/.test(event.type) ? 'warning' : '';
      const summary = event.type === 'tool_result' ? stepFailed ? 'A review step failed. Open its details to inspect the result.' : 'A review step returned its result.' : summaries[event.type] || event.detail;
      const key = `${event.at}:${event.type}:${event.detail}`;
      const details = summary !== event.detail ? `<details class="activity-details" data-event="${escape(key)}"${expanded.has(key) ? ' open' : ''}><summary>View event details</summary><p>${escape(event.detail)}</p></details>` : '';
      return `<li class="activity-item"><span class="activity-dot ${tone}" aria-hidden="true"></span><div><h3>${escape(title)}</h3><p>${escape(summary)}</p>${details}</div><time datetime="${escape(event.at)}" title="${escape(fullTime(event.at))}">${escape(time(event.at))}</time></li>`;
    }).join('') : '<li class="empty-text">Activity will appear when a supplier message is received.</li>';
  }

  function renderEvidence(p) {
    const signature = JSON.stringify([state.evidence, state.patterns, p?.evidenceRefs, p?.status, p?.version, p?.policy?.blocks, p?.incomingTerms]);
    if (signature === lastEvidenceSignature) return;
    lastEvidenceSignature = signature;
    const patterns = state.patterns;
    $('patterns-disclosure').hidden = !finite(patterns.sampleCount);
    $('patterns').innerHTML = finite(patterns.sampleCount) ? `<div class="pattern-summary"><h3>${escape(patterns.sampleCount)} synthetic historical negotiations</h3><div class="pattern-grid"><div><strong>${finite(patterns.averageHeadlineConcessionPct) ? `${number.format(patterns.averageHeadlineConcessionPct)}%` : '—'}</strong><span>Average annual price concession</span></div><div><strong>${finite(patterns.averageSetupConcessionPct) ? `${number.format(patterns.averageSetupConcessionPct)}%` : '—'}</strong><span>Average setup fee concession</span></div><div><strong>${finite(patterns.paymentExtensions) ? `${patterns.paymentExtensions}/${patterns.sampleCount}` : '—'}</strong><span>Negotiations with longer payment terms</span></div></div><p>${escape(patterns.limitation || 'Descriptive synthetic history; not a forecast of supplier acceptance.')}</p></div>` : '';
    const refs = new Set(p?.evidenceRefs || []);
    $('evidence-selection-note').textContent = p ? `${refs.size} cited in this decision` : 'Available review context';
    const blocks = p?.policy?.blocks || [];
    const held = blocks.length > 0 || ['blocked', 'held'].includes(p?.status);
    // Decision-specific policy and budget precede descriptive history.
    const rank = (record) => held && record.id === 'POLICY-001' ? -1 : refs.has(record.id) ? record.id === 'POLICY-001' ? 0 : record.id === 'BUDGET-001' ? 1 : record.id.startsWith('HIST-') ? 2 : 3 : 4;
    const records = [...state.evidence].sort((a, b) => rank(a) - rank(b));
    const historyLabels = { year: 'Year', initialAnnual: 'Initial annual price', finalAnnual: 'Final annual price', initialFee: 'Initial setup fee', finalFee: 'Final setup fee', initialDays: 'Initial payment terms', finalDays: 'Final payment terms' };
    $('evidence-list').innerHTML = records.length ? records.map((record) => {
      let content = `<p>${escape(record.description)}</p>`;
      try {
        const data = JSON.parse(record.description);
        if (data && typeof data === 'object' && finite(data.initialAnnual)) content = `<dl class="evidence-record">${Object.entries(historyLabels).filter(([key]) => data[key] !== undefined).map(([key, label]) => `<dt>${label}</dt><dd>${escape(key === 'year' ? data[key] : key.endsWith('Days') ? `Net ${data[key]} days` : money(data[key]))}</dd>`).join('')}</dl>`;
      } catch { /* Prose evidence remains plain text. */ }
      const isBlockingPolicy = held && record.id === 'POLICY-001';
      const currentTerm = p?.incomingTerms?.termMonths;
      const specificBlocks = blocks.filter((reason) => !reason.startsWith('No actionable counteroffer'));
      const conditions = specificBlocks.length ? specificBlocks : blocks;
      const condition = isBlockingPolicy ? `<div class="evidence-condition"><strong>${finite(currentTerm) && blocks.some((reason) => reason.includes('POL-MAX')) ? `Current hold · supplier requests ${escape(currentTerm)} months` : `Current blocking condition · offer v${escape(p.version)}`}</strong><ul>${(conditions.length ? conditions : ['The server has placed this proposal on hold. Review the current recommendation.']).map((reason) => `<li>${escape(reason)}</li>`).join('')}</ul></div>` : '';
      const badge = refs.has(record.id) ? '<span class="badge success">Cited</span>' : isBlockingPolicy ? '<span class="badge warning">Applicable policy</span>' : '';
      return `<article class="evidence-item"><span class="source-id">${escape(record.id)}</span>${badge}<h4>${escape(record.label || record.title || record.id)}</h4>${condition}${content}</article>`;
    }).join('') : '<p class="empty-text">No source records are available yet. Refresh once the server is connected.</p>';
  }

  function openDialog(id) {
    const dialog = $(id);
    if (!dialog.open) {
      dialog.showModal();
      if (id === 'evidence-drawer') dialog.querySelector('.drawer-body').scrollTop = 0;
    }
  }
  $('evidence-open').addEventListener('click', () => openDialog('evidence-drawer'));
  $('rationale-evidence').addEventListener('click', () => openDialog('evidence-drawer'));
  $('cost-method-open').addEventListener('click', () => openDialog('method-dialog'));
  $('help-open').addEventListener('click', () => openDialog('help-dialog'));
  document.querySelectorAll('[data-close]').forEach((button) => button.addEventListener('click', () => $(button.dataset.close).close()));
  document.querySelectorAll('dialog').forEach((dialog) => dialog.addEventListener('click', (event) => {
    const rect = dialog.getBoundingClientRect();
    if (event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) dialog.close();
  }));
  $('error-dismiss').addEventListener('click', hideError);
  $('refresh').addEventListener('click', () => refresh(true));
  $('supplier-input').addEventListener('input', renderControls);
  for (const [id, key] of [['example-initial', 'initial'], ['example-followup', 'followup']]) {
    $(id).addEventListener('click', () => {
      $('supplier-input').value = state?.examples?.[key === 'initial' ? 'firstMessage' : 'secondMessage'] || examples[key];
      $('supplier-input').focus();
      renderControls();
      announce('Example loaded. Edit the message, then select Review offer.');
    });
  }
  $('message-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const input = $('supplier-input'), text = input.value.trim();
    if (!text || $('message-submit').disabled) return;
    const succeeded = await mutate('message', { text });
    if (succeeded && input.value.trim() === text) input.value = '';
    renderControls();
    if (succeeded) $('recommendation-title').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });
  $('supplier-input').addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter' && !$('message-submit').disabled) { event.preventDefault(); $('message-form').requestSubmit(); }
  });
  $('proposal-selector').addEventListener('change', (event) => {
    selectedId = event.target.value === state.proposal?.id ? null : event.target.value;
    render();
  });
  for (const action of ['approve', 'reject', 'reconcile']) {
    $(action).addEventListener('click', async () => {
      if ($(action).disabled) return;
      const proposal = currentProposal();
      if (!proposal) return;
      await mutate(action, { id: proposal.id });
    });
  }
  $('activity-toggle').addEventListener('click', () => { showAllActivity = !showAllActivity; renderActivity(); });
  $('copy-counteroffer').addEventListener('click', async () => {
    const text = currentProposal()?.text;
    if (!text) return;
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard access is unavailable. Select the counteroffer text and copy it manually.');
      await navigator.clipboard.writeText(text);
      $('copy-counteroffer').textContent = 'Copied';
      announce('Exact counteroffer copied.');
      clearTimeout(copyTimer);
      copyTimer = setTimeout(() => { $('copy-counteroffer').textContent = 'Copy text'; }, 2200);
    } catch { showError('Clipboard access is unavailable. Select the counteroffer text and copy it manually.', 'Could not copy automatically'); }
  });
  for (const mode of ['live', 'replay']) {
    $(`mode-${mode}`).addEventListener('click', async () => {
      if (!state || state.mode === mode || busy) return;
      requestedMode = mode;
      $('reset-description').textContent = mode === 'live' ? 'Switch to live analysis using the configured agent. Business records remain synthetic; live approval requires authorized Slack transport.' : 'Switch to replay with scripted analysis and simulated delivery. No live AI or Slack messages will be used.';
      $('reset-confirm').textContent = `Start ${mode} review`;
      openDialog('reset-dialog');
    });
  }
  $('reset-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!requestedMode || busy) return;
    const mode = requestedMode;
    $('reset-dialog').close();
    requestedMode = null;
    await mutate('reset', { mode });
  });
  document.querySelectorAll('.rail-links .rail-link').forEach((link) => link.addEventListener('click', () => {
    document.querySelectorAll('.rail-links .rail-link').forEach((item) => item.classList.toggle('active', item === link));
  }));
  document.addEventListener('visibilitychange', () => { if (document.hidden) clearTimeout(pollTimer); else refresh(false); });
  window.addEventListener('online', () => refresh(false));
  window.addEventListener('offline', () => { connected = false; $('sync-status').textContent = 'Disconnected'; $('sync-status').classList.add('offline'); showError('The browser is offline. Showing the last known state; actions are paused.', 'Connection lost'); renderControls(); });
  window.addEventListener('pageshow', (event) => { if (event.persisted) refresh(false); });
  setInterval(() => {
    $('processing-time').textContent = busy ? `${Math.floor((Date.now() - busySince) / 1000)}s` : '';
    if (lastGoodAt && Date.now() - lastGoodAt > 25000 && connected) { connected = false; $('sync-status').textContent = 'State may be stale'; $('sync-status').classList.add('offline'); renderControls(); }
  }, 1000);
  refresh(false);
})();
