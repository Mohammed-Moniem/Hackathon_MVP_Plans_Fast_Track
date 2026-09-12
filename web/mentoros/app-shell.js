'use strict';

// The shell owns pages and navigation. Existing modules own data and actions.
(() => {
  const root = '/mentoros/';
  const $ = (selector) => document.querySelector(selector);
  const all = (selector) => [...document.querySelectorAll(selector)];
  const list = (value) => Array.isArray(value) ? value : [];
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const icon = (name) => `<svg class="icon" aria-hidden="true"><use href="#i-${name}"/></svg>`;
  const href = (path = '') => `${root}${path}`;
  const mentorPath = (id) => href(`mentors/${encodeURIComponent(id)}`);
  const link = (path, label, classes = 'app-text-link') => `<a href="${esc(path)}" data-app-route class="${classes}">${label}${icon('arrow')}</a>`;
  const accent = (value) => /^#[0-9a-f]{6}$/i.test(value || '') ? value : '#3455eb';
  const initials = (value) => String(value || '?').trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('');
  const truncate = (value, limit = 170) => {
    const text = String(value || '');
    return text.length > limit ? `${text.slice(0, limit).trimEnd()}…` : text;
  };
  const toolNames = { search: 'Web search', vision: 'Image analysis', image: 'Meal images' };
  const statuses = { running: 'In conversation', pending: 'Needs your review', approved: 'Approved by you', rejected: 'Rejected by you', failed: 'Council interrupted' };
  const visionPerspectives = {
    health: { name: 'Health', person: 'Mira', question: 'Can this choice support my energy and routines?', contribution: 'Protects sleep, movement and sustainable habits—without treating wellbeing as the only priority.', challenge: 'Challenges the finance view when the cheapest option creates a routine you cannot maintain.', signal: 'Energy · routine · sustainability' },
    finance: { name: 'Finance', person: 'Nadia', question: 'What does this cost now—and what flexibility does it preserve?', contribution: 'Surfaces the real monthly trade-off, opportunity cost and a lower-commitment alternative.', challenge: 'Asks Career to separate a useful investment from an optimistic assumption about future income.', signal: 'Cost · runway · reversibility' },
    career: { name: 'Career', person: 'Atlas', question: 'Which option builds useful momentum without crowding out today?', contribution: 'Connects the decision to skills, time and the next credible step rather than a distant promise.', challenge: 'Asks Health whether an ambitious pace is realistic alongside work and recovery.', signal: 'Momentum · learning · time' },
    custom: { name: 'Your lens', person: 'A mentor you shape', question: 'What personal value or constraint is the general advice missing?', contribution: 'Carries the context only you can define: family, culture, creative ambition, accessibility or another lived priority.', challenge: 'Questions any neat consensus that leaves your non-negotiables behind.', signal: 'Values · context · exceptions' },
  };
  let ecosystem = window.MentorEcosystem?.getState() || null;
  let day = window.MentorDay?.getState() || null;
  let current = null;
  let preparedEditor = '';
  let directoryQuery = '';
  const scrollPositions = new Map();
  const renderCache = new WeakMap();

  // Only replace changed derived content; leave live forms and legacy renderers alone.
  function region(selector, html) {
    const node = $(selector);
    if (!node || renderCache.get(node) === html) return;
    const active = node.contains(document.activeElement) ? document.activeElement : null;
    const identity = active && ['id', 'href', 'data-app-involve'].map((key) => [key, active.getAttribute(key)]).find(([, value]) => value);
    node.innerHTML = html;
    renderCache.set(node, html);
    if (identity) {
      const replacement = [...node.querySelectorAll('a, button, input, summary')].find((item) => item.getAttribute(identity[0]) === identity[1]);
      (replacement || node.closest('[data-app-view]')?.querySelector('h1'))?.focus({ preventScroll: true });
    }
  }

  const empty = (title, description, action = '') => `<div class="app-empty">${icon('spark')}<h3>${esc(title)}</h3><p>${esc(description)}</p>${action}</div>`;
  const loading = (label) => `<div class="app-loading" role="status"><span class="app-loading-line"></span><span class="app-loading-line"></span><p>${esc(label)}</p></div>`;
  const heading = (title, description, actions = '') => `<header class="app-page-heading"><div><h1 tabindex="-1">${title}</h1><p>${description}</p></div>${actions ? `<div class="app-heading-actions">${actions}</div>` : ''}</header>`;
  const back = (path, label) => `<a href="${esc(path)}" data-app-route class="app-back">${icon('arrow')}${esc(label)}</a>`;
  const page = (id, html) => `<section id="app-view-${id}" class="app-view" data-app-view="${id}" hidden>${html}</section>`;

  function mount() {
    const panel = $('#eco-panel');
    const live = {
      notice: $('#eco-notice'), playback: $('#eco-playback'), team: $('.eco-team'), create: $('#eco-create'),
      composer: $('.eco-council-composer'), discussion: $('#eco-discussion'), decision: $('#eco-decision'),
      sources: $('#eco-sources'), profile: $('.eco-profile-summary'), profileButton: $('#eco-open-profile'),
      memory: $('#eco-memory-section'), receipt: $('#eco-receipt-title').closest('.eco-media-section'),
      meal: $('#eco-meal-title').closest('.eco-media-section'), planner: $('#eco-day-panel'),
      mentorEditor: $('#eco-mentor-dialog'), profileEditor: $('#eco-profile-dialog'),
    };
    const fragment = document.createElement('div');
    fragment.innerHTML = [
      page('overview', heading('A little perspective.<br><span>A day that feels yours.</span>', 'Your mentors, your decisions, and a little room for what matters.', link(href('council'), 'Bring a question', 'eco-button eco-primary')) +
        '<div class="app-dashboard"><section class="app-schedule app-surface"><div class="app-section-title"><h2>Your day</h2>' + link(href('planner'), 'Open planner') + '</div><div id="app-day-preview"></div></section><section id="app-council-preview" class="app-council-preview"></section><section class="app-roster"><div class="app-section-title"><h2>In your corner</h2>' + link(href('mentors'), 'All mentors') + '</div><div id="app-roster-list" class="app-roster-list"></div></section><section class="app-next-tools"><div class="app-section-title"><h2>Start with something tangible</h2></div><div class="app-quick-tools">' +
        link(href('library/receipts'), `${icon('image')}<span><strong>Make sense of a receipt</strong><small>Review an image, then ask your council.</small></span>`, 'app-tool-shortcut app-coral') +
        link(href('library/meals'), `${icon('spark')}<span><strong>Picture your next meal</strong><small>Turn a meal idea into something to explore.</small></span>`, 'app-tool-shortcut app-teal') + '</div></section></div>'),
      page('mentors', heading('Your people. Your possibilities<span>.</span>', 'Find the right perspective, or make a mentor your own.', '<span id="app-create-slot"></span>') + '<div class="app-directory-toolbar"><label class="app-search" for="app-mentor-search">Find a mentor<input id="app-mentor-search" type="search" placeholder="Search by name, focus, or goal" autocomplete="off"></label><p id="app-directory-count" role="status"></p></div><div id="app-directory" class="app-directory"></div>'),
      page('detail', '<div id="app-mentor-detail"></div>'),
      page('studio', back(href('mentors'), 'My mentors') + heading('Mentor studio', 'Shape the perspective you want in your corner.') + '<div id="app-studio-status"></div><div id="app-studio-slot"></div>'),
      page('council', heading('Pull up a chair<span>.</span>', 'A question, a few perspectives, and a decision that stays yours.', link(href('council/review'), 'Review recommendation', 'eco-button eco-secondary')) + '<div class="app-council-layout"><aside id="app-council-team" class="app-council-team" aria-label="Choose your council"></aside><div id="app-council-workspace" class="app-council-workspace"></div></div>'),
      page('review', back(href('council'), 'Back to the conversation') + heading('Your decision', 'Review the recommendation, the trade-offs, and the alternatives.', link(href('library/sources'), 'See the sources', 'eco-button eco-secondary')) + '<div id="app-review-empty"></div><div id="app-review-slot"></div>'),
      page('planner', '<div id="app-planner-slot"></div>'),
      page('library', heading('A place to explore<span>.</span>', 'Bring an image or an idea. Take what you learn to your council.') + '<div class="app-tool-directory">' +
        `<article class="app-tool-card app-coral"><div class="app-tool-art">${icon('image')}</div><h2>Receipt & image analysis</h2><p>Understand a receipt or product photo, then attach the analysis to a council question.</p><p id="app-tool-vision" class="app-tool-availability"></p>${link(href('library/receipts'), 'Open image workspace', 'eco-button eco-secondary')}</article>` +
        `<article class="app-tool-card app-teal"><div class="app-tool-art">${icon('spark')}</div><h2>Meal imagination</h2><p>Visualise a meal idea, then explore ingredients, costs, and preferences with your council.</p><p id="app-tool-image" class="app-tool-availability"></p>${link(href('library/meals'), 'Open meal workspace', 'eco-button eco-secondary')}</article>` +
        `<article class="app-tool-card app-blue"><div class="app-tool-art">${icon('book')}</div><h2>Research sources</h2><p>Revisit the evidence returned with your council and planner recommendations.</p><p id="app-tool-sources" class="app-tool-availability"></p>${link(href('library/sources'), 'Browse the evidence', 'eco-button eco-secondary')}</article></div><p class="app-service-note">Configured services can still be unavailable. Availability and credit limits are confirmed only when a request runs.</p>`),
      page('receipts', back(href('library'), 'Creative tools') + heading('A closer look', 'Turn a receipt or product image into useful context.') + '<div class="app-tool-workspace"><div id="app-receipt-slot"></div><aside class="app-tool-guide"><h2>From image to perspective</h2><ol><li><strong>Choose an image</strong><p>Upload your own, or use the labelled synthetic sample.</p></li><li><strong>Review the analysis</strong><p>Check items, amounts, and any uncertainty against the original.</p></li><li><strong>Bring it to your council</strong><p>Attach the result and add the question you want to work through.</p></li></ol>' + link(href('council'), 'Go to your council') + '</aside></div>'),
      page('meals', back(href('library'), 'Creative tools') + heading('Make room for a new idea', 'Explore a meal visually, then bring the practical questions to your council.') + '<div class="app-tool-workspace"><div id="app-meal-slot"></div><aside class="app-tool-guide"><h2>Make the idea useful</h2><p>Include ingredients, dietary preferences, or the kind of meal you have in mind.</p><p>An AI image is an illustration. Research is a separate step for ingredients, costs, and suitability.</p>' + link(href('context'), 'Check your dietary preferences') + link(href('council'), 'Open your council') + '</aside></div>'),
      page('sources', back(href('library'), 'Creative tools') + heading('Follow the evidence', 'Original sources returned with your recommendations.') + '<div class="app-sources-grid"><section class="app-surface"><div class="app-section-title"><h2>Council research</h2>' + link(href('council/review'), 'Recommendation') + '</div><div id="app-sources-empty"></div><div id="app-sources-slot"></div></section><section class="app-surface"><div class="app-section-title"><h2>Planner research</h2>' + link(href('planner'), 'Your day') + '</div><div id="app-planner-sources"></div></section></div>'),
      page('context', heading('The context you share<span>.</span>', 'Your preferences and approved memory, available to your mentors.', '<span id="app-profile-button-slot"></span>') + '<div class="app-context-layout"><div id="app-context-profile" class="app-surface"></div><div id="app-context-memory" class="app-surface"></div></div><div class="app-context-footer">' + link(href('library/sources'), 'Explore recommendation sources') + '<span>Decisions can inform shared memory after you approve them.</span></div>'),
      page('profile', back(href('context'), 'Shared context') + heading('Your shared profile', 'Give your mentors the context you want them to use.') + '<div id="app-profile-status"></div><div id="app-profile-slot"></div>'),
      page('vision', `<div class="vision-page">
        <header class="vision-hero"><p class="vision-eyebrow">The thinking behind MentorOS</p><h1 tabindex="-1">Many perspectives.<br><span>Your decision.</span></h1><p class="vision-promise">A personal council that makes disagreement useful, grounds advice in evidence, and always returns the final choice to you.</p><a class="vision-scroll-cue" href="#vision-loop"><span>See how the council thinks</span>${icon('arrow')}</a><div class="vision-hero-orbits" aria-hidden="true"><span></span><span></span><span></span><i></i></div></header>
        <section id="vision-loop" class="vision-section" aria-labelledby="vision-loop-title"><div class="vision-section-copy"><p class="vision-kicker">01 · The living council</p><h2 id="vision-loop-title">One question becomes a richer decision.</h2><p>Each mentor sees the same situation through a different lens. Then they review one another—not four isolated answers, but one constructive exchange.</p></div>
          <div class="vision-council" data-selected-vision="health"><div class="vision-orbit" aria-label="Council thought loop"><svg class="vision-paths" viewBox="0 0 700 560" role="img" aria-labelledby="vision-path-title vision-path-desc"><title id="vision-path-title">The MentorOS council loop</title><desc id="vision-path-desc">Your question travels to four perspectives. Mentors exchange critiques, produce a synthesis that retains conflicts, and return a recommendation for your explicit approval.</desc><defs><marker id="vision-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0 10 5 0 10Z"/></marker></defs><path class="vision-ring" d="M350 90C500 90 610 180 610 285S500 480 350 480 90 390 90 285 200 90 350 90Z"/><path class="vision-flow" d="M350 278C250 230 185 160 170 115M350 278C450 230 515 160 530 115M350 278C250 330 185 385 170 442M350 278C450 330 515 385 530 442M185 115C325 45 470 60 530 115M530 115C650 230 650 340 530 442M530 442C385 510 300 510 170 442M170 442C55 330 55 230 170 115"/><path class="vision-outcome-path" d="M350 315V382 496" marker-end="url(#vision-arrow)"/><circle class="vision-pulse" r="6"><animateMotion dur="5.5s" repeatCount="indefinite" path="M350 278C250 230 185 160 170 115C325 45 470 60 530 115C650 230 650 340 530 442C385 510 300 510 170 442C55 330 55 230 170 115M170 115C240 190 300 230 350 278V382 496"/></circle></svg>
            <div class="vision-question"><small>Starts with you</small><strong>“What is the wisest next step?”</strong></div><button class="vision-mentor vision-health is-selected" type="button" data-vision-perspective="health" aria-pressed="true"><span>Health</span><strong>Mira</strong><small>Selected lens</small></button><button class="vision-mentor vision-finance" type="button" data-vision-perspective="finance" aria-pressed="false"><span>Finance</span><strong>Nadia</strong><small>Explore lens</small></button><button class="vision-mentor vision-career" type="button" data-vision-perspective="career" aria-pressed="false"><span>Career</span><strong>Atlas</strong><small>Explore lens</small></button><button class="vision-mentor vision-custom" type="button" data-vision-perspective="custom" aria-pressed="false"><span>Adaptable</span><strong>Your lens</strong><small>Explore lens</small></button><div class="vision-synthesis"><small>Mentors challenge one another</small><strong>Synthesis</strong><span>Conflicts + alternatives stay visible</span></div><div class="vision-owner"><span>${icon('check')}</span><div><small>Final state</small><strong>You review and decide</strong></div></div></div>
            <aside class="vision-perspective-detail" aria-live="polite"><p class="vision-detail-label">Selected perspective · <span id="vision-detail-signal">Energy · routine · sustainability</span></p><h3 id="vision-detail-name">Mira asks a health question</h3><blockquote id="vision-detail-question">“Can this choice support my energy and routines?”</blockquote><p id="vision-detail-contribution">Protects sleep, movement and sustainable habits—without treating wellbeing as the only priority.</p><div class="vision-peer-note"><span>Peer review</span><p id="vision-detail-challenge">Challenges the finance view when the cheapest option creates a routine you cannot maintain.</p></div></aside></div></section>
        <section class="vision-section vision-trust" aria-labelledby="vision-trust-title"><div class="vision-section-copy"><p class="vision-kicker">02 · Trust is part of the architecture</p><h2 id="vision-trust-title">Evidence informs. Boundaries hold. You approve.</h2><p>Select a stage to see who controls it. Every recommendation keeps provenance, uncertainty and alternatives close by.</p></div><div class="vision-trust-layout"><div class="vision-trust-flow" role="group" aria-label="Evidence to decision stages"><button type="button" class="vision-trust-step is-selected" data-trust-step="context" aria-pressed="true"><span>01</span><strong>Shared context</strong><small>You choose what to share</small></button><i></i><button type="button" class="vision-trust-step" data-trust-step="inputs" aria-pressed="false"><span>02</span><strong>Bounded inputs</strong><small>Tools + source evidence</small></button><i></i><button type="button" class="vision-trust-step" data-trust-step="reasoning" aria-pressed="false"><span>03</span><strong>Council reasoning</strong><small>Critique before synthesis</small></button><i></i><button type="button" class="vision-trust-step" data-trust-step="recommendation" aria-pressed="false"><span>04</span><strong>Recommendation</strong><small>Trade-offs survive</small></button><i></i><button type="button" class="vision-trust-step vision-human-step" data-trust-step="approval" aria-pressed="false"><span>05</span><strong>Your approval</strong><small>Nothing happens without it</small></button></div><aside class="vision-trust-detail" aria-live="polite"><span id="vision-trust-owner" class="vision-control-chip">Controlled by you</span><h3 id="vision-trust-heading">Context is invited, never assumed.</h3><p id="vision-trust-copy">Your council works from the profile, preferences and question you deliberately provide—not ambient surveillance.</p><ul id="vision-trust-list"><li>Review or edit shared context</li><li>Use only information relevant to this question</li></ul></aside></div><div class="vision-never"><span class="vision-never-mark">Never automatic</span><p><strong>MentorOS cannot book, purchase, send a message, or change your schedule on its own.</strong> A recommendation is an invitation to decide—not authority to act.</p></div></section>
        <section class="vision-cta" aria-labelledby="vision-cta-title"><div><p class="vision-kicker">The next question is yours</p><h2 id="vision-cta-title">Bring something real to the table.</h2><p>Choose your perspectives, inspect their reasoning, and keep the final word.</p></div><div class="vision-cta-actions">${link(href('council'), 'Open the Council', 'eco-button eco-primary')}${link(href('mentors'), 'Meet your mentors', 'eco-button eco-secondary')}</div></section>
      </div>`),
      page('not-found', heading('This page isn’t here.', 'The address may have changed, or this mentor may have been deleted.') + empty('Find your way back', 'Your workspace and mentor directory are still available.', link(root, 'Go to Overview', 'eco-button eco-primary') + link(href('mentors'), 'Browse mentors', 'eco-button eco-secondary'))),
    ].join('');
    // Extract live nodes before removing their old layout wrappers.
    const put = (slot, node) => fragment.querySelector(slot).append(node);
    put('#app-create-slot', live.create);
    put('#app-council-team', live.team);
    put('#app-council-workspace', live.composer);
    put('#app-council-workspace', live.discussion);
    put('#app-review-slot', live.decision);
    put('#app-sources-slot', live.sources);
    put('#app-context-profile', live.profile);
    put('#app-profile-button-slot', live.profileButton);
    put('#app-context-memory', live.memory);
    put('#app-receipt-slot', live.receipt);
    put('#app-meal-slot', live.meal);
    put('#app-planner-slot', live.planner);
    put('#app-studio-slot', live.mentorEditor);
    put('#app-profile-slot', live.profileEditor);
    for (const dialog of [live.mentorEditor, live.profileEditor]) {
      dialog.dataset.inline = 'true';
      dialog.setAttribute('role', 'region');
      dialog.removeAttribute('aria-modal');
      dialog.setAttribute('open', '');
      dialog.inert = true;
    }
    live.planner.hidden = false;
    live.planner.setAttribute('role', 'region');
    live.planner.removeAttribute('aria-labelledby');
    live.planner.setAttribute('aria-label', 'Daily planner and coaching');
    panel.replaceChildren(live.notice, ...fragment.children, live.playback);
    panel.removeAttribute('aria-labelledby');
    panel.removeAttribute('tabindex');
    panel.setAttribute('role', 'region');
    panel.setAttribute('aria-label', 'Your workspace');
    panel.hidden = false;
    $('#eco-team-title').textContent = 'At your table';
    $('#eco-council-title').textContent = 'What’s on your mind?';
    $('#eco-open-profile').innerHTML = `${icon('book')}Edit shared profile`;
    all('[data-app-view] h1').forEach((node) => { node.tabIndex = -1; });
    document.body.classList.add('app-mounted');
  }

  function resolve(path) {
    if (path === root) return { view: 'overview', title: 'Overview', nav: root };
    const fixed = {
      mentors: ['mentors', 'My mentors', 'mentors'], 'mentors/new': ['studio', 'Create a mentor', 'mentors'],
      council: ['council', 'Council', 'council'], 'council/review': ['review', 'Review recommendation', 'council'],
      planner: ['planner', 'Your day', 'planner'], library: ['library', 'Creative tools', 'library'],
      'library/receipts': ['receipts', 'Receipt & image analysis', 'library'], 'library/meals': ['meals', 'Meal imagination', 'library'],
      'library/sources': ['sources', 'Research sources', 'library'], context: ['context', 'Shared context', 'context'],
      profile: ['profile', 'Your shared profile', 'context'], vision: ['vision', 'Our vision', 'vision'],
    };
    const suffix = path.startsWith(root) ? path.slice(root.length) : '';
    if (Object.hasOwn(fixed, suffix)) {
      const [view, title, nav] = fixed[suffix];
      return { view, title, nav: href(nav), id: null };
    }
    const match = /^mentors\/([^/]+)(\/edit)?$/.exec(suffix);
    if (match) {
      try {
        const id = decodeURIComponent(match[1]);
        if (!id || id.includes('/') || id === 'new') return { view: 'not-found', title: 'Page not found' };
        return { view: match[2] ? 'studio' : 'detail', id, title: match[2] ? 'Edit mentor' : 'Mentor profile', nav: href('mentors') };
      } catch { /* A malformed identifier is a not-found page. */ }
    }
    return { view: 'not-found', title: 'Page not found' };
  }

  function canonical(value) {
    const url = new URL(value, location.origin);
    if (url.origin !== location.origin || !/^\/mentoros(?:\/|$)/.test(url.pathname)) return null;
    const path = url.pathname.replace(/\/+$/, '');
    return path === '/mentoros' || path === '/mentoros/dashboard' ? root : path;
  }

  function setMenu(open) {
    document.body.classList.toggle('app-menu-open', open);
    const button = $('#app-menu-toggle');
    button.setAttribute('aria-expanded', String(open));
    button.setAttribute('aria-label', open ? 'Close workspace navigation' : 'Open workspace navigation');
  }

  function route(path, { focus = true, restore = false } = {}) {
    const changed = current?.path !== path;
    if (changed && current) {
      scrollPositions.set(current.path, window.scrollY);
      if (current.view === 'studio' && preparedEditor === current.path) window.MentorEcosystem?.leaveEditor();
    }
    if (changed) preparedEditor = '';
    current = { ...resolve(path), path };
    if (changed) window.MentorEcosystem?.setContext(current.view === 'planner' ? 'planner' : path);
    document.body.dataset.appPage = current.view;
    document.body.dataset.ecoView = current.view === 'planner' ? 'day' : 'ecosystem';
    $('#eco-panel').hidden = false;
    $('#eco-day-panel').hidden = false;
    all('[data-app-view]').forEach((node) => { node.hidden = node.dataset.appView !== current.view; });
    all('.navigation [data-app-route]').forEach((node) => {
      const selected = node.getAttribute('href') === current.nav;
      node.classList.toggle('active', selected);
      if (selected) node.setAttribute('aria-current', 'page'); else node.removeAttribute('aria-current');
    });
    $('#app-breadcrumb').textContent = current.title;
    document.title = `MentorOS — ${current.title}`;
    setMenu(false);
    render();
    if (changed && focus) {
      const view = $(`[data-app-view="${current.view}"]`);
      (view.querySelector('h1') || $('#main')).focus({ preventScroll: true });
      window.scrollTo({ top: restore ? scrollPositions.get(path) || 0 : 0, behavior: 'instant' });
    }
  }

  function navigate(value, options = {}) {
    let path;
    try { path = canonical(value); } catch { return false; }
    if (!path) return false;
    if (location.pathname !== path || location.hash || location.search) {
      history[options.replace ? 'replaceState' : 'pushState'](null, '', path);
    }
    route(path, options);
    return true;
  }

  function selectVisionPerspective(key, focus = false) {
    const detail = visionPerspectives[key];
    if (!detail || !$('.vision-council')) return;
    $('.vision-council').dataset.selectedVision = key;
    all('[data-vision-perspective]').forEach((button) => {
      const selected = button.dataset.visionPerspective === key;
      button.classList.toggle('is-selected', selected);
      button.setAttribute('aria-pressed', String(selected));
      button.querySelector('small').textContent = selected ? 'Selected lens' : 'Explore lens';
      if (selected && focus) button.focus();
    });
    $('#vision-detail-signal').textContent = detail.signal;
    $('#vision-detail-name').textContent = `${detail.person} asks a ${detail.name.toLowerCase()} question`;
    $('#vision-detail-question').textContent = `“${detail.question}”`;
    $('#vision-detail-contribution').textContent = detail.contribution;
    $('#vision-detail-challenge').textContent = detail.challenge;
  }

  const trustDetails = {
    context: ['Controlled by you', 'Context is invited, never assumed.', 'Your council works from the profile, preferences and question you deliberately provide—not ambient surveillance.', ['Review or edit shared context', 'Use only information relevant to this question']],
    inputs: ['Bounded by permission', 'Tools retrieve; they do not decide.', 'Search, images and source evidence are scoped inputs. Mentors show what informed the recommendation and where uncertainty remains.', ['Source links stay inspectable', 'A tool result is evidence—not authority']],
    reasoning: ['Visible exchange', 'Perspectives challenge each other.', 'Mentors compare assumptions and point out conflicts before synthesis, so disagreement becomes useful instead of disappearing.', ['Peer critique is part of the record', 'Minority perspectives remain available']],
    recommendation: ['For your review', 'Synthesis does not erase the edges.', 'The recommendation carries its reasoning, alternatives and meaningful trade-offs forward for your inspection.', ['Conflicts remain named', 'Alternatives remain actionable']],
    approval: ['Only you can approve', 'The loop resolves with you.', 'Nothing becomes a decision until you explicitly review and approve it. You can also reject it or ask another question.', ['No booking, purchase or message', 'No schedule change occurs automatically']],
  };

  function selectTrustStep(key, focus = false) {
    const detail = trustDetails[key];
    if (!detail) return;
    all('[data-trust-step]').forEach((button) => {
      const selected = button.dataset.trustStep === key;
      button.classList.toggle('is-selected', selected);
      button.setAttribute('aria-pressed', String(selected));
      if (selected && focus) button.focus();
    });
    $('#vision-trust-owner').textContent = detail[0];
    $('#vision-trust-heading').textContent = detail[1];
    $('#vision-trust-copy').textContent = detail[2];
    $('#vision-trust-list').innerHTML = detail[3].map((item) => `<li>${esc(item)}</li>`).join('');
  }

  function dayPreview() {
    if (!day) return loading('Waiting for your planner. No schedule loaded yet.');
    const events = list(day.events).slice().sort((a, b) => String(a.start).localeCompare(String(b.start)));
    const date = /^\d{4}-\d{2}-\d{2}$/.test(day.day || '') ? new Intl.DateTimeFormat('en', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${day.day}T12:00:00Z`)) : day.day || 'Current schedule';
    const label = day.status === 'approved' ? 'Approved plan' : 'Current plan';
    return `<div class="app-day-meta"><span>${esc(date)}</span><span class="app-state ${day.status === 'approved' ? 'app-state-approved' : ''}">${label}</span></div><p class="app-provenance">Synthetic day · Dubai time · ${day.mode === 'replay' ? 'Scripted rehearsal' : 'Live coaching'}</p>` +
      (events.length ? `<ol class="app-agenda">${events.slice(0, 4).map((event) => `<li class="app-agenda-item app-event-${['health', 'personal', 'career'].includes(event.kind) ? event.kind : 'work'}"><div class="app-agenda-time">${esc(event.start)}<small>${esc(event.end)}</small></div><div><strong>${esc(event.title)}</strong><span>${esc(event.kind || 'Commitment')}${event.fixed ? ' · Fixed' : ''}</span></div>${event.fixed ? icon('lock') : ''}</li>`).join('')}</ol>${events.length > 4 ? link(href('planner'), `View all ${events.length} commitments`) : ''}` : empty('Some room in your day', 'No commitments are currently loaded into this plan.', link(href('planner'), 'Open your planner'))) +
      (day.proposal?.status === 'pending' ? `<div class="app-plan-pending">${icon('clock')}<span>A suggested plan is waiting for your review.</span>${link(href('planner'), 'Review')}</div>` : '');
  }

  function councilPreview() {
    if (!ecosystem) return `<div class="app-preview-inner"><h2>Your next perspective</h2>${loading('Waiting for your council state…')}</div>`;
    const run = ecosystem.run;
    if (!run) return `<div class="app-preview-inner"><span class="app-preview-mark">${icon('chat')}</span><h2>What could use<br>another perspective?</h2><p>Choose your mentors and bring one question to the table.</p>${link(href('council'), 'Start a conversation', 'eco-button app-button-white')}</div>`;
    const pending = run.status === 'pending';
    const savedSummary = run.decision?.summary || run.prompt;
    const preview = run.status === 'approved' ? savedSummary.replace(/^For your review:\s*/i, '') : savedSummary;
    const destination = run.decision ? href('council/review') : href('council');
    return `<div class="app-preview-inner"><span class="app-state app-state-inverse">${esc(statuses[run.status] || 'Council')}</span><h2>${esc(run.decision?.title || (run.status === 'failed' ? 'Let’s pick up from here.' : run.status === 'running' ? 'Perspectives in motion.' : 'Your council conversation'))}</h2><p>${esc(truncate(preview, 200))}</p>${run.error ? `<p class="app-preview-error">${esc(truncate(run.error, 150))}</p>` : ''}${link(destination, pending ? 'Review your recommendation' : run.decision ? 'Open the decision' : 'Open conversation', 'eco-button app-button-white')}<small>${pending ? 'Your approval is still needed.' : run.status === 'approved' ? 'Recommendation you approved · saved council.' : 'Based on the latest saved council.'}</small></div>`;
  }

  function mentorCard(mentor, compact = false) {
    const path = mentorPath(mentor.id);
    const portrait = `<span class="app-mentor-avatar" style="--mentor-accent:${accent(mentor.color)}" aria-hidden="true">${esc(initials(mentor.name))}</span>`;
    if (compact) return `<a href="${esc(path)}" data-app-route class="app-roster-item">${portrait}<span><strong>${esc(mentor.name)}</strong><small>${esc(mentor.domain)}</small></span>${icon('arrow')}</a>`;
    return `<article class="app-mentor-card" style="--mentor-accent:${accent(mentor.color)}"><div class="app-mentor-card-top">${portrait}<span class="app-mentor-domain">${esc(mentor.domain)}</span></div><h2><a href="${esc(path)}" data-app-route>${esc(mentor.name)}</a></h2><p>${esc(mentor.description)}</p><div class="app-mentor-tools">${list(mentor.tools).map((tool) => `<span>${esc(toolNames[tool] || tool)}</span>`).join('') || '<span>Conversation</span>'}</div><footer>${link(path, 'Meet your mentor')}${link(`${path}/edit`, 'Edit', 'app-edit-link')}</footer></article>`;
  }

  function renderDirectory() {
    const mentors = list(ecosystem?.mentors);
    const query = directoryQuery.toLowerCase().trim();
    const matches = mentors.filter((mentor) => [mentor.name, mentor.domain, mentor.description, ...list(mentor.goals)].join(' ').toLowerCase().includes(query));
    $('#app-directory-count').textContent = !ecosystem ? 'Loading mentors…' : query ? `${matches.length} of ${mentors.length} mentors` : `${mentors.length} ${mentors.length === 1 ? 'mentor' : 'mentors'} in your corner`;
    $('#app-directory').setAttribute('aria-busy', String(!ecosystem));
    region('#app-directory', !ecosystem ? loading('Connecting to your mentor directory…') : matches.length ? matches.map((mentor) => mentorCard(mentor)).join('') : query ? empty('No mentors match that search', 'Try a different name, focus, or goal.', '<button type="button" id="app-clear-search" class="eco-button eco-secondary">Clear search</button>') : empty('Make space for a new perspective', 'Create your first mentor, then shape their focus and tools.', link(href('mentors/new'), 'Create a mentor', 'eco-button eco-primary')));
  }

  function renderDetail() {
    const mentor = list(ecosystem?.mentors).find((item) => item.id === current.id);
    if (!ecosystem) {
      region('#app-mentor-detail', heading('Your mentor', 'Loading their focus and configuration…') + loading('Waiting for your mentor directory…'));
      return;
    }
    if (!mentor) {
      region('#app-mentor-detail', missingMentor());
      return;
    }
    const tools = list(mentor.tools);
    const permissions = ['search', 'vision', 'image'].map((tool) => {
      const allowed = tools.includes(tool);
      const destination = href(tool === 'search' ? 'library/sources' : tool === 'vision' ? 'library/receipts' : 'library/meals');
      return `<li><span>${icon(tool === 'search' ? 'book' : 'image')}${esc(toolNames[tool])}</span><span class="app-permission ${allowed ? 'app-permission-yes' : ''}">${allowed ? 'Allowed' : 'Not enabled'}</span>${allowed ? link(destination, tool === 'search' ? 'Sources' : 'Open', 'app-edit-link') : ''}</li>`;
    }).join('');
    region('#app-mentor-detail', back(href('mentors'), 'My mentors') + `<header class="app-mentor-hero"><span class="app-mentor-avatar app-avatar-large" style="--mentor-accent:${accent(mentor.color)}">${esc(initials(mentor.name))}</span><div><span class="app-detail-domain">${esc(mentor.domain)}</span><h1 tabindex="-1">${esc(mentor.name)}</h1><p>${esc(mentor.description)}</p></div><div class="app-detail-actions"><button type="button" class="eco-button eco-primary" data-app-involve="${esc(mentor.id)}" ${window.MentorEcosystem?.involveMentor ? '' : 'disabled'}>${icon('chat')}Bring to council</button>${link(`${mentorPath(mentor.id)}/edit`, 'Edit in studio', 'eco-button eco-secondary')}</div></header><div class="app-detail-grid"><div><section class="app-detail-section"><h2>What we’re working toward</h2>${list(mentor.goals).length ? `<ol class="app-goal-list">${mentor.goals.map((goal) => `<li>${esc(goal)}</li>`).join('')}</ol>` : '<p class="app-muted">No goals set for this mentor yet.</p>'}</section><section class="app-detail-section"><h2>How this mentor thinks</h2><p class="app-instructions">${esc(mentor.instructions || 'No custom instructions saved.')}</p></section></div><aside class="app-surface app-permissions"><h2>Tools & permissions</h2><ul>${permissions}</ul><p>Tool permissions guide what this mentor may use. Service availability is separate.</p><div class="app-voice-choice">${icon('volume')}<span><strong>AI voice</strong><small>${mentor.voice === 'career' ? 'Atlas · career voice' : 'Mira · health voice'}</small></span></div>${link(href('context'), 'View the context they share')}</aside></div>`);
  }

  function missingMentor() {
    return heading('Mentor not found', 'This mentor may have been removed or the address may be incorrect.') + empty('Your other mentors are still here', 'Open the directory to choose a mentor or create a new one.', link(href('mentors'), 'Back to My mentors', 'eco-button eco-primary'));
  }

  function prepareEditor() {
    const profile = current.view === 'profile';
    const dialog = $(profile ? '#eco-profile-dialog' : '#eco-mentor-dialog');
    const status = profile ? '#app-profile-status' : '#app-studio-status';
    const bridge = window.MentorEcosystem;
    const invalid = !profile && ecosystem && current.id && !list(ecosystem.mentors).some((mentor) => mentor.id === current.id);
    dialog.hidden = !ecosystem || Boolean(invalid);
    if (invalid) { dialog.inert = true; region(status, missingMentor()); return; }
    if (!ecosystem || !(profile ? bridge?.prepareProfile : bridge?.prepareMentor)) {
      dialog.inert = true;
      dialog.hidden = true;
      region(status, loading('Waiting for your saved workspace before opening the editor…'));
      return;
    }
    region(status, '');
    if (preparedEditor !== current.path) {
      const prepared = profile ? bridge.prepareProfile() : bridge.prepareMentor(current.id || undefined);
      if (prepared === false) {
        dialog.inert = true;
        dialog.hidden = true;
        region(status, loading('Waiting for your saved workspace before opening the editor…'));
        return;
      }
      preparedEditor = current.path;
    }
    dialog.inert = false;
    dialog.hidden = false;
    dialog.setAttribute('open', '');
    if (!profile) {
      const backLink = $('#app-view-studio > .app-back');
      backLink.href = current.id ? mentorPath(current.id) : href('mentors');
      backLink.innerHTML = `${icon('arrow')}${current.id ? 'Back to mentor' : 'My mentors'}`;
    }
  }

  function plannerSources() {
    if (!day) return loading('Waiting for planner sources…');
    const sources = list(day.proposal?.sources);
    const intro = `<p class="app-provenance">${day.mode === 'replay' ? 'Scripted rehearsal · these are the sources returned with that plan.' : 'Sources returned with the latest planner recommendation.'}</p>`;
    return intro + (sources.length ? `<ol class="app-source-list">${sources.map((source) => {
      let url;
      try { const parsed = new URL(source.url); if (['https:', 'http:'].includes(parsed.protocol) && !parsed.username && !parsed.password) url = parsed.href; } catch { /* Render unavailable links as text. */ }
      return `<li>${url ? `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(source.title || new URL(url).hostname)}${icon('external')}</a>` : `<strong>${esc(source.title || 'Source')} · link unavailable</strong>`}${source.snippet ? `<p>${esc(source.snippet)}</p>` : ''}${source.address ? `<small>${esc(source.address)}</small>` : ''}</li>`;
    }).join('')}</ol>` : empty('No planner sources yet', 'Sources will appear here when returned with a plan.'));
  }

  function render() {
    if (!current) return;
    $('#app-workspace-status').textContent = ecosystem ? 'Workspace loaded' : 'Connecting to workspace';
    $('#app-review-dot').hidden = ecosystem?.run?.status !== 'pending';
    if (current.view === 'overview') {
      region('#app-day-preview', dayPreview());
      region('#app-council-preview', councilPreview());
      region('#app-roster-list', !ecosystem ? loading('Loading your mentors…') : ecosystem.mentors.length ? ecosystem.mentors.slice(0, 4).map((mentor) => mentorCard(mentor, true)).join('') : empty('Meet your first mentor', 'Create a mentor with the perspective you need.', link(href('mentors/new'), 'Create a mentor')));
    }
    if (current.view === 'mentors') renderDirectory();
    if (current.view === 'detail') renderDetail();
    if (['studio', 'profile'].includes(current.view)) prepareEditor();
    if (current.view === 'review') region('#app-review-empty', !ecosystem ? loading('Loading your latest recommendation…') : ecosystem.run?.decision ? '' : empty(ecosystem.run?.status === 'running' ? 'Your council is still talking' : ecosystem.run?.status === 'failed' ? 'No decision was returned' : 'A decision starts with a question', ecosystem.run?.status === 'failed' ? ecosystem.run.error || 'Review the council conversation for the latest service response.' : 'The exact recommendation and approval controls will appear here when your council returns a decision.', link(href('council'), 'Open the conversation', 'eco-button eco-primary')));
    if (current.view === 'library') {
      for (const tool of ['vision', 'image']) region(`#app-tool-${tool}`, !ecosystem ? 'Checking configuration…' : ecosystem.capabilities?.[tool] ? (tool === 'image' && ecosystem.imageGeneration ? `${esc(ecosystem.imageGeneration.model)} · ${esc(ecosystem.imageGeneration.quality)} quality · configured` : 'Service configured · availability may vary') : 'Service not configured');
      const count = list(ecosystem?.run?.sources).length + list(day?.proposal?.sources).length;
      region('#app-tool-sources', !ecosystem && !day ? 'Waiting for source state…' : `${count} ${count === 1 ? 'source' : 'sources'} in loaded recommendations`);
    }
    if (current.view === 'sources') {
      region('#app-sources-empty', !ecosystem ? loading('Waiting for council sources…') : list(ecosystem.run?.sources).length ? '' : empty('No council sources yet', 'Research returned by your mentors will appear here.'));
      region('#app-planner-sources', plannerSources());
    }
  }

  const legacyPaths = { '#ecosystem': root, '#planner': href('planner'), '#conversation': href('planner'), '#memory': href('context'), '#eco-discussion': href('council'), '#eco-decision': href('council/review'), '#eco-memory-section': href('context'), '#eco-sources': href('library/sources') };
  mount();
  window.MentorApp = Object.freeze({ navigate, getPath: () => current?.path || canonical(location.pathname) || location.pathname });
  document.addEventListener('click', (event) => {
    const target = event.target.closest?.('a, button');
    if (!target || target.disabled) return;
    const routeLink = target.closest('[data-app-route]');
    const legacyPath = target.matches('a') ? legacyPaths[target.getAttribute('href')] : null;
    if (routeLink || legacyPath) {
      // Preserve real links for keyboard/new-tab navigation; old page handlers never own these clicks.
      event.stopImmediatePropagation();
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || target.target === '_blank') return;
      event.preventDefault();
      navigate(legacyPath || routeLink.getAttribute('href'));
    }
    if (target.hasAttribute('data-app-involve')) {
      event.preventDefault();
      window.MentorEcosystem?.involveMentor(target.dataset.appInvolve);
      navigate(href('council'));
    }
    if (target.id === 'app-menu-toggle') setMenu(!document.body.classList.contains('app-menu-open'));
    if (target.id === 'app-clear-search') {
      directoryQuery = ''; $('#app-mentor-search').value = ''; renderDirectory(); $('#app-mentor-search').focus();
    }
    if (target.hasAttribute('data-vision-perspective')) selectVisionPerspective(target.dataset.visionPerspective);
    if (target.hasAttribute('data-trust-step')) selectTrustStep(target.dataset.trustStep);
  }, true);
  $('#app-mentor-search').addEventListener('input', (event) => { directoryQuery = event.target.value; renderDirectory(); });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && document.body.classList.contains('app-menu-open')) { setMenu(false); $('#app-menu-toggle').focus(); }
    const perspective = event.target.closest?.('[data-vision-perspective]');
    const trustStep = event.target.closest?.('[data-trust-step]');
    const active = perspective || trustStep;
    if (active && ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();
      const buttons = all(perspective ? '[data-vision-perspective]' : '[data-trust-step]');
      let index = buttons.indexOf(active);
      if (event.key === 'Home') index = 0;
      else if (event.key === 'End') index = buttons.length - 1;
      else index = (index + (['ArrowRight', 'ArrowDown'].includes(event.key) ? 1 : -1) + buttons.length) % buttons.length;
      if (perspective) selectVisionPerspective(buttons[index].dataset.visionPerspective, true);
      else selectTrustStep(buttons[index].dataset.trustStep, true);
    }
  });
  window.addEventListener('popstate', () => route(canonical(location.pathname) || location.pathname, { restore: true }));
  window.addEventListener('hashchange', () => {
    if (legacyPaths[location.hash]) navigate(legacyPaths[location.hash], { replace: true });
  });
  window.addEventListener('mentoros:ecosystem', (event) => {
    ecosystem = event.detail || window.MentorEcosystem?.getState() || null;
    render();
  });
  window.addEventListener('mentoros:day', (event) => {
    day = event.detail || window.MentorDay?.getState() || null;
    render();
  });
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  const initialPath = legacyPaths[location.hash] || canonical(location.pathname) || location.pathname;
  history.replaceState(null, '', initialPath);
  route(initialPath, { focus: false });
})();
