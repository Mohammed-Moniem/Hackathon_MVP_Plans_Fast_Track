# MentorOS application correction — candidate 003

The user explicitly rejected the single long ecosystem feature page. Correct the existing capabilities into a coherent, routed application before continuing progress/goals/check-ins. Preserve backend, saved data, API integrations, colors/fonts and accepted procurement app. Progress work is paused in .verification/paused-progress; do not integrate it.

## Information architecture

Permanent sidebar: Overview, My mentors, Council, Your day, Creative tools, Shared context. Real browser paths/history, deep links and back/forward (not page-section anchors masquerading as pages). Root /mentoros/ shows Overview. Routes /mentoros/mentors, /mentoros/mentors/new, /mentoros/mentors/:id, /mentoros/mentors/:id/edit, /mentoros/council, /mentoros/council/review, /mentoros/planner, /mentoros/library, /mentoros/library/receipts, /mentoros/library/meals, /mentoros/library/sources, /mentoros/context, /mentoros/profile. Unknown routes show a useful not-found page with Overview link.

Overview is a useful dashboard of actual data: today's approved/planned schedule preview with clear synthetic provenance, current recommendation needing review, mentor roster, and next-action links. No fake statistics or progress. Directory focuses on discovering/viewing/creating/editing mentors. Mentor detail shows goals/instructions/tool permissions and purposeful actions to involve that mentor in a council or use its tools. Studio is a dedicated page with AI assistant + configuration, not a modal feature pile.

Council is a focused conversation workspace: select 2–4 mentors compactly, compose prompt/voice, actual conversation with clear from/to/phase, expandable long messages and tool attachments, prominent review link. Exact final decision/approval/conflicts/alternatives live on Review page. Tools have dedicated receipt and meal workspaces; results can be attached/searched with the council. Sources remain actual retrieved evidence. Profile is an editable page. Shared context shows shared financial preferences and approved memory, with profile edit and sources routes. Daily planner retains its working approved calendar and coaching.

Use genuine content, source indicators, compact hierarchy, linked cards and purposeful empty/error/loading states. Saturated cobalt/teal/coral, existing Space Grotesk+Manrope. Responsive390 and keyboard journey. No giant prose wall. Never imply key configuration verifies credits; prior OpenAI credit exhaustion is unresolved. No new paid calls.

## Ownership and bridge

Coordinator owns web/mentoros/ecosystem.js, app.js bridges, src/server.ts route fallback/tests, backend preservation. UI builder owns ONLY web/mentoros/app-shell.js, app-shell.css, index.html. New scripts/styles use ABSOLUTE /mentoros/ paths so deep-link refresh works. Preserve every existing DOM id needed by legacy scripts; do not duplicate forms/IDs. New shell can reparent existing live nodes into named route sections, replacing old wrappers/nav. Keep old tab nodes hidden for compatibility. New script loads after existing app/ecosystem scripts (defer).

Coordinator exposes window.MentorEcosystem:
- getState():clonedstate|null; getSelectedIds():string[]; refresh():Promise<void>
- prepareMentor(id?): populate existing #eco-mentor-dialog editor without navigation (emptyidnew); prepareProfile():populate #eco-profile-dialog.
- setContext(view): view='planner' or anyecosystemroute; only sets source context and stops recordings/playback, does not show/hide panels.
- involveMentor(id): ensure selectedsetcontainsid (keepmax4) andrerenderselector; shellnavigatescouncil.
- leaveEditor(): cancelsinflightAIdraft, incrementseditorrevision (protectmanualedits).
State events window `mentoros:ecosystem` and `mentoros:day` with detail nextstate. Day bridge window.MentorDay.getState() actualsnapshot. Shell must tolerate initialnull and rerender when events arrive WITHOUT overwriting open forms on polls.

Shell exposes window.MentorApp.navigate(path,{replace?,focus?}?) and getPath(). Paths canonical /mentoros/... . Shell calls prepareMentor/Profile when entering editor once state is loaded; repeatedstate events must notresetdraft. Actual existing Create/Edit handlers navigate to new/edit pages; successfulsave routesdetail; cancelroutesdetail/directory; profileSave/Cancel contextpage. These are parent patches. Existing #eco-mentor-dialog and #eco-profile-dialog remain same DOM nodes but shell presents them as fullpage nonmodal editor regions (open attribute, role=region, data-inline=true, CSSpositionstatic etc). No showModal or nativeclose forinline byparent. Top closecontrol becomesBacklinkorcancelbutton. Hiddenrouteparent hideseditor. Parentcancelsdraftwhenleavingviawindow.MentorEcosystem.leaveEditor. Preserveforminputs/handlers.

Existing #eco-team (class .eco-team) used ONLY asCouncilteamselector; directoryhasnewowncardsrenderedfromstate. Move #eco-create intoMymentorspageheader. Existing #eco-council-composer, #eco-discussion ->Council; #eco-decision ->Review. #eco-review-jump parentroutesReview. #eco-sources ->sourcespage; .eco-profile-summary and #eco-memory-section ->Context. .eco-media-section identifiedby#eco-receipt-title/#eco-meal-title ->theirpages. #eco-playback outsideindividualroutes/globalaudioarea soexistingvoicecontrolsvisible. #eco-notice shouldbeavailableglobally. Existing #eco-day-panel whole ->plannerroute. All originalecosections need an .eco styling ancestor evenafterreparenting.

Original ecosystemview only setContext tochoosecorrectsource behavior. Shell ownsnav via capture handling on data-app-route links; updateactivearia-current; don't let oldhandlers toggle legacypanels. New nav hrefs actualroutes, no data-action=sources (old delegatedsourcehandlerwouldopenwrongdialog). Alloriginalin-app hashlinks mapped byshell/parent (eco reviewjump, receiptattach/ingredientsearch goCouncil).

State-driven dashboard/details/directory rendering should preservefocus andnotrepaintunchangedhtml. Studio deep-link invalidmentor =>notfound/editornever silentlycreates. Routes preserve draft whileviewunchanged; show back/next workflows. SingleURLcanusevanilla JSrouterwithinexistingstack; noframeworkmigrationneeded.
