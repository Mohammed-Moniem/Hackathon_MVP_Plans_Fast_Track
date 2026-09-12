'use strict';

(() => {
  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const icon = (name) => `<svg class="icon" aria-hidden="true"><use href="#i-${name}"/></svg>`;
  const list = (value) => Array.isArray(value) ? value : [];
  const selected = new Set(['health', 'finance']);
  let state = null;
  let mutation = '';
  let councilPending = false;
  let pollTimer;
  let reading = false;
  let epoch = 0;
  let selectionInitialized = false;
  let analysis = null;
  let attachment = null;
  let meal = null;
  let imageBusy = false;
  let visionBusy = false;
  let draftBusy = false;
  let draftController = null;
  let editorRevision = 0;
  const editorDrafts = new Map();
  let discardEditorKey = null;
  let creationKey = null;
  const createdMentors = new Map();
  const editorCacheKey=()=>window.MentorApp?.getPath().endsWith('/mentors/new')?'new':$('#eco-mentor-id').value||'new';
  let voiceController = null;
  let audio = null;
  let audioUrl = null;
  let voiceRevision = 0;
  let voiceAvailable = null;
  let profileExample = false;
  let micRecorder = null;
  let micStream = null;
  let micTimer = null;
  let permissionTimer = null;
  let acquiringMic = false;
  let transcribing = false;
  let transcriptionController = null;
  let micEpoch = 0;
  const micRecording = () => micRecorder?.state === 'recording';
  const micBusy = () => acquiringMic || transcribing || Boolean(micRecorder);
  const micSupported = () => Boolean(navigator.mediaDevices?.getUserMedia && window.MediaRecorder);
  let ecosystemView = true;
  let plannerSourceCount = $('#source-count')?.textContent || '0';
  const navigationLinks = [...document.querySelectorAll('.navigation a.nav-link')].map((node) => ({ node, href: node.getAttribute('href') }));
  const sourceCountNode = $('#source-count');
  const sourceCountObserver = typeof MutationObserver === 'function' && sourceCountNode ? new MutationObserver(() => {
    if (ecosystemView) {
      if (sourceCountNode.textContent !== String(list(state?.run?.sources).length)) plannerSourceCount = sourceCountNode.textContent;
      syncSidebarSources();
    } else plannerSourceCount = sourceCountNode.textContent;
  }) : null;
  sourceCountObserver?.observe(sourceCountNode, { childList: true, characterData: true, subtree: true });
  const active = () => councilPending || state?.run?.status === 'running';
  const locked = () => Boolean(mutation) || active();
  const imagePath = (value) => {
    if (typeof value !== 'string' || !value) return null;
    try {
      const url = new URL(value, location.origin);
      return url.origin === location.origin && !url.username && !url.password && /^\/api\/ecosystem\/images\/[a-zA-Z0-9_.-]+$/.test(url.pathname) ? url.href : null;
    } catch { return null; }
  };
  const sourceUrl = (value) => {
    try {
      const url = new URL(value);
      return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.href : null;
    } catch { return null; }
  };
  const color = (value) => /^#[0-9a-f]{6}$/i.test(value || '') ? value : '#3157df';
  const money = (value, currency = 'AED') => {
    if (typeof value !== 'number' || !Number.isFinite(value)) return 'Not established';
    return `${/^[A-Z]{3}$/.test(currency || '') ? currency : 'Amount'} ${new Intl.NumberFormat('en', { maximumFractionDigits: 2 }).format(value)}`;
  };
  const time = (value) => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat('en', { hour: '2-digit', minute: '2-digit' }).format(date);
  };
  const region = (selector, html) => {
    const el = $(selector);
    if (el.dataset.ecoRender !== html) {
      const hadFocus = el.contains(document.activeElement);
      const disclosureSignature=selector==='#eco-decision'?String(state?.run?.id||''):selector;
      const disclosures = el.dataset.disclosureSignature===disclosureSignature ? new Map([...el.querySelectorAll('details')].map((node,index)=>[`${index}:${node.querySelector('summary')?.textContent}`,node.open])) : new Map();
      el.innerHTML = html; el.dataset.ecoRender = html;
      el.dataset.disclosureSignature=disclosureSignature;
      [...el.querySelectorAll('details')].forEach((node,index)=>{const key=`${index}:${node.querySelector('summary')?.textContent}`;if(disclosures.has(key))node.open=disclosures.get(key);});
      if(hadFocus){const target=el.querySelector('[data-eco-outcome]')||el.querySelector('h2')||el;target.tabIndex=-1;target.focus({preventScroll:true});}
    }
  };
  function notify(message) {
    $('#eco-notice-text').textContent = message;
    $('#eco-notice').hidden = false;
  }
  async function request(path, { method = 'GET', body, raw = false, audioResponse = false, headers = {}, signal } = {}) {
    const controller = new AbortController();
    const abort = () => controller.abort();
    if (signal?.aborted) abort();
    signal?.addEventListener('abort', abort, { once: true });
    const timer = setTimeout(abort, 240000);
    try {
      const response = await fetch(path, {
        method, cache: 'no-store', credentials: 'same-origin', signal: controller.signal,
        headers: { ...(body != null && !raw ? { 'Content-Type': 'application/json' } : {}), ...headers },
        body: body == null ? undefined : raw ? body : JSON.stringify(body),
      });
      if (!response.ok) {
        let message = `Request failed (HTTP ${response.status}).`;
        try { const result = await response.json(); if (typeof result.error === 'string') message = result.error; } catch { /* Preserve HTTP failure. */ }
        throw new Error(message);
      }
      if (audioResponse) {
        if (!response.headers.get('Content-Type')?.startsWith('audio/')) throw new Error('The voice service did not return audio. Your captions remain available.');
        return await response.blob();
      }
      try { return await response.json(); } catch { throw new Error('The service returned an unreadable response.'); }
    } catch (error) {
      if (error.name === 'AbortError') throw new Error(signal?.aborted ? 'Request cancelled.' : 'The request timed out after 240 seconds. Refresh state to check whether it completed.');
      throw error;
    } finally { clearTimeout(timer); signal?.removeEventListener('abort', abort); }
  }
  function acceptState(next) {
    if (!next || !Array.isArray(next.mentors) || !next.profile || !next.capabilities || !Array.isArray(next.memory)) throw new Error('Ecosystem state is incomplete. Please refresh state.');
    state = next;
    document.body.dataset.hasCouncil=String(Boolean(state.run));
    document.body.dataset.aiConfigured=String(Boolean(state.capabilities.agents));
    const ids = new Set(next.mentors.map((m) => m.id));
    for (const id of selected) if (!ids.has(id)) selected.delete(id);
    if (!selectionInitialized) {
      const rememberedTeam = list(next.run?.mentorIds).filter(id => ids.has(id));
      if (rememberedTeam.length >= 2 && rememberedTeam.length <= 4) { selected.clear(); rememberedTeam.forEach(id => selected.add(id)); }
      else for (const id of ['health', 'finance']) if (ids.has(id)) selected.add(id);
      // Exact canonical IDs take priority; domain matching supports migrated profiles.
      for (const domain of ['health', 'finance']) {
        if ([...selected].some((id) => id === domain || next.mentors.find((m) => m.id === id)?.domain?.toLowerCase().includes(domain))) continue;
        const mentor = next.mentors.find((m) => m.domain?.toLowerCase().includes(domain));
        if (mentor && selected.size < 2) selected.add(mentor.id);
      }
      selectionInitialized = true;
    }
    render();
    schedulePoll();
    window.dispatchEvent(new CustomEvent('mentoros:ecosystem', {detail:structuredClone(state)}));
  }
  function schedulePoll() {
    clearTimeout(pollTimer);
    if (active()) pollTimer = setTimeout(refresh, 1500);
  }
  async function refresh() {
    if (reading) { schedulePoll(); return; }
    reading = true;
    const stamp = epoch;
    try {
      const next = await request('/api/ecosystem/state');
      if (stamp === epoch) { acceptState(next); $('#eco-poll-status').textContent = ''; }
    } catch (error) {
      if (active()) $('#eco-poll-status').textContent = `Live update failed: ${error.message} Checking again…`;
      else notify(`Could not load your ecosystem: ${error.message}`);
    } finally { reading = false; schedulePoll(); }
  }
  async function mutate(kind, path, body, method = 'POST') {
    if (locked()) return false;
    mutation = kind;
    epoch++;
    renderControls();
    try { const next = await request(path, { method, body }); epoch++; acceptState(next); return true; }
    catch (error) { notify(error.message); throw error; }
    finally { mutation = ''; renderControls(); }
  }
  function switchTab(view, focus = false) {
    if (window.MentorApp) { window.MentorApp.navigate(view === 'day' ? '/mentoros/planner' : '/mentoros/council', {focus}); return; }
    const ecosystem = view === 'ecosystem';
    if (ecosystem && !ecosystemView) plannerSourceCount = sourceCountNode?.textContent || plannerSourceCount;
    ecosystemView = ecosystem;
    for (const link of navigationLinks) {
      const route = ({ '#conversation': '#eco-discussion', '#memory': '#eco-memory-section' })[link.href];
      if (route) link.node.setAttribute('href', ecosystem ? route : link.href);
    }
    syncSidebarSources();
    $('#eco-panel').hidden = !ecosystem;
    $('#eco-day-panel').hidden = ecosystem;
    document.body.dataset.ecoView = ecosystem ? 'ecosystem' : 'day';
    for (const [id, enabled] of [['ecosystem', ecosystem], ['day', !ecosystem]]) {
      const tab = $(`#eco-tab-${id}`);
      tab.setAttribute('aria-selected', String(enabled)); tab.tabIndex = enabled ? 0 : -1;
      if (enabled && focus) tab.focus();
    }
    const breadcrumb = $('.breadcrumb strong');
    if (breadcrumb) breadcrumb.textContent = ecosystem ? 'Ecosystem' : 'Daily planner';
    $$('.navigation .nav-link').forEach((link) => {
      const current = ecosystem ? link.dataset.ecoGo === 'ecosystem' : link.getAttribute('href') === '#planner';
      link.classList.toggle('active', current);
      if (current) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current');
    });
    if (!ecosystem) { stopVoice(); cancelMic('Voice input cancelled when switching to Your day. Your typed prompt is preserved.'); }
    else if (audio === null) $('#stop-playback')?.click();
  }
  function syncSidebarSources() {
    if (!sourceCountNode) return;
    const count = ecosystemView ? String(list(state?.run?.sources).length) : plannerSourceCount;
    if (sourceCountNode.textContent !== count) sourceCountNode.textContent = count;
  }
  function renderControls() {
    const waiting = state?.run?.status === 'pending';
    $('#eco-review-jump').hidden = !waiting || !state?.run?.decision;
    const recording = micRecording();
    $('#eco-record').disabled = !recording && (voiceAvailable === false || !micSupported() || micBusy() || locked());
    $('#eco-record').setAttribute('aria-pressed', String(recording));
    $('#eco-record').setAttribute('aria-label', recording ? 'Stop recording and transcribe your council prompt' : 'Record a council prompt');
    $('#eco-record').innerHTML = `${icon(recording ? 'stop' : 'mic')}<span>${recording ? 'Stop' : acquiringMic ? 'Opening mic…' : transcribing ? 'Transcribing…' : 'Record'}</span>`;
    $('#eco-cancel-record').hidden = !micBusy();
    $('#eco-cancel-record').textContent = transcribing ? 'Cancel transcription' : acquiringMic ? 'Cancel microphone request' : 'Cancel recording';
    if (!micBusy() && !$('#eco-mic-status').dataset.sticky) $('#eco-mic-status').textContent = voiceAvailable === false ? 'Voice is unavailable in this workspace. You can type your prompt.' : !micSupported() ? 'This browser cannot record audio. You can type your prompt.' : 'Record a voice prompt, then review the words before asking your council.';
    $('#eco-run').disabled = !state?.capabilities.agents || locked() || micBusy() || selected.size < 2 || selected.size > 4 || waiting || $('#eco-prompt').value.trim().length < 5;
    $('#eco-run').innerHTML = active() ? 'Council is working…' : `Ask your council ${icon('arrow')}`;
    $('#eco-run-help').textContent = active() ? 'Your council is working. Messages refresh every 1.5 seconds; reviews take about 1–3 minutes; complex reviews may take longer.' : waiting ? 'Review and approve or reject the current recommendation before starting another council.' : !state ? 'Connecting to council services…' : !state.capabilities.agents ? 'AI council is unavailable in this workspace. You can still create and edit mentors manually.' : selected.size < 2 ? 'Select at least 2 mentors to bring different perspectives to the table.' : 'You choose what to approve. A council does not book, buy, or change your planner.';
    $('#eco-receipt').disabled = visionBusy;
    $('#eco-analyze').disabled = !state?.capabilities.vision || visionBusy || !$('#eco-receipt').files.length;
    $('#eco-analyze').textContent = visionBusy ? 'Analyzing image…' : 'Analyze image';
    $('#eco-sample-receipt').disabled = !state?.capabilities.vision || visionBusy;
    $('#eco-generate-meal').disabled = !state?.capabilities.image || imageBusy || !$('#eco-meal-prompt').value.trim();
    $('#eco-generate-meal').textContent = imageBusy ? 'Generating image…' : 'Generate meal image';
    if (state && !state.capabilities.vision && !visionBusy) $('#eco-vision-status').textContent = 'Image analysis is not configured in this workspace. Your image stays available while you explore other pages.';
    if (state && !state.capabilities.image && !imageBusy) $('#eco-meal-status').textContent = 'Meal image generation is not configured in this workspace. You can still write and keep your meal idea.';
    $('#eco-draft').disabled = !state?.capabilities.agents || draftBusy;
    $('#eco-draft').textContent = draftBusy ? 'Drafting your mentor…' : 'Draft with AI';
    $('#eco-save-mentor').disabled = locked() || draftBusy;
    $('#eco-delete-mentor').disabled = locked() || draftBusy;
    $('#eco-save-profile').disabled = locked();
    $$('[data-eco-select], [data-eco-edit]').forEach((button) => { button.disabled = locked(); });
    $$('[data-eco-decision]').forEach((button) => { button.disabled = locked() || state?.run?.status !== 'pending'; });
    $$('[data-eco-listen]').forEach((button) => { button.disabled = voiceAvailable === false || micBusy(); });
    const search = $('#eco-search-ingredients');
    if (search) search.disabled = !state?.capabilities.agents || !state?.capabilities.search || locked() || micBusy() || waiting || selected.size < 2 || ![...selected].some((id) => state.mentors.find((m) => m.id === id)?.tools?.includes('search'));
    $('#eco-selection-status').textContent = `${selected.size} of 4 selected · choose 2–4 mentors for your council`;
  }
  function renderMentors() {
    region('#eco-mentors', state.mentors.length ? state.mentors.map((mentor) => {
      const chosen = selected.has(mentor.id);
      const initials = String(mentor.name).split(/\s+/).map((s) => s[0]).slice(0, 2).join('');
      return `<article class="eco-mentor ${chosen ? 'eco-selected' : ''}" style="--mentor-accent:${color(mentor.color)}"><button class="eco-mentor-select" data-eco-select="${esc(mentor.id)}" aria-pressed="${chosen}" aria-label="${esc(`${chosen ? 'Deselect' : 'Select'} ${mentor.name}, ${mentor.domain} mentor`)}"><div class="eco-card-top"><span class="eco-avatar">${esc(initials)}</span><span class="eco-selection-mark" aria-hidden="true">${chosen ? icon('check') : '+'}</span></div><h3>${esc(mentor.name)}</h3><span class="eco-domain">${esc(mentor.domain)}</span><p>${esc(mentor.description)}</p></button><div class="eco-card-footer"><span>${list(mentor.tools).map((tool) => esc(({ search: 'Search', vision: 'Vision', image: 'Images' })[tool] || tool)).join(' · ') || 'Conversation'}</span><button class="eco-text-button" data-eco-edit="${esc(mentor.id)}" aria-label="Edit ${esc(mentor.name)}">Edit ${icon('arrow')}</button></div></article>`;
    }).join('') : '<p class="eco-empty">Create your first mentors, then select two to start a council.</p>');
    $('#eco-mentors').setAttribute('aria-busy', 'false');
    region('#eco-capabilities', Object.entries({ agents: 'AI council', search: 'Web search', vision: 'Image analysis', image: 'Meal images' }).map(([key, label]) => `<span class="${state.capabilities[key] ? 'eco-capability-on' : ''}"><i aria-hidden="true"></i>${label} ${state.capabilities[key] ? 'configured' : 'not configured'}</span>`).join(''));
  }
  function render() {
    if (!state) return;
    renderMentors();
    const profile = state.profile;
    region('#eco-profile-summary', `<p class="eco-profile-location">${icon('pin')}${esc(profile.location || 'Location not set')}</p><dl class="eco-budget"><div><dt>Wellness / month</dt><dd>${esc(money(profile.wellnessBudget))}</dd></div><div><dt>Savings target / month</dt><dd>${esc(money(profile.savingsTarget))}</dd></div><div><dt>After essentials & savings</dt><dd>${esc(money(profile.monthlyIncome - profile.essentialExpenses - profile.savingsTarget))}</dd></div></dl><p class="eco-caption">Available before discretionary spending. Wellness is a budget, not recorded spending.</p>${profile.goals ? `<p class="eco-context-text"><strong>Your goals</strong>${esc(profile.goals)}</p>` : ''}${profile.preferences ? `<p class="eco-context-text"><strong>Preferences</strong>${esc(profile.preferences)}</p>` : ''}${profile.dietaryPreferences ? `<p class="eco-context-text"><strong>Dietary preferences</strong>${esc(profile.dietaryPreferences)}</p>` : ''}<p class="eco-caption">Profile revision ${esc(state.profileRevision)}</p>`);
    region('#eco-memory', state.memory.length ? `<ul>${state.memory.map((item) => `<li>${readableText(item, 320, 'Read approved decision')}</li>`).join('')}</ul>` : '<p class="eco-empty">No shared memories yet. Approved recommendations can inform future councils.</p>');
    renderRun(); renderControls(); syncSidebarSources();
  }
  function renderRun() {
    const run = state.run;
    const labels = { running: 'Mentors in conversation', pending: 'Your decision', approved: 'Approved by you', rejected: 'Recommendation rejected', failed: 'Council failed' };
    $('#eco-run-status').textContent = labels[run?.status] || 'No council yet';
    $('#eco-run-status').classList.toggle('eco-working', run?.status === 'running');
    region('#eco-run-context', run ? `<div class="eco-question">${readableText(run.prompt,210,'Read full question')}</div><p class="eco-caption">Using profile revision ${esc(run.profileRevision)}${run.profileRevision !== state.profileRevision ? ' · Your profile has changed since this council began.' : ''}</p>${run.attachment ? `<div class="eco-caption"><strong>Image analysis shared</strong>${readableText(run.attachment.summary,150,'Read full image analysis')}</div>` : ''}${run.error ? `<p class="eco-inline-error" role="alert">${esc(run.error)}</p>` : ''}` : '');
    const messages = list(run?.messages);
    const log = $('#eco-messages');
    if (!messages.length) {
      region('#eco-messages', `<p class="eco-empty">${run?.status === 'running' ? 'Waiting for the first mentor message. No messages have been returned yet.' : 'Give your council a question. Their proposals, peer reviews, and resolution will appear here as they arrive.'}</p>`);
    } else {
      const atBottom = log.scrollHeight - log.scrollTop - log.clientHeight < 90;
      if (log.dataset.run !== run.id || !log.querySelector('[data-eco-message]')) { log.replaceChildren(); log.dataset.run = run.id; delete log.dataset.ecoRender; }
      const existing = new Map([...log.children].map((node) => [node.dataset.ecoMessage, node]));
      for (const message of messages) {
        const mentor = state.mentors.find((m) => m.id === message.mentorId);
        const recipient = state.mentors.find((m) => m.id === message.to)?.name || message.to || 'Council';
        const phase = ({ proposal: 'Proposal', review: 'Peer review', resolution: 'Resolution', tool: 'Tool result' })[message.phase] || 'Message';
        const url = imagePath(message.imageUrl);
        const html = `<span class="eco-message-avatar" style="--mentor-accent:${color(mentor?.color)}" aria-hidden="true">${esc(String(message.mentorName).slice(0, 1))}</span><div class="eco-message-body"><div class="eco-message-meta"><strong>${esc(message.mentorName)}</strong><span>to ${esc(recipient)}</span><time datetime="${esc(message.at)}">${esc(time(message.at))}</time></div><span class="eco-phase">${phase}</span><div class="eco-message-text">${readableText(councilImageReferences(message.text, run).text.replace(/exa-[a-f0-9]+ — /g, ''), 320, 'Read full message')}</div>${url ? `<figure class="eco-council-image"><img src="${esc(url)}" alt="${esc(`Meal image generated by ${message.mentorName}: ${String(message.text || '').slice(0, 240)}`)}" loading="lazy"><figcaption>AI-generated image · ${esc(message.mentorName)}<span>${esc(message.text)}</span></figcaption></figure>` : message.imageUrl ? '<p class="eco-inline-error">The returned image URL is not an allowed ecosystem image.</p>' : ''}<button class="eco-text-button" data-eco-listen="${esc(message.id)}">${icon('volume')} Listen · AI voice</button></div>`;
        let node = existing.get(message.id);
        if (!node) { node = document.createElement('article'); node.className = 'eco-message'; node.dataset.ecoMessage = message.id; log.append(node); }
        if (node.dataset.render !== html) { node.innerHTML = html; node.dataset.render = html; }
        existing.delete(message.id);
      }
      existing.forEach((node) => node.remove());
      if (atBottom && run.status === 'running') log.scrollTop = log.scrollHeight;
    }
    renderDecision(run);
    $('#eco-sources').hidden = !list(run?.sources).length;
    region('#eco-sources', list(run?.sources).length ? `<h2>Follow the sources</h2><p class="eco-caption">Research returned by this council. Open original sources to verify details and current prices.</p><ol>${run.sources.map((source) => `<li>${sourceLink(source)}${source.snippet ? readableText(source.snippet.replace(/(^|\s)#{1,6}\s*/g, '$1').replace(/\s+/g, ' ').trim(), 240, 'Read source excerpt') : ''}${source.address ? `<small>${esc(source.address)}</small>` : ''}</li>`).join('')}</ol>` : '');
  }
  function sourceLink(source) {
    const url = sourceUrl(source?.url);
    return url ? `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(source.title || new URL(url).hostname)} ${icon('external')}</a>` : `<span>${esc(source?.title || 'Source')} · link unavailable</span>`;
  }
  // This is deliberately not a Markdown renderer: only known council image references are removed.
  function councilImageReferences(value, run) {
    const known = new Map();
    for (const message of list(run?.messages)) {
      const url = imagePath(message.imageUrl);
      if (url) known.set(url, message);
    }
    const images = new Map();
    const text = String(value || '').replace(/!\[([^\]\r\n]*)\]\(\s*([^\s)]+)\s*\)/g, (markup, label, target) => {
      const url = imagePath(target);
      const message = url ? known.get(url) : null;
      if (!message) return markup;
      images.set(url, { url, label: label.trim() || 'Meal illustration generated by the council', mentorName: message.mentorName });
      return ' ';
    }).replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
    return { text, images: [...images.values()] };
  }
  function readableText(value, limit = 420, label = 'Read full text') {
    const text = String(value || '');
    if (text.length <= limit) return `<p>${esc(text)}</p>`;
    const breakAt = text.lastIndexOf(' ', limit);
    const split = breakAt > limit / 2 ? breakAt : limit;
    return `<div class="eco-readable"><p class="eco-preview">${esc(text.slice(0, split))}…</p><details class="eco-full-text"><summary>${esc(label)}</summary><p>${esc(text)}</p></details></div>`;
  }
  function renderDecision(run) {
    const decision = run?.decision;
    $('#eco-decision').hidden = !decision;
    if (!decision) { region('#eco-decision', ''); return; }
    const conflicts = list(decision.conflicts);
    const alternatives = list(decision.alternatives);
    const summary = councilImageReferences(decision.summary, run);
    const recommendation = councilImageReferences(decision.recommendation, run);
    const referencedImages = [...new Map([...summary.images, ...recommendation.images].map((image) => [image.url, image])).values()];
    const figures = referencedImages.map((image) => `<figure class="eco-council-image eco-decision-image"><a href="${esc(image.url)}" target="_blank" rel="noopener noreferrer" aria-label="Open generated meal illustration"><img src="${esc(image.url)}" alt="${esc(image.label)}" loading="lazy"></a><figcaption>AI-generated illustration · ${esc(image.mentorName)}<span>${esc(image.label)}</span></figcaption></figure>`).join('');
    const actions = `<div class="eco-decision-actions">${run.status === 'pending' ? `<button class="eco-button eco-primary" data-eco-decision="approve" data-eco-run-id="${esc(run.id)}">${icon('check')}Approve recommendation</button><button class="eco-button eco-secondary" data-eco-decision="reject" data-eco-run-id="${esc(run.id)}">Reject</button>` : `<strong data-eco-outcome tabindex="-1" role="status">${esc(({ approved: 'Approved by you', rejected: 'Rejected by you', failed: 'Council failed' })[run.status] || 'Council is still working')}</strong>`}<button class="eco-text-button" data-eco-listen="decision">${icon('volume')}Listen · AI voice</button></div><p class="eco-caption">Approval updates shared memory. It does not buy, book, or change your planner.</p>`;
    region('#eco-decision', `<div class="eco-section-heading"><div><span class="eco-caption">The council’s recommendation</span><h2>${esc(decision.title)}</h2></div>${icon('spark')}</div>${run.error ? `<p class="eco-inline-error" role="alert">${esc(run.error)}</p>` : ''}${readableText(summary.text, 260, 'Read full summary')}<div class="eco-recommendation"><h3>A way forward</h3>${readableText(recommendation.text, 420, 'Read full recommendation')}</div>${actions}${figures}<section class="eco-conflicts"><h3>Where perspectives met${conflicts.length ? ` · ${conflicts.length} ${conflicts.length === 1 ? 'trade-off' : 'trade-offs'}` : ''}</h3><div class="eco-conflict-scroll" tabindex="0" role="region" aria-label="Cost conflicts and resolutions">${conflicts.length ? conflicts.map((conflict) => `<article><h4>${esc(conflict.topic)}</h4><div class="eco-conflict-position"><strong>Different positions</strong>${readableText(conflict.positions, 220, 'Read all positions')}</div><div class="eco-conflict-resolution"><strong>Resolution</strong>${readableText(conflict.resolution, 260, 'Read full resolution')}</div></article>`).join('') : '<p class="eco-caption">No conflicts were reported by the council.</p>'}</div></section>${alternatives.length ? `<details class="eco-alternatives"><summary>Other paths worth considering · ${alternatives.length} alternatives</summary>${alternatives.map((alternative) => `<article><div><h4>${esc(alternative.title)}</h4><span>${esc(money(alternative.estimatedCost))}${alternative.cadence === 'monthly' ? ' / month' : alternative.cadence === 'one-off' ? ' one-off' : ' · cadence unknown'}</span></div>${readableText(alternative.rationale, 300, 'Read full rationale')}<div class="eco-alternative-sources">${list(alternative.sourceIds).map((id) => { const source = list(run.sources).find((item) => item.id === id); return source ? sourceLink(source) : `<span class="eco-caption">Source ${esc(id)} unavailable</span>`; }).join('')}</div></article>`).join('')}</details>` : ''}${list(decision.cautions).length ? `<details class="eco-cautions" open><summary>Before you decide · ${decision.cautions.length} ${decision.cautions.length === 1 ? 'caution' : 'cautions'}</summary><ul>${decision.cautions.map((item) => `<li>${esc(item)}</li>`).join('')}</ul></details>` : ''}`);
  }
  async function runCouncil(prompt = $('#eco-prompt').value.trim()) {
    if (!state?.capabilities.agents || locked() || micBusy() || state.run?.status === 'pending' || selected.size < 2 || selected.size > 4 || prompt.length < 5) return;
    const mentorIds = [...selected];
    const sharedAttachment = attachment;
    councilPending = true;
    epoch++;
    renderControls(); schedulePoll();
    try {
      const next = await request('/api/ecosystem/council', { method: 'POST', body: { prompt, mentorIds, ...(sharedAttachment ? { attachment: sharedAttachment } : {}) } });
      epoch++; acceptState(next);
      if (next.run?.status === 'failed') notify(next.run.error || 'The council failed without a recommendation.');
      if (attachment === sharedAttachment && next.run?.status !== 'failed') { attachment = null; renderAttachment(); }
    } catch (error) { notify(`Council request failed: ${error.message}`); }
    finally { councilPending = false; renderControls(); await refresh(); }
  }
  function openMentor(id, inline = false) {
    if (window.MentorApp && !inline) { window.MentorApp.navigate(id ? `/mentoros/mentors/${encodeURIComponent(id)}/edit` : '/mentoros/mentors/new'); return; }
    if (!state || (id && !state.mentors.some(m=>m.id===id))) return false;
    creationKey=id?null:(editorDrafts.get('new')?.creationKey||crypto.randomUUID());
    const resolvedId=id||(creationKey?createdMentors.get(creationKey):undefined);
    const mentor = state?.mentors.find((m) => m.id === resolvedId);
    editorRevision++;
    $('#eco-mentor-form').reset(); $('#eco-draft-form').reset();
    $('#eco-mentor-id').value = mentor?.id || '';
    fillMentor(mentor || { color: '#3157df', voice: 'health', tools: [], goals: [] });
    $('#eco-mentor-title').textContent = mentor ? `Edit ${mentor.name}` : 'Create a mentor';
    $('#eco-mentor-description-prompt').value = mentor ? `Help me refine ${mentor.name}, my ${mentor.domain} mentor. ${mentor.description}` : '';
    $('#eco-delete-mentor').hidden = !mentor;
    $('#eco-delete-mentor').textContent = 'Delete mentor'; delete $('#eco-delete-mentor').dataset.confirm;
    $('#eco-mentor-status').textContent = '';
    $('#eco-draft-status').textContent = state?.capabilities.agents ? 'Describe a new role or ask to refine this mentor. Your draft is editable before saving.' : 'AI drafting is unavailable. Fill in the fields manually to create or edit a mentor.';
    const savedDraft=editorDrafts.get(id || 'new');
    if(savedDraft){fillMentor(savedDraft.fields);$('#eco-mentor-description-prompt').value=savedDraft.description;}
    if (!inline) $('#eco-mentor-dialog').showModal(); renderControls(); return true;
  }
  function fillMentor(mentor) {
    for (const key of ['name', 'domain', 'description', 'instructions']) $(`#eco-mentor-${key}`).value = mentor[key] || '';
    $('#eco-mentor-goals').value = list(mentor.goals).join('\n');
    $('#eco-mentor-voice').value = mentor.voice === 'career' ? 'career' : 'health';
    $('#eco-mentor-color').value = color(mentor.color);
    $$('#eco-mentor-form [name="tools"]').forEach((input) => { input.checked = list(mentor.tools).includes(input.value); });
  }
  function mentorFields() {
    return { ...Object.fromEntries(['name', 'domain', 'description', 'instructions'].map((key) => [key, $(`#eco-mentor-${key}`).value.trim()])), goals: $('#eco-mentor-goals').value.split('\n').map((s) => s.trim()).filter(Boolean), tools: $$('#eco-mentor-form [name="tools"]:checked').map((input) => input.value), voice: $('#eco-mentor-voice').value, color: color($('#eco-mentor-color').value) };
  }
  async function draftMentor(event) {
    event.preventDefault();
    if (draftBusy || !state?.capabilities.agents) return;
    draftBusy = true; renderControls();
    const revision = editorRevision;
    const controller = new AbortController(); draftController = controller;
    $('#eco-draft-status').textContent = 'The assistant is drafting editable fields…';
    const current = mentorFields();
    const context = current.name ? `\n\nCurrent mentor context: ${JSON.stringify({ name: current.name, domain: current.domain, description: current.description, goals: current.goals }).slice(0, 450)}` : '';
    const description = `${$('#eco-mentor-description-prompt').value.trim()}${context}`;
    try {
      const result = await request('/api/ecosystem/mentor-draft', { method: 'POST', body: { description }, signal: controller.signal });
      if (!result.mentor || typeof result.mentor.name !== 'string') throw new Error('The assistant did not return an editable mentor draft.');
      if (revision !== editorRevision) { $('#eco-draft-status').textContent = 'Your manual edits were kept. Request a new draft when you are ready to replace them.'; return; }
      fillMentor(result.mentor);
      $('#eco-draft-status').textContent = 'Draft ready. Edit the fields, then save your mentor.';
    } catch (error) { if (!controller.signal.aborted) $('#eco-draft-status').textContent = `Draft failed: ${error.message} You can fill in every field manually.`; }
    finally { draftBusy = false; draftController = null; renderControls(); }
  }
  async function saveMentor(event) {
    event.preventDefault();
    if (locked() || draftBusy) return;
    const submittingCreation=creationKey;
    const submittingCacheKey=editorCacheKey();
    const id = $('#eco-mentor-id').value || (submittingCreation?createdMentors.get(submittingCreation):'') || '';
    const submittingPath=window.MentorApp?.getPath();const submittingRevision=editorRevision;
    const fields = mentorFields();
    if (fields.goals.length > 8 || fields.goals.some((goal) => goal.length > 180)) { $('#eco-mentor-status').textContent = 'Use up to 8 goals, with no more than 180 characters per goal.'; return; }
    if (['name', 'domain', 'description', 'instructions'].some((key) => !fields[key])) { $('#eco-mentor-status').textContent = 'Add a name, domain, description, and instructions before saving.'; return; }
    $('#eco-mentor-status').textContent = 'Saving mentor…';
    try {
      const previousIds = new Set(state.mentors.map(mentor => mentor.id));
      const next = await mutate('mentor', '/api/ecosystem/mentors', { mentor: { ...fields, ...(id ? { id } : {}) } });
      if (next) {
        const savedId = id || state.mentors.find(mentor => !previousIds.has(mentor.id))?.id;
        if(!id && submittingCreation && savedId)createdMentors.set(submittingCreation,savedId);
        const sameEditor = !window.MentorApp || (window.MentorApp.getPath()===submittingPath && editorRevision===submittingRevision);
        const cached=editorDrafts.get(submittingCacheKey);
        if(sameEditor || (cached&&JSON.stringify(cached.fields)===JSON.stringify(fields)))editorDrafts.delete(submittingCacheKey);
        if(window.MentorApp){if(sameEditor){discardEditorKey=submittingCacheKey;window.MentorApp.navigate(savedId ? `/mentoros/mentors/${encodeURIComponent(savedId)}` : '/mentoros/mentors');}else notify('Mentor saved. Any newer edits in your current page were kept.');return;}
        $('#eco-mentor-dialog').close();
        ($$('[data-eco-edit]').find(button => button.dataset.ecoEdit === savedId) || $('#eco-create')).focus();
      }
    } catch (error) { if(!window.MentorApp||window.MentorApp.getPath()===submittingPath)$('#eco-mentor-status').textContent = `Could not save: ${error.message}`;else notify(`Could not save mentor: ${error.message}`); }
  }
  function openProfile(inline = false) {
    if (window.MentorApp && inline !== true) {window.MentorApp.navigate('/mentoros/profile');return;}
    if(!state) return false;
    const form = $('#eco-profile-form'); form.reset(); profileExample = false;
    for (const [key, value] of Object.entries(state?.profile || {})) if (form.elements.namedItem(key)) form.elements.namedItem(key).value = value;
    $('#eco-profile-status').textContent = '';
    $('#eco-profile-example-label').textContent = 'Optional demo values, not your personal financial data. Edit before saving.';
    if (inline !== true) $('#eco-profile-dialog').showModal(); renderControls(); return true;
  }
  async function saveProfile(event) {
    event.preventDefault(); if (locked()) return;
    const submittingPath=window.MentorApp?.getPath();
    const submittedForm=JSON.stringify([...new FormData(event.currentTarget)]);
    const data = new FormData(event.currentTarget);
    const profile = { currency: 'AED' };
    for (const [key, value] of data.entries()) profile[key] = ['monthlyIncome', 'essentialExpenses', 'savingsTarget', 'wellnessBudget'].includes(key) ? Number(value) : String(value).trim();
    $('#eco-profile-status').textContent = 'Saving shared profile…';
    try {
      if (await mutate('profile', '/api/ecosystem/profile', { profile })) { if(window.MentorApp){if(window.MentorApp.getPath()===submittingPath&&JSON.stringify([...new FormData($('#eco-profile-form'))])===submittedForm)window.MentorApp.navigate('/mentoros/context');else notify('Shared profile saved. Your current page and any newer edits were kept.');}else $('#eco-profile-dialog').close(); if (profileExample) notify('Synthetic example profile saved. Its values remain editable in Shared profile.'); }
    } catch (error) { $('#eco-profile-status').textContent = `Could not save: ${error.message}`; }
  }
  function analysisMarkup(value) {
    return `<p>${esc(value.summary)}</p><dl class="eco-receipt-totals"><div><dt>Merchant</dt><dd>${esc(value.merchant || 'Not identified')}</dd></div><div><dt>Read total</dt><dd>${esc(money(value.total, value.currency))}</dd></div></dl>${list(value.items).length ? `<ul>${value.items.map((item) => `<li>${esc(item.name)} <span>${esc(money(item.amount, value.currency))}</span></li>`).join('')}</ul>` : ''}${list(value.uncertainties).length ? `<div class="eco-cautions"><strong>Uncertainties</strong><ul>${value.uncertainties.map((item) => `<li>${esc(item)}</li>`).join('')}</ul></div>` : ''}`;
  }
  function renderAttachment() {
    $('#eco-attachment').hidden = !attachment;
    region('#eco-attachment', attachment ? `<div><strong>Image analysis attached to your next council</strong><p>${esc(attachment.summary)}</p></div><button class="eco-text-button" id="eco-remove-attachment">Remove</button>` : '');
  }
  async function analyzeImage(event, sample = false) {
    event.preventDefault(); if (visionBusy || !state?.capabilities.vision) return;
    let file = $('#eco-receipt').files[0];
    if (sample) {
      visionBusy = true; renderControls();
      $('#eco-vision-status').textContent = 'Loading the synthetic sample receipt…';
      try {
        const response = await fetch('/assets/demo-receipt.jpg', { credentials: 'same-origin', signal: AbortSignal.timeout(240000) });
        if (!response.ok) throw new Error(`Sample receipt failed to load (HTTP ${response.status}).`);
        const blob = await response.blob();
        file = new File([blob], 'synthetic-demo-receipt.jpg', { type: 'image/jpeg' });
      } catch (error) { $('#eco-vision-status').textContent = error.message; visionBusy = false; renderControls(); return; }
    }
    if (!file || !['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 6 * 1024 * 1024 || !file.size) { $('#eco-vision-status').textContent = 'Choose a non-empty PNG, JPEG, or WebP image no larger than 6 MiB.'; visionBusy = false; renderControls(); return; }
    visionBusy = true; analysis = null; region('#eco-vision-result', ''); renderControls();
    $('#eco-vision-status').textContent = 'Reading your image…';
    try {
      const result = await request('/api/ecosystem/vision', { method: 'POST', raw: true, body: file, headers: { 'Content-Type': file.type } });
      if (!result.analysis || typeof result.analysis.summary !== 'string') throw new Error('The vision service returned no analysis.');
      analysis = result.analysis;
      region('#eco-vision-result', `${sample ? '<p class="eco-caption">Synthetic sample receipt · fictional merchant and purchases.</p>' : ''}${analysisMarkup(analysis)}<button id="eco-attach-analysis" class="eco-button eco-secondary">Attach analysis to council</button>`);
      $('#eco-vision-status').textContent = 'Analysis ready. Review uncertain details before attaching.';
    } catch (error) { $('#eco-vision-status').textContent = `Analysis failed: ${error.message}`; }
    finally { visionBusy = false; renderControls(); }
  }
  async function generateMeal(event) {
    event.preventDefault(); if (imageBusy || !state?.capabilities.image) return;
    imageBusy = true; renderControls();
    $('#eco-meal-status').textContent = 'Generating your meal image…';
    try {
      const result = await request('/api/ecosystem/meal-image', { method: 'POST', body: { prompt: $('#eco-meal-prompt').value.trim() } });
      const url = imagePath(result.image?.url);
      if (!url) throw new Error('The service returned an invalid image URL. Only this workspace’s ecosystem images are allowed.');
      meal = result.image;
      region('#eco-meal-result', `<figure><img src="${esc(url)}" alt="${esc(meal.caption || `AI-generated meal: ${meal.prompt}`)}"><figcaption>AI-generated meal image<span>${esc(meal.caption || meal.prompt)}</span></figcaption></figure><button id="eco-search-ingredients" class="eco-button eco-secondary">Search ingredients with council</button><p class="eco-caption">Choose 2–4 mentors, including one with Web search enabled. Image generation does not establish nutrition or ingredient prices.</p>`);
      $('#eco-meal-status').textContent = 'Image generated. Your council can research ingredients, alternatives, and costs.';
    } catch (error) { $('#eco-meal-status').textContent = `Image generation failed: ${error.message}`; }
    finally { imageBusy = false; renderControls(); }
  }
  function micStatus(message) {
    $('#eco-mic-status').textContent = message;
    $('#eco-mic-status').dataset.sticky = 'true';
  }
  function releaseMic() {
    clearInterval(micTimer); micTimer = null;
    clearTimeout(permissionTimer); permissionTimer = null;
    micStream?.getTracks().forEach((track) => track.stop()); micStream = null;
  }
  function cancelMic(message = 'Voice input cancelled. Your typed prompt is preserved.') {
    if (!micBusy() && !transcriptionController) return;
    micEpoch++;
    const recorder = micRecorder; micRecorder = null;
    if (recorder?.state === 'recording') { try { recorder.stop(); } catch { /* Tracks are still released below. */ } }
    releaseMic(); acquiringMic = false; transcribing = false;
    transcriptionController?.abort(); transcriptionController = null;
    micStatus(message); renderControls();
  }
  function insertTranscript(text) {
    const prompt = $('#eco-prompt');
    const next = `${prompt.value}${prompt.value.trim() ? '\n' : ''}${text.trim()}`;
    if (next.length > 6000) {
      $('#eco-transcript-overflow').hidden = false;
      $('#eco-transcript-text').value = text;
      micStatus('The transcript would exceed the 6,000-character prompt limit. Shorten the transcript or your prompt, then insert it. Your existing text is preserved.');
      return;
    }
    prompt.value = next;
    $('#eco-transcript-overflow').hidden = true;
    micStatus('Transcribed. Review and edit your prompt, then choose Ask your council. Nothing has been sent to the council.');
    prompt.focus(); renderControls();
  }
  async function toggleMic() {
    if (micRecording()) { micRecorder.stop(); return; }
    if ($('#eco-record').disabled || micBusy() || !micSupported()) return;
    const stamp = ++micEpoch;
    acquiringMic = true; stopVoice(); $('#stop-playback')?.click();
    micStatus('Waiting for microphone permission…'); renderControls();
    permissionTimer = setTimeout(() => {
      if (stamp === micEpoch && acquiringMic) cancelMic('Microphone permission timed out after 30 seconds. Your typed prompt is preserved. Press Record to try again.');
    }, 30000);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (stamp !== micEpoch || !ecosystemView) { stream.getTracks().forEach((track) => track.stop()); return; }
      clearTimeout(permissionTimer); permissionTimer = null;
      micStream = stream;
      const mime = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg;codecs=opus'].find((type) => MediaRecorder.isTypeSupported(type));
      const recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      micRecorder = recorder;
      let chunks = []; let bytes = 0; let limitReached = false;
      recorder.ondataavailable = (event) => {
        if (stamp !== micEpoch || !event.data.size) return;
        bytes += event.data.size;
        if (bytes > 10 * 1024 * 1024) { cancelMic('Recording exceeded 10 MiB and was cancelled. Try a shorter voice prompt.'); return; }
        chunks.push(event.data);
      };
      recorder.onerror = () => { if (stamp === micEpoch) cancelMic('Recording failed. Your typed prompt is preserved. You can record again or type.'); };
      recorder.onstop = async () => {
        if (stamp !== micEpoch) return;
        const contentType = recorder.mimeType || chunks[0]?.type || 'audio/webm';
        releaseMic(); micRecorder = null;
        const blob = new Blob(chunks, { type: contentType }); chunks = [];
        if (!blob.size) { micStatus('No audio was captured. Try recording again or type your prompt.'); renderControls(); return; }
        transcribing = true;
        const controller = new AbortController(); transcriptionController = controller;
        micStatus(limitReached ? 'Recording stopped at the 60-second limit. Transcribing your words…' : 'Transcribing your words… You can cancel or keep editing your prompt.');
        renderControls();
        const extension = contentType.includes('mp4') ? 'm4a' : contentType.includes('ogg') ? 'ogg' : 'webm';
        try {
          const result = await request('/api/voice/transcribe', { method: 'POST', raw: true, body: blob, headers: { 'Content-Type': contentType, 'X-Filename': `ecosystem-prompt.${extension}` }, signal: controller.signal });
          if (stamp !== micEpoch || !ecosystemView) return;
          if (typeof result.text !== 'string' || !result.text.trim()) throw new Error('No words were detected. Try again or type your prompt.');
          insertTranscript(result.text);
        } catch (error) { if (stamp === micEpoch) micStatus(`Transcription failed: ${error.message} Your typed prompt is preserved.`); }
        finally {
          if (stamp === micEpoch) { transcribing = false; transcriptionController = null; renderControls(); }
        }
      };
      acquiringMic = false;
      recorder.start(1000);
      const started = Date.now();
      const update = () => {
        if (stamp !== micEpoch || !micRecording()) return;
        const seconds = Math.floor((Date.now() - started) / 1000);
        micStatus(`Recording ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')} · Stop to transcribe, or cancel. 60 seconds maximum.`);
        if (seconds >= 60) { limitReached = true; recorder.stop(); }
      };
      update(); micTimer = setInterval(update, 500); renderControls();
    } catch (error) {
      if (stamp !== micEpoch) return;
      releaseMic(); micRecorder = null;
      micStatus(error.name === 'NotAllowedError' ? 'Microphone access was denied. Type your prompt or enable microphone access in your browser.' : error.name === 'NotFoundError' ? 'No microphone was found. You can type your prompt.' : 'The microphone could not start. You can try again or type your prompt.');
    } finally { if (stamp === micEpoch) { acquiringMic = false; renderControls(); } }
  }
  function stopVoice() {
    voiceRevision++; voiceController?.abort(); voiceController = null;
    if (audio) { audio.pause(); audio.src = ''; audio = null; }
    if (audioUrl) URL.revokeObjectURL(audioUrl); audioUrl = null;
    $('#eco-playback').hidden = true;
  }
  async function speak(id) {
    const message = state?.run?.messages.find((m) => m.id === id);
    const fullText = councilImageReferences(id === 'decision' ? state?.run?.decision?.recommendation : message?.text, state?.run).text;
    if (!fullText || voiceAvailable === false || micBusy()) return;
    stopVoice(); $('#stop-playback')?.click();
    const mentor = state.mentors.find((m) => m.id === message?.mentorId);
    const text = String(fullText).slice(0, 2000);
    const revision = voiceRevision;
    const controller = new AbortController(); voiceController = controller;
    $('#eco-playback').hidden = false;
    $('#eco-voice-label').textContent = `${mentor?.name || 'Council'} · AI-generated voice`;
    $('#eco-captions').textContent = text;
    $('#eco-voice-status').textContent = `Preparing audio…${String(fullText).length > 2000 ? ' Reading the first 2,000 characters; the full text remains in the timeline.' : ''}`;
    try {
      const blob = await request('/api/voice/speak', { method: 'POST', body: { text, coach: mentor?.voice === 'career' ? 'career' : 'health' }, audioResponse: true, signal: controller.signal });
      if (revision !== voiceRevision) return;
      audioUrl = URL.createObjectURL(blob); audio = new Audio(audioUrl);
      audio.onended = () => { if (revision === voiceRevision) { $('#eco-voice-status').textContent = 'Playback complete. Captions remain above.'; URL.revokeObjectURL(audioUrl); audioUrl = null; } };
      audio.onerror = () => { if (revision === voiceRevision) $('#eco-voice-status').textContent = 'Audio could not play. Read the captions above.'; };
      await audio.play();
      if (revision === voiceRevision) $('#eco-voice-status').textContent = 'Playing AI-generated audio · captions above';
    } catch (error) { if (revision === voiceRevision) $('#eco-voice-status').textContent = `Voice failed: ${error.message}`; }
  }
  $('#eco-tab-ecosystem').addEventListener('click', () => switchTab('ecosystem'));
  $('#eco-tab-day').addEventListener('click', () => switchTab('day'));
  $('.eco-tabs').addEventListener('keydown', (event) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    switchTab(event.key === 'Home' ? 'ecosystem' : event.key === 'End' ? 'day' : $('#eco-panel').hidden ? 'ecosystem' : 'day', true);
  });
  document.addEventListener('click', async (event) => {
    const nav = event.target.closest('.navigation .nav-link');
    if (nav && !window.MentorApp) {
      if (nav.dataset.ecoGo === 'ecosystem') { switchTab('ecosystem'); event.preventDefault(); }
      else if (!ecosystemView || nav.getAttribute('href') === '#planner') switchTab('day');
    }
    const close = event.target.closest('[data-eco-close]');
    if (close) {
      if(window.MentorApp && ['eco-mentor-dialog','eco-profile-dialog'].includes(close.dataset.ecoClose)) {
        if(close.dataset.ecoClose==='eco-profile-dialog')window.MentorApp.navigate('/mentoros/context');
        else {const id=$('#eco-mentor-id').value;const key=editorCacheKey();editorDrafts.delete(key);discardEditorKey=key;window.MentorApp.navigate(id?`/mentoros/mentors/${encodeURIComponent(id)}`:'/mentoros/mentors');}
      } else document.getElementById(close.dataset.ecoClose)?.close();
    }
    const select = event.target.closest('[data-eco-select]');
    if (select && !select.disabled) {
      const id = select.dataset.ecoSelect;
      if (selected.has(id)) selected.delete(id);
      else if (selected.size < 4) selected.add(id);
      else { notify('Your council can have up to 4 mentors. Deselect one before adding another.'); return; }
      renderMentors(); renderControls();
      $$('[data-eco-select]').find((button) => button.dataset.ecoSelect === id)?.focus();
    }
    const edit = event.target.closest('[data-eco-edit]'); if (edit && !edit.disabled) openMentor(edit.dataset.ecoEdit);
    const decision = event.target.closest('[data-eco-decision]');
    if (decision && !decision.disabled && decision.dataset.ecoRunId === state?.run?.id) {
      const decisionPath = window.MentorApp?.getPath();
      const decisionId = state.run.id;
      try {
        await mutate('decision', '/api/ecosystem/decision', { id: decisionId, action: decision.dataset.ecoDecision });
        // Disabling the submitting button can return focus to body before the
        // result renders. Restore it only if the user has not moved elsewhere.
        if (window.MentorApp?.getPath() === decisionPath && state.run?.id === decisionId &&
            (document.activeElement === document.body || $('#eco-decision').contains(document.activeElement))) {
          $('#eco-decision [data-eco-outcome]')?.focus({ preventScroll: true });
        }
      } catch { /* Error is visible in notice. */ }
    }
    const listen = event.target.closest('[data-eco-listen]'); if (listen && !listen.disabled) speak(listen.dataset.ecoListen);
    if (event.target.closest('#eco-attach-analysis') && analysis) { attachment = structuredClone(analysis); renderAttachment(); window.MentorApp?.navigate('/mentoros/council'); $('#eco-prompt').focus(); $('#eco-vision-status').textContent = 'Analysis attached. Add a question and ask your council when ready.'; }
    if (event.target.closest('#eco-remove-attachment')) { attachment = null; renderAttachment(); }
    const search = event.target.closest('#eco-search-ingredients');
    if (search && !search.disabled && meal) {
      const prompt = `Research ingredients for this meal: ${meal.prompt}. Meal description: ${meal.caption || ''}. Use web search to find ingredients available near my profile location, compare costs and dietary suitability, and include source links. Explain uncertainty; do not infer nutritional accuracy from the generated image. Do not purchase anything.`;
      $('#eco-prompt').value = prompt; renderControls();window.MentorApp?.navigate('/mentoros/council');$('#eco-prompt').focus();notify('The ingredient question is ready. Review the selected mentors, then ask your council.');
    }
  });
  // Capture only the planner's Sources control while ecosystem is active; voice handlers are untouched.
  document.addEventListener('click', (event) => {
    const button = event.target.closest('.navigation [data-action="sources"]');
    if (!button || !ecosystemView) return;
    event.preventDefault(); event.stopImmediatePropagation();
    if (list(state?.run?.sources).length) { $('#eco-sources').scrollIntoView({ block: 'start', behavior: 'smooth' }); }
    else { notify('This council has no research sources yet. Sources will appear as mentors return them.'); }
  }, true);
  $('#eco-review-jump').addEventListener('click', (event) => { event.preventDefault(); if(window.MentorApp){window.MentorApp.navigate('/mentoros/council/review');return;} $('#eco-decision').scrollIntoView({ block: 'start', behavior: 'smooth' }); $('#eco-decision').focus({ preventScroll: true }); });
  $('#eco-council-form').addEventListener('submit', (event) => { event.preventDefault(); runCouncil(); });
  $('#eco-prompt').addEventListener('input', renderControls);
  $('#eco-gym-example').addEventListener('click', () => { $('#eco-prompt').value = 'I want to join a gym in my area. Compare a gym membership, pay-as-you-go sessions, and an at-home plan against my shared wellness budget and savings goal. Health mentor: explain what supports a sustainable routine. Finance mentor: challenge the costs. Resolve the trade-offs and suggest alternatives with sources. Do not book or buy anything.'; $('#eco-prompt').focus(); renderControls(); });
  $('#eco-create').addEventListener('click', () => openMentor());
  $('#eco-draft-form').addEventListener('submit', draftMentor);
  $('#eco-mentor-form').addEventListener('submit', saveMentor);
  $('#eco-mentor-form').addEventListener('input', () => { editorRevision++; });
  $('#eco-mentor-dialog').addEventListener('close', () => { editorRevision++; draftController?.abort(); });
  $('#eco-delete-mentor').addEventListener('click', async () => {
    const button = $('#eco-delete-mentor'); if (locked() || draftBusy) return;
    if (!button.dataset.confirm) { button.dataset.confirm = 'yes'; button.textContent = 'Confirm delete'; $('#eco-mentor-status').textContent = 'Delete this mentor? Existing council messages remain in the current run. Press Confirm delete to continue.'; return; }
    const deletingId=$('#eco-mentor-id').value;const deletingCacheKey=editorCacheKey();const submittingPath=window.MentorApp?.getPath();
    try { if(await mutate('delete',`/api/ecosystem/mentors/${encodeURIComponent(deletingId)}`,undefined,'DELETE')) {
      editorDrafts.delete(deletingCacheKey);
      if(window.MentorApp){if(window.MentorApp.getPath()===submittingPath){discardEditorKey=deletingCacheKey;window.MentorApp.navigate('/mentoros/mentors');}else notify('Mentor deleted. Your current page was kept.');}
      else {$('#eco-mentor-dialog').close();$('#eco-create').focus();}
    }} catch(error){if(!window.MentorApp||window.MentorApp.getPath()===submittingPath)$('#eco-mentor-status').textContent=error.message;else notify(error.message);}

  });
  $('#eco-open-profile').addEventListener('click', openProfile); $('#eco-edit-profile').addEventListener('click', openProfile);
  $('#eco-profile-form').addEventListener('submit', saveProfile);
  $('#eco-profile-example').addEventListener('click', () => {
    const sample = { location: 'Dubai Marina, Dubai', monthlyIncome: 12000, essentialExpenses: 6500, savingsTarget: 2500, wellnessBudget: 450, preferences: 'Synthetic example: I prefer activities close to home and flexible monthly plans.', dietaryPreferences: 'Synthetic example: vegetarian; prefer high-protein meals.', goals: 'Synthetic example: exercise three times a week while protecting my savings target.' };
    for (const [key, value] of Object.entries(sample)) $('#eco-profile-form').elements.namedItem(key).value = value;
    profileExample = true; $('#eco-profile-example-label').textContent = 'Synthetic example loaded. These are invented demo values. Edit them before saving.';
  });
  $('#eco-vision-form').addEventListener('submit', analyzeImage);
  $('#eco-sample-receipt').addEventListener('click', (event) => analyzeImage(event, true));
  $('#eco-receipt').addEventListener('change', () => { analysis = null; region('#eco-vision-result', ''); $('#eco-vision-status').textContent = ''; renderControls(); });
  $('#eco-meal-form').addEventListener('submit', generateMeal);
  $('#eco-meal-prompt').addEventListener('input', renderControls);
  $('#eco-stop-voice').addEventListener('click', stopVoice);
  $('#eco-record').addEventListener('click', toggleMic);
  $('#eco-cancel-record').addEventListener('click', () => cancelMic());
  $('#eco-insert-transcript').addEventListener('click', () => { const text = $('#eco-transcript-text').value.trim(); if (text) insertTranscript(text); });
  $('#eco-dismiss').addEventListener('click', () => { $('#eco-notice').hidden = true; });
  $('#eco-retry').addEventListener('click', refresh);
  // Native dialogs provide Escape handling, focus trapping, and focus restoration.
  $$('.eco-dialog').forEach((dialog) => dialog.addEventListener('click', (event) => {
    if (dialog.dataset.inline || event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
  }));
  $('#eco-panel').addEventListener('error', (event) => {
    if (event.target instanceof HTMLImageElement) {
      event.target.hidden = true;
      const caption = event.target.closest('figure')?.querySelector('figcaption');
      if (caption) caption.textContent = 'The generated image could not be loaded. Its service URL may have expired; generate a new image to try again.';
    }
  }, true);
  window.addEventListener('hashchange', () => { if (['#planner', '#conversation', '#memory'].includes(location.hash)) switchTab('day'); if (location.hash === '#ecosystem') switchTab('ecosystem'); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
  window.addEventListener('pagehide', () => { clearTimeout(pollTimer); sourceCountObserver?.disconnect(); cancelMic('Voice input cancelled when leaving the page.'); stopVoice(); draftController?.abort(); });
  window.MentorEcosystem = {
    getState:()=>state ? structuredClone(state) : null,
    getSelectedIds:()=>[...selected], refresh,
    prepareMentor:(id)=>openMentor(id,true), prepareProfile:()=>openProfile(true),
    setContext(view){ecosystemView=view!=='planner';syncSidebarSources();stopVoice();cancelMic('Voice input cancelled when changing workspace. Your typed prompt is preserved.'); if(ecosystemView)window.MentorDay?.leave();},
    involveMentor(id){if(!state?.mentors.some(m=>m.id===id))return;if(!selected.has(id)){if(selected.size>=4)selected.delete([...selected].at(-1));selected.add(id);}renderMentors();renderControls();},
    leaveEditor(){const key=editorCacheKey();if(/\/mentors\/(?:new|[^/]+\/edit)$/.test(window.MentorApp?.getPath()||'')){if(discardEditorKey!==key)editorDrafts.set(key,{fields:mentorFields(),description:$('#eco-mentor-description-prompt').value,creationKey});if(discardEditorKey===key)discardEditorKey=null;}editorRevision++;draftController?.abort();},
  };
  switchTab(['#planner', '#conversation', '#memory'].includes(location.hash) ? 'day' : 'ecosystem');
  renderControls(); refresh();
  // Voice is an optional planner capability; this read-only request never synthesizes speech.
  request('/api/mentoros/state').then((next) => { voiceAvailable = typeof next?.capabilities?.voice === 'boolean' ? next.capabilities.voice : null; renderControls(); }).catch(() => { /* Voice failures remain explicit on attempted playback. */ });
})();
