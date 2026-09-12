'use strict';

(() => {
  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const icon = (name) => `<svg class="icon" aria-hidden="true"><use href="#i-${name}"/></svg>`;
  const coachNames = { health: 'Mira', career: 'Atlas' };
  const kinds = { work: 'Work', health: 'Health', career: 'Career', personal: 'Personal' };
  let state = null;
  let selectedCoach = 'health';
  let planView = 'current';
  let busy = false;
  let connected = false;
  let stateEpoch = 0;
  let lastProposalId = null;
  let lastHistorySignature = '';
  let draftRevision = 0;
  let pendingMode = null;
  let pollTimer;
  let recorder = null;
  let recordStream = null;
  let recordingTimer;
  let recordingSince = 0;
  let transcribing = false;
  let transcriptionGeneration=0;
  let transcriptionController=null;
  let acquiringMic = false;
  let recordCancelled = false;
  let audio = null;
  let audioUrl = null;
  let speechController = null;
  let playbackRevision = 0;
  let areaInitialized = false;
  let lastError = '';
  let refreshing = false;

  const safeUrl = (value) => {
    try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) ? url.href : null; } catch { return null; }
  };
  const minutes = (time) => { const match = /^(\d{2}):(\d{2})$/.exec(String(time)); return match ? Number(match[1]) * 60 + Number(match[2]) : NaN; };
  const duration = (start, end) => Math.max(0, minutes(end) - minutes(start)) || 0;
  const readableDuration = (total) => total < 60 ? `${total} min` : `${Math.floor(total / 60)}h${total % 60 ? ` ${total % 60}m` : ''}`;
  const dateLabel = (day) => {
    const date = new Date(`${day}T12:00:00+04:00`);
    return Number.isNaN(date.getTime()) ? 'Your daily planner · Dubai' : new Intl.DateTimeFormat('en', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'Asia/Dubai' }).format(date);
  };
  const setRegion = (selector, html) => { const element = $(selector); if (element.dataset.rendered !== html) { element.innerHTML = html; element.dataset.rendered = html; } };
  const isTurning = () => busy || state?.busy === true || state?.status === 'thinking';
  const isRecording = () => recorder?.state === 'recording';
  const canMessage = () => connected && state && !state.recovery?.unresolved && !isTurning() && !transcribing && !acquiringMic && !isRecording() && (state.mode === 'replay' || state.capabilities?.agents);

  function notify(message, type = '') {
    $('#notice-text').textContent = message;
    $('#notice').className = `notice ${type}`;
    $('#notice').hidden = false;
    $('#retry-button').hidden = connected && !state?.recovery?.canRetry;
    $('#retry-button').textContent = connected && state?.recovery?.canRetry ? 'Resume review' : 'Retry connection';
  }

  async function request(path, { method = 'GET', body, raw = false, headers = {}, timeout = 150000, signal } = {}) {
    const controller = new AbortController();
    const abort = () => controller.abort();
    if (signal?.aborted) controller.abort();
    signal?.addEventListener('abort', abort, { once: true });
    const timer = setTimeout(abort, timeout);
    try {
      const response = await fetch(path, { method, cache: 'no-store', headers: { ...(body && !raw ? { 'Content-Type': 'application/json' } : {}), ...headers }, body: body == null ? undefined : raw ? body : JSON.stringify(body), signal: controller.signal });
      if (!response.ok) {
        let error = `The service returned HTTP ${response.status}. Please try again.`;
        try { const result = await response.json(); if (typeof result.error === 'string') error = result.error; } catch { /* A non-JSON failure must not masquerade as a successful response. */ }
        throw new Error(error);
      }
      if (raw && path.endsWith('/speak')) {
        if (!response.headers.get('Content-Type')?.includes('audio/')) throw new Error('The voice service did not return playable audio. Your reply is still available as text.');
        return await response.blob();
      }
      if (path.endsWith('.ics')) return await response.blob();
      try { return await response.json(); } catch { throw new Error('The service returned an unreadable response. Please try again.'); }
    } catch (error) {
      if (error.name === 'AbortError') throw new Error(signal?.aborted ? 'Cancelled.' : 'The request timed out. Your workspace will keep checking for a result.');
      if (error instanceof TypeError) throw new Error('Could not reach the service. Check your connection and try again.');
      throw error;
    } finally { clearTimeout(timer); signal?.removeEventListener('abort', abort); }
  }

  function acceptState(next) {
    if (!next || !['live', 'replay'].includes(next.mode) || !Array.isArray(next.events) || !Array.isArray(next.history)) throw new Error('The planner returned incomplete data. Please refresh the connection.');
    state = next;
    window.dispatchEvent(new CustomEvent('mentoros:day', {detail:structuredClone(state)}));
    connected = true;
    for (const coach of next.coaches || []) {
      if (!Object.hasOwn(coachNames, coach.id)) continue;
      const card = $(`[data-coach="${coach.id}"]`);
      if (typeof coach.name === 'string' && coach.name.trim()) coachNames[coach.id] = coach.name;
      card.querySelector('h3').textContent = coachNames[coach.id];
      card.querySelector('.portrait-fallback').textContent = coachNames[coach.id].slice(0, 1);
      card.setAttribute('aria-label', `Choose ${coachNames[coach.id]}, ${coach.id} coach, for spoken replies`);
      card.querySelector('img').alt = `${coachNames[coach.id]}, your AI ${coach.id} coach`;
      const portrait = card.querySelector('img');
      if (typeof coach.portrait === 'string' && /^\/assets\/[a-zA-Z0-9_./-]+$/.test(coach.portrait) && !coach.portrait.includes('..') && portrait.dataset.sourcePath !== coach.portrait) {
        portrait.dataset.sourcePath = coach.portrait;
        portrait.src = coach.portrait;
      }
    }
    $('#conversation-subtitle').textContent = `${coachNames[selectedCoach]}’s voice · one shared conversation`;
    if (next.proposal?.id !== lastProposalId) {
      planView = next.proposal?.status === 'pending' ? 'proposed' : 'current';
      lastProposalId = next.proposal?.id ?? null;
    }
    if (!next.proposal || next.proposal.status !== 'pending') planView = 'current';
    if (!areaInitialized && document.activeElement !== $('#area-input') && !$('#area-input').value) {
      $('#area-input').value = next.area || '';
      areaInitialized = true;
    }
    render();
    if (next.error && next.error !== lastError) notify(next.error, 'error');
    lastError = next.error || '';
  }

  function render() {
    if (!state) return;
    const proposal = state.proposal;
    const hasPending = proposal?.status === 'pending';
    const status = isTurning() ? 'thinking' : state.status;
    const labels = { idle: 'Ready when you are', thinking: 'Coaches are reviewing', pending: 'Your approval needed', approved: 'Plan approved', failed: 'Review interrupted' };
    $('#day-label').textContent = dateLabel(state.day);
    $('#mode').value = state.mode;
    $('#mode-description').textContent = state.mode === 'replay' ? 'Scripted coaching on a synthetic day. Voice uses live services when available.' : 'Live AI coaching on a synthetic day. Your calendar is never changed automatically.';
    $('#metric-events').innerHTML = `${state.events.length}<small> commitments</small>`;
    const selfTime = state.events.filter((event) => ['health', 'personal'].includes(event.kind)).reduce((sum, event) => sum + duration(event.start, event.end), 0);
    $('#metric-personal').innerHTML = `${Number((selfTime / 60).toFixed(1))}<small> hours</small>`;
    $('#metric-next').textContent = isTurning() ? 'Finding a little room…' : hasPending ? `Review ${proposal.changes.length} suggested ${proposal.changes.length === 1 ? 'change' : 'changes'}` : state.status === 'approved' ? 'Make the plan your own' : 'Tell us what you need';
    $('#plan-status').className = `status-chip ${status}`;
    $('#plan-status').textContent = labels[status] || 'Your daily plan';
    $('#planner-subtitle').textContent = hasPending ? 'Nothing moves until you say it does.' : state.status === 'approved' ? 'Your approved plan, ready for the day.' : 'Your commitments, with room to breathe.';
    $('#view-current').classList.toggle('selected', planView === 'current');
    $('#view-current').setAttribute('aria-pressed', String(planView === 'current'));
    $('#view-proposed').classList.toggle('selected', planView === 'proposed');
    $('#view-proposed').setAttribute('aria-pressed', String(planView === 'proposed'));
    $('#view-proposed').disabled = !hasPending;
    $('#change-count').hidden = !hasPending;
    $('#change-count').textContent = String(proposal?.changes?.length || 0);
    $('#turn-indicator').hidden = !isTurning();
    $('#source-count').textContent = String(proposal?.sources?.length || 0);
    renderTimeline();
    renderProposal();
    renderMessages();
    renderMemory();
    renderSources();
    renderControls();
  }

  function renderTimeline() {
    $('#timeline').setAttribute('aria-busy', 'false');
    const proposal = state.proposal;
    const preview = planView === 'proposed' && proposal?.status === 'pending';
    const changes = preview ? proposal.changes || [] : [];
    const events = state.events.map((event) => {
      const change = changes.find((item) => item.eventId === event.id);
      return { ...event, change, start: change?.toStart || event.start, end: change?.toEnd || event.end, title: change?.title || event.title };
    }).sort((a, b) => minutes(a.start) - minutes(b.start));
    if (!events.length) {
      setRegion('#timeline', `<div class="timeline-empty">${icon('clock')}<p>Your day has room to grow.</p><small>Tell your coaches what you’d like to make time for.</small></div>`);
      return;
    }
    let html = '';
    events.forEach((event, index) => {
      const kind = Object.hasOwn(kinds, event.kind) ? event.kind : 'work';
      const prevEnd = index ? Math.max(...events.slice(0, index).map((item) => minutes(item.end))) : null;
      const gap = prevEnd === null ? 0 : minutes(event.start) - prevEnd;
      if (gap >= 15) html += `<div class="timeline-gap">${esc(readableDuration(gap))} of breathing room</div>`;
      html += `<div class="timeline-row${event.change ? ' changed' : ''}"><div class="timeline-time">${esc(event.start)}<span>${esc(event.end)}</span></div><div class="event-block ${kind}"><div class="event-title-row"><span class="event-title">${esc(event.title)}</span>${event.fixed ? `<span title="Fixed commitment" aria-label="Fixed commitment">${icon('lock')}</span>` : ''}</div><div class="event-meta"><span>${kinds[kind]}</span><span class="event-dot"></span><span>${esc(readableDuration(duration(event.start, event.end)))}</span>${event.fixed ? '<span class="event-dot"></span><span>Fixed</span>' : ''}</div>${event.change ? `<div class="event-change"><del>${esc(event.change.fromStart)}–${esc(event.change.fromEnd)}</del>${icon('arrow')}<b>${esc(event.change.toStart)}–${esc(event.change.toEnd)}</b><span class="event-reason">${esc(event.change.reason)}</span></div>` : ''}</div></div>`;
    });
    html += '<div class="timeline-legend"><span><i></i>Work</span><span><i class="health-key"></i>Health</span><span><i class="career-key"></i>Career</span></div>';
    setRegion('#timeline', html);
  }

  function renderProposal() {
    const proposal = state.proposal;
    if (!proposal) { setRegion('#proposal', ''); return; }
    const pending = proposal.status === 'pending';
    const labels = { pending: 'Your approval needed', approved: 'Approved by you', rejected: 'Suggestion declined', stale: 'An updated plan is needed' };
    const changes = proposal.changes || [];
    const total = changes.reduce((sum, change) => sum + duration(change.toStart, change.toEnd), 0);
    const summary = changes.length ? `${changes.length} ${changes.length === 1 ? 'change' : 'changes'} · ${readableDuration(total)} across these activities.` : 'No schedule changes are included in this suggestion.';
    const rows = changes.map((change) => {
      const previous = state.events.find((event) => event.id === change.eventId);
      const renamed = pending && previous && previous.title !== change.title;
      return `<tr><th scope="row">${esc(change.title)}<small>${esc(readableDuration(duration(change.toStart, change.toEnd)))}${renamed ? ` · Was: ${esc(previous.title)}` : ''}</small></th><td>${esc(change.fromStart)}–${esc(change.fromEnd)}</td><td>${esc(change.toStart)}–${esc(change.toEnd)}</td></tr>`;
    }).join('');
    const table = changes.length ? `<table class="decision-table"><caption class="sr-only">Exact proposed changes in Dubai time</caption><thead><tr><th scope="col">Activity</th><th scope="col">Before</th><th scope="col">After</th></tr></thead><tbody>${rows}</tbody></table>` : '';
    const fullNotes = `<p>${esc(proposal.summary)}</p>${proposal.healthNote ? `<p>${esc(proposal.healthNote)}</p>` : ''}${proposal.careerNote ? `<p>${esc(proposal.careerNote)}</p>` : ''}${changes.length ? `<ul>${changes.map((change) => `<li><strong>${esc(change.title)}:</strong> ${esc(change.reason)}</li>`).join('')}</ul>` : ''}`;
    const actions = pending ? `<div class="proposal-actions"><button class="button button-primary" data-action="approve" data-id="${esc(proposal.id)}"${isTurning() || !connected ? ' disabled' : ''}>${icon('check')}Approve ${changes.length ? 'these changes' : 'this plan'}</button><button class="button button-secondary" data-action="reject" data-id="${esc(proposal.id)}"${isTurning() || !connected ? ' disabled' : ''}>Reject</button></div><p class="proposal-message">Saves this plan here. Export to your calendar when ready.</p>` : `<p class="proposal-message">${proposal.status === 'approved' ? 'Saved here. Your live calendar has not been changed.' : proposal.status === 'stale' ? 'Ask your coaches for an updated plan before approving.' : 'Your current plan is unchanged.'}</p>`;
    const sources = `<div class="proposal-sources"><button class="text-button" data-action="sources">${icon('external')}${proposal.sources?.length ? `${proposal.sources.length} research source${proposal.sources.length === 1 ? '' : 's'}` : 'Research & sources'}</button>${proposal.speech ? `<button class="text-button" data-action="speak-proposal"${!state.capabilities?.voice ? ' disabled' : ''}>${icon('volume')}Listen · AI voice</button>` : ''}</div>`;
    setRegion('#proposal', `<div class="proposal-card decision-card"><div class="decision-heading"><div><h2>${pending ? 'Review your plan' : proposal.status === 'approved' ? 'Your approved plan' : 'Your plan review'}</h2><p class="decision-summary">${esc(summary)}</p></div><span class="status-chip ${esc(proposal.status)}">${esc(labels[proposal.status] || 'Coaching suggestion')}</span></div>${table}<div class="decision-bottom"><div>${actions}</div><div>${sources}<details class="plan-details"><summary>Why this plan</summary><div class="proposal-notes">${fullNotes}</div></details></div></div></div>`);
  }

  function renderMessages() {
    const signature = JSON.stringify([state.history, coachNames, state.mode]);
    if (signature === lastHistorySignature) return;
    lastHistorySignature = signature;
    if (!state.history.length) {
      setRegion('#messages', `<div class="conversation-empty"><span class="empty-mark">${icon('spark')}</span><h3>Start with what’s on your mind.</h3><p>A packed afternoon? A goal you keep putting off?<br>Your coaches will help you make a little room.</p></div>`);
      return;
    }
    const container = $('#messages');
    const nearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 70;
    const html = state.history.map((message, index) => {
      const assistant = message.role === 'assistant';
      const name = assistant ? (coachNames[message.coach] || 'Your coaches') : 'You';
      let time = '';
      try { time = new Intl.DateTimeFormat('en', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Dubai' }).format(new Date(message.at)); } catch { /* Missing timestamps are omitted. */ }
      return `<article class="message ${assistant ? 'assistant' : 'user'}"><div class="message-meta">${assistant ? icon('spark') : ''}<strong>${esc(name)}</strong><span>${esc(time)}</span></div><p class="message-text">${esc(message.text)}</p>${assistant ? `<div class="message-footer"><span>${state.mode === 'replay' ? 'Scripted rehearsal reply' : 'AI coaching suggestion'}</span><button class="text-button" data-action="speak-message" data-index="${index}"${!state.capabilities?.voice ? ' disabled' : ''}>${icon('volume')}Listen · AI voice</button></div>` : ''}</article>`;
    }).join('');
    setRegion('#messages', html);
    if (nearBottom) container.scrollTop = container.scrollHeight;
  }

  function renderMemory() {
    const memory = Array.isArray(state.memory) ? state.memory : [];
    setRegion('#memory-content', memory.length ? `<ul class="memory-list">${memory.map((item) => `<li>${esc(item)}</li>`).join('')}</ul><p class="memory-note">${state.mode === 'replay' ? 'Rehearsal memory from this demo conversation.' : 'Shared context from this coaching conversation.'}</p>` : '<p class="memory-empty">Your shared goals and preferences will appear here.</p>');
  }

  function cleanExcerpt(source) {
    // Mechanical excerpt selection only: never infer or write source claims.
    let text = String(source.snippet || '').replace(/\r/g, '');
    const title = String(source.title || '').trim();
    if (title) text = text.split(title).join(' ');
    text = text.replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
      .replace(/#{1,6}\s*/g, ' ')
      .replace(/Availability\s+Read the HTML Edition Online\s+Login to Download\s+Details\s+Additional Information\s+Standards Information/gi, ' ')
      .replace(/(?:^|\n)\s*(?:Skip to (?:main )?content|Cookie settings|Accept all cookies|All rights reserved|Sign in|Login to Download|Additional Information|Standards Information)\s*(?=\n|$)/gi, ' ')
      .replace(/[*_`]+/g, '').replace(/\s+/g, ' ').trim()
      .replace(/^(?:[A-Z]\d{2,}\s+)+/, '');
    const sentences = text.match(/[^.!?]+[.!?](?=\s|$)/g) || [];
    const seen = new Set();
    return sentences.map(sentence => sentence.trim()).filter(sentence => {
      const key = sentence.toLowerCase();
      if (sentence.split(/\s+/).length < 6 || seen.has(key)) return false;
      if (/^(?:privacy policy|terms of use|cookie policy|subscribe|copyright|sign in|log in)\b/i.test(sentence)) return false;
      seen.add(key);
      return true;
    }).slice(0, 2).join(' ');
  }

  function renderSources() {
    const sources = state?.proposal?.sources || [];
    let intro = !state ? 'Connect to your workspace to see recommendation sources.' : state.mode === 'replay' ? 'You’re in a scripted rehearsal. Any sources shown below come from the API; this is not a live Exa search.' : !state.capabilities?.search ? 'Live Exa search is unavailable in this workspace. No local places or web sources have been invented.' : sources.length ? 'These sources were returned by the research service for this suggestion.' : 'No sources have been returned for this suggestion. Your coaches can look for local options when you include an area.';
    const cards = sources.map((source, index) => {
      const url = safeUrl(source.url);
      const host = url ? new URL(url).hostname.replace(/^www\./, '') : '';
      const excerpt = cleanExcerpt(source);
      return `<article class="source-card"><span class="source-number">SOURCE ${String(index + 1).padStart(2, '0')}</span><h3>${esc(source.title)}</h3>${excerpt ? `<p class="source-excerpt">${esc(excerpt)}</p>` : '<p>No complete excerpt was returned. Open the source for context.</p>'}${source.address ? `<p class="source-address">${icon('pin')} ${esc(source.address)}</p>` : ''}${url ? `<a class="source-link" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(host)}${icon('external')}<span class="sr-only"> (opens in new tab)</span></a>` : '<p>No valid source link was supplied.</p>'}${source.snippet ? `<details class="source-original"><summary>Original retrieved excerpt</summary><p>${esc(source.snippet)}</p></details>` : ''}</article>`;
    }).join('');
    setRegion('#sources-content', `<p class="sources-state">${esc(intro)}</p>${cards}${!sources.length ? `<div class="timeline-empty">${icon('book')}<p>No research sources yet.</p><small>Only returned sources will appear here.</small></div>` : ''}`);
  }

  function renderControls() {
    const turn = isTurning();
    const recording = isRecording();
    const mediaBusy = recording || transcribing || acquiringMic;
    const usable = connected && !!state;
    $('#retry-button').hidden = connected && !state?.recovery?.canRetry;
    $('#retry-button').textContent = connected && state?.recovery?.canRetry ? 'Resume review' : 'Retry connection';
    $('#retry-button').disabled = turn || mediaBusy;
    $('#connection-status').textContent = !connected ? 'Service unavailable' : state?.mode === 'replay' ? 'Rehearsal workspace' : state?.capabilities?.agents ? 'Live coaching configured' : 'Live coaching unavailable';
    $('#connection-status').className = `connection-status ${connected ? 'ready' : 'offline'}`;
    $('#reset-button').disabled = !usable || turn || mediaBusy;
    $('#mode').disabled = !usable || turn || mediaBusy;
    $('#message-input').disabled = !usable;
    $('#area-input').disabled = !usable;
    $('#send-button').disabled = !canMessage() || !$('#message-input').value.trim();
    $('#disrupt-button').disabled = !canMessage();
    $('#export-button').disabled = !usable || turn || !(state?.calendar?.canExport ?? state?.proposal?.status === 'approved');
    $('#export-button').innerHTML = `${icon('download')}Export approved calendar`;
    $('#export-button').title = 'Download the last plan you approved. Pending suggestions are excluded.';
    $('#memory-followup').disabled = !canMessage() || !state?.memory?.length;
    $('#record-button').disabled = !recording && (!usable || turn || mediaBusy || !state?.capabilities?.voice || !navigator.mediaDevices?.getUserMedia || !window.MediaRecorder);
    $$('#quick-prompts button').forEach((button) => { button.disabled = !canMessage(); });
    $$('[data-action="approve"], [data-action="reject"]').forEach((button) => { button.disabled = !usable || turn || mediaBusy; });
    $$('[data-action="speak-proposal"], [data-action="speak-message"]').forEach((button) => { button.disabled = !usable || !state?.capabilities?.voice || mediaBusy; });
    if (!mediaBusy && !$('#voice-status').dataset.sticky) {
      $('#voice-status').textContent = !state?.capabilities?.voice ? 'Voice is unavailable in this workspace. You can always type a message.' : !navigator.mediaDevices?.getUserMedia || !window.MediaRecorder ? 'This browser cannot record audio. Type a message to your coaches.' : 'Press the microphone to talk. Press again to stop. Review your words before sending.';
    }
  }

  async function refresh({ initial = false } = {}) {
    if (refreshing) return;
    refreshing = true;
    const epoch = stateEpoch;
    try {
      const next = await request('/api/mentoros/state', { timeout: 12000 });
      if (epoch === stateEpoch) {
        const recovering = !connected;
        acceptState(next);
        if (recovering && !next.error) $('#notice').hidden = true;
      }
    } catch (error) {
      if (epoch !== stateEpoch) return;
      connected = false;
      notify(error.message, 'error');
      if (!state) {
        $('#plan-status').textContent = 'Connection needed';
        $('#plan-status').className = 'status-chip failed';
        $('#timeline').setAttribute('aria-busy', 'false');
        setRegion('#timeline', `<div class="timeline-empty">${icon('clock')}<p>Your planner is not available yet.</p><small>Reconnect to load your actual workspace.</small></div>`);
      }
      renderControls();
    } finally { refreshing = false; }
  }

  function schedulePoll() {
    clearTimeout(pollTimer);
    pollTimer = setTimeout(async () => { if (!document.hidden || isTurning()) await refresh(); schedulePoll(); }, isTurning() ? 1400 : 5500);
  }

  async function mutate(action, payload = {}) {
    if (isTurning()) return null;
    busy = true;
    stateEpoch++;
    stopPlayback();
    $('#notice').hidden = true;
    render();
    schedulePoll();
    try {
      const next = await request(`/api/mentoros/${action}`, { method: 'POST', body: payload });
      stateEpoch++;
      acceptState(next);
      if (next.error) return null;
      if (action === 'approve') notify('Your plan is approved and saved. Export the calendar whenever you’re ready.', 'success');
      if (action === 'reject') notify('Suggestion declined. Your current plan is unchanged.');
      if (action === 'reset') notify(`A fresh ${next.mode === 'replay' ? 'rehearsal' : 'live'} workspace is ready.`, 'success');
      return next;
    } catch (error) {
      notify(error.message, 'error');
      return null;
    } finally {
      busy = false;
      stateEpoch++;
      render();
      schedulePoll();
    }
  }

  async function sendMessage() {
    const text = $('#message-input').value.trim();
    if (!text || !canMessage()) return;
    const revision = draftRevision;
    const result = await mutate('message', { text, ...($('#area-input').value.trim() ? { area: $('#area-input').value.trim() } : {}) });
    if (result && draftRevision === revision) { $('#message-input').value = ''; draftRevision++; }
    renderControls();
  }

  function setPrompt(text) {
    if (!canMessage()) return;
    $('#message-input').value = text;
    draftRevision++;
    $('#message-input').focus();
    $('#conversation').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    renderControls();
  }

  function stopPlayback() {
    playbackRevision++;
    speechController?.abort();
    speechController = null;
    if (audio) { audio.pause(); audio.src = ''; audio = null; }
    if (audioUrl) { URL.revokeObjectURL(audioUrl); audioUrl = null; }
    $('#playback').hidden = true;
    $('#captions').textContent = '';
  }

  async function speak(text) {
    if (!text || !state?.capabilities?.voice || isRecording() || transcribing) return;
    stopPlayback();
    const revision = playbackRevision;
    const controller = new AbortController();
    speechController = controller;
    const coach = selectedCoach;
    $('#playback-label').textContent = `Preparing ${coachNames[coach]}’s AI-generated voice…`;
    $('#captions').textContent = text;
    $('#playback').hidden = false;
    try {
      const blob = await request('/api/voice/speak', { method: 'POST', raw: true, body: JSON.stringify({ text, coach }), headers: { 'Content-Type': 'application/json' }, signal: controller.signal, timeout: 90000 });
      if (revision !== playbackRevision) return;
      audioUrl = URL.createObjectURL(blob);
      audio = new Audio(audioUrl);
      audio.onended = () => { if (revision === playbackRevision) stopPlayback(); };
      audio.onerror = () => { if (revision === playbackRevision) { stopPlayback(); notify('This browser could not play the voice reply. The full reply is still available as text.', 'error'); } };
      $('#playback-label').textContent = `${coachNames[coach]} · AI-generated voice`;
      await audio.play();
    } catch (error) {
      if (revision === playbackRevision) { stopPlayback(); notify(error.name === 'NotAllowedError' ? 'Your browser blocked audio playback. Select Listen again, or read the reply in the conversation.' : error.message, 'error'); }
    }
  }

  function releaseMicrophone() {
    clearInterval(recordingTimer);
    recordStream?.getTracks().forEach((track) => track.stop());
    recordStream = null;
    $('#record-button').classList.remove('recording');
    $('#record-button').setAttribute('aria-pressed', 'false');
    $('#record-button').setAttribute('aria-label', 'Press to start recording a voice message');
    $('#voice-status').classList.remove('recording');
  }

  async function toggleRecording() {
    if (isRecording()) { recorder.stop(); return; }
    if ($('#record-button').disabled || acquiringMic) return;
    acquiringMic = true;
    recordCancelled = false;
    stopPlayback();
    delete $('#voice-status').dataset.sticky;
    $('#voice-status').textContent = 'Waiting for microphone permission…';
    renderControls();
    try {
      recordStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (recordCancelled) { releaseMicrophone(); return; }
      const mime = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg;codecs=opus'].find((type) => MediaRecorder.isTypeSupported(type));
      recorder = mime ? new MediaRecorder(recordStream, { mimeType: mime }) : new MediaRecorder(recordStream);
      const chunks = [];
      const initialDraft = $('#message-input').value;
      const revision = draftRevision;
      recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
      recorder.onerror = () => { recordCancelled = true; if (isRecording()) recorder.stop(); releaseMicrophone(); notify('Recording failed. Your typed message is still available.', 'error'); renderControls(); };
      recorder.onstop = async () => {
        const contentType = recorder.mimeType || chunks[0]?.type || 'audio/webm';
        releaseMicrophone();
        recorder = null;
        if (recordCancelled) { renderControls(); return; }
        const blob = new Blob(chunks, { type: contentType });
        if (!blob.size) { notify('No audio was captured. Please try again, or type your message.', 'error'); renderControls(); return; }
        transcribing = true;
        const generation=++transcriptionGeneration;
        const transcription=new AbortController();transcriptionController=transcription;
        $('#voice-status').textContent = 'Turning your voice into text…';
        renderControls();
        const extension = contentType.includes('mp4') ? 'm4a' : contentType.includes('ogg') ? 'ogg' : 'webm';
        try {
          const result = await request('/api/voice/transcribe', { method: 'POST', body: blob, raw: true, headers: { 'Content-Type': contentType, 'X-Filename': `mentor-message.${extension}` }, timeout: 90000, signal:transcription.signal });
          if(generation!==transcriptionGeneration||transcription.signal.aborted||recordCancelled)return;
          if (typeof result.text !== 'string' || !result.text.trim()) throw new Error('No words were detected. Try speaking a little closer to the microphone.');
          // Draft edits made while transcribing are retained; transcription appends to them.
          const draft = draftRevision === revision ? initialDraft : $('#message-input').value;
          $('#message-input').value = `${draft}${draft.trim() ? '\n' : ''}${result.text.trim()}`;
          draftRevision++;
          $('#voice-status').textContent = 'Transcribed. Review your message, then press send.';
          $('#voice-status').dataset.sticky = 'true';
          $('#message-input').focus();
        } catch (error) { if(generation===transcriptionGeneration&&!transcription.signal.aborted)notify(error.message, 'error'); }
        finally {if(generation===transcriptionGeneration){transcribing=false;transcriptionController=null;renderControls();}}
      };
      recorder.start();
      recordingSince = Date.now();
      $('#record-button').classList.add('recording');
      $('#record-button').setAttribute('aria-pressed', 'true');
      $('#record-button').setAttribute('aria-label', 'Stop recording and transcribe your voice message');
      $('#voice-status').classList.add('recording');
      const updateClock = () => {
        const seconds = Math.floor((Date.now() - recordingSince) / 1000);
        $('#voice-status').textContent = `Recording ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')} · Press the microphone to stop. 60 seconds maximum.`;
        if (seconds >= 60 && isRecording()) recorder.stop();
      };
      updateClock();
      recordingTimer = setInterval(updateClock, 500);
    } catch (error) {
      releaseMicrophone();
      const message = error.name === 'NotAllowedError' ? 'Microphone access was denied. You can type your message, or enable the microphone in your browser.' : error.name === 'NotFoundError' ? 'No microphone was found. You can type your message instead.' : 'The microphone could not start. Please try again or type your message.';
      notify(message, 'error');
    } finally { acquiringMic = false; renderControls(); }
  }

  async function exportCalendar() {
    if ($('#export-button').disabled) return;
    $('#export-button').disabled = true;
    try {
      const blob = await request('/api/mentoros/calendar.ics', { timeout: 15000 });
      const text = await blob.text();
      if (!text.includes('BEGIN:VCALENDAR') || !text.includes('END:VCALENDAR')) throw new Error('The service did not return a valid calendar file. Please try again.');
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `mentoros-${String(state.day || 'approved-plan').replace(/[^a-z0-9-]/gi, '')}.ics`;
      document.body.append(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      notify('Calendar file downloaded. Import it into your calendar when you’re ready.', 'success');
    } catch (error) { notify(error.message, 'error'); }
    finally { renderControls(); }
  }

  function requestReset(mode) {
    pendingMode = mode;
    $('#reset-title').textContent = mode !== state.mode ? `Switch to ${mode === 'live' ? 'live services' : 'rehearsal'}?` : 'Start a fresh day?';
    $('#reset-description').textContent = 'This resets the demo’s conversation, proposals and shared memory. Your live calendar is not affected.';
    $('#confirm-reset').textContent = mode !== state.mode ? 'Switch & reset' : 'Reset day';
    $('#reset-dialog').showModal();
  }

  $('#message-form').addEventListener('submit', (event) => { event.preventDefault(); sendMessage(); });
  $('#message-input').addEventListener('input', () => { draftRevision++; delete $('#voice-status').dataset.sticky; renderControls(); });
  $('#message-input').addEventListener('keydown', (event) => { if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) { event.preventDefault(); sendMessage(); } });
  $('#record-button').addEventListener('click', toggleRecording);
  $('#stop-playback').addEventListener('click', stopPlayback);
  $('#view-current').addEventListener('click', () => { planView = 'current'; render(); });
  $('#view-proposed').addEventListener('click', () => { planView = 'proposed'; render(); });
  $('#disrupt-button').addEventListener('click', () => mutate('disrupt'));
  $('#export-button').addEventListener('click', exportCalendar);
  $('#memory-followup').addEventListener('click', () => setPrompt('Keep the activity at home and preserve the study time and dinner schedule we approved.'));
  $('#reset-button').addEventListener('click', () => requestReset(state.mode));
  $('#mode').addEventListener('change', (event) => { const mode = event.target.value; $('#mode').value = state.mode; requestReset(mode); });
  $('#cancel-reset').addEventListener('click', () => { pendingMode = null; $('#reset-dialog').close(); });
  $('#reset-dialog').addEventListener('cancel', () => { pendingMode = null; });
  $('#confirm-reset').addEventListener('click', async () => {
    const mode = pendingMode;
    $('#reset-dialog').close();
    pendingMode = null;
    if (!mode) return;
    const result = await mutate('reset', { mode });
    if (result) { $('#message-input').value = ''; draftRevision++; lastHistorySignature = ''; render(); }
  });
  $('#dismiss-notice').addEventListener('click', () => { $('#notice').hidden = true; });
  $('#retry-button').addEventListener('click', () => connected && state?.recovery?.canRetry ? mutate('retry') : refresh({ initial: true }));
  $('#close-sources').addEventListener('click', () => $('#sources-dialog').close());
  $('#sources-dialog').addEventListener('click', (event) => { if (event.target === $('#sources-dialog')) { const bounds = event.target.getBoundingClientRect(); if (event.clientX < bounds.left || event.clientX > bounds.right) event.target.close(); } });

  document.addEventListener('click', (event) => {
    const coach = event.target.closest('[data-coach]');
    if (coach) {
      stopPlayback();
      selectedCoach = coach.dataset.coach;
      $$('[data-coach]').forEach((card) => { const selected = card.dataset.coach === selectedCoach; card.classList.toggle('selected', selected); card.setAttribute('aria-pressed', String(selected)); });
      $('#conversation-subtitle').textContent = `${coachNames[selectedCoach]}’s voice · one shared conversation`;
      return;
    }
    const prompt = event.target.closest('[data-prompt]');
    if (prompt) { setPrompt(prompt.dataset.prompt); return; }
    const target = event.target.closest('[data-action]');
    if (!target || target.disabled) return;
    if (target.dataset.action === 'sources') { renderSources(); $('#sources-dialog').showModal(); }
    if (target.dataset.action === 'approve' || target.dataset.action === 'reject') {
      if (target.dataset.id === state?.proposal?.id && state.proposal.status === 'pending') mutate(target.dataset.action, { id: target.dataset.id });
    }
    if (target.dataset.action === 'speak-proposal') speak(state?.proposal?.speech);
    if (target.dataset.action === 'speak-message') speak(state?.history?.[Number(target.dataset.index)]?.text);
  });

  $$('.coach-image img').forEach((img) => {
    img.dataset.sourcePath = img.getAttribute('src');
    let retries = 0;
    let retryTimer;
    const retry = () => {
      img.style.visibility = 'hidden';
      clearTimeout(retryTimer);
      if (retries++ < 36) retryTimer = setTimeout(() => { img.src = `${img.dataset.sourcePath}?retry=${retries}`; }, 5000);
    };
    img.addEventListener('error', retry);
    img.addEventListener('load', () => { img.style.visibility = 'visible'; clearTimeout(retryTimer); });
    if (img.complete && !img.naturalWidth) retry();
  });
  const modeField = $('.mode-field');
  const modeHome = $('.sidebar-bottom');
  const compact = matchMedia('(max-width: 900px)');
  const moveMode = () => { if (compact.matches) $('.topbar-right').prepend(modeField); else modeHome.prepend(modeField); };
  compact.addEventListener('change', moveMode);
  moveMode();
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { refresh(); schedulePoll(); } });
  window.addEventListener('pagehide', () => { clearTimeout(pollTimer); recordCancelled = true; transcriptionGeneration++;transcriptionController?.abort(); if (isRecording()) recorder.stop(); releaseMicrophone(); stopPlayback(); });
  window.MentorDay={getState:()=>state?structuredClone(state):null,leave(){recordCancelled=true;transcriptionGeneration++;transcriptionController?.abort();transcriptionController=null;transcribing=false;if(isRecording())recorder.stop();releaseMicrophone();stopPlayback();}};
  renderSources();
  refresh({ initial: true }).finally(schedulePoll);
})();
