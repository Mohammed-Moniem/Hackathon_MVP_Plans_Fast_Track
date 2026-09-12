# Voice verification

## Browser playback check — approximately 13:52 Dubai

The coordinator clicked **Listen · AI voice** on the actual pending Dubai Marina follow-up. The interface transitioned to **Mira · AI-generated voice**, displayed the exact dynamic proposal speech as captions, and offered **Stop**. Clicking Stop removed the playback panel. No playback error was shown. This exercises the browser-to-server speech generation path with the live proposal, in addition to the earlier API round trip. Physical microphone capture and subjective audio quality still require the presenter’s check.

PASS — 2026-09-12T09:02:41.330Z

One live TTS request and one live transcription request through the local server at http://127.0.0.1:3210; no retries. The server reused the existing project OpenAI credential.

- Input: "Hello, I am Mira, your health coach."
- TTS: HTTP 200; gpt-4o-mini-tts, health coach / coral; audio/mpeg; 55296 bytes; 3025 ms.
- Audio: ../artifacts/voice-check.mp3; MP3 signature verified.
- SHA-256: a84c8da613e65f53cc0121274dbbe6b34037fb0b02e25389c961d3ed058e7852
- Transcription: HTTP 200; gpt-4o-mini-transcribe; 2363 ms.
- Returned text: "Hello, I am Mira, your health coach."
- Input/transcript match ignoring punctuation and case: yes.

This verifies the live server audio round trip. Models are reported from the existing configuration and provider defaults. Microphone capture and subjective listening quality were not tested. Provider code was unchanged; Exa was not tested. No credentials or raw error payloads are recorded.

## Exa direct provider verification

PASS — 2026-09-12T09:10:31.532Z

Called searchWeb("official TOGAF study resources") directly, with no area argument. Exactly one native fetch POST to Exa /search; HTTP 200; 1437 ms; 15-second deadline; no retries. Existing .env.local credential reused.

Returned 5 sources (5 on opengroup.org or its subdomains). All URLs use HTTP(S); every excerpt is at most 1,000 characters.

1. [TOGAF Certification Portfolio Study Materials](<https://shop.opengroup.org/study-materials/togaf>)
2. [TOGAF Standard](<https://www.opengroup.org/togaf>)
3. [Where Can I Find Study Materials for the TOGAF Standard ...](<https://help.opengroup.org/hc/en-us/articles/14728008055057-Where-Can-I-Find-Study-Materials-for-the-TOGAF-Standard-10th-Edition>)
4. [TOGAF® Library](<https://www.opengroup.org/togaf%C2%AE-library>)
5. [TOGAF® Enterprise Architecture Foundation Study Guide (PDF)](<https://shop.opengroup.org/b230>)

This follow-on verifies Exa retrieval, which was outside the earlier voice check. No provider code edits, credential output, source-page requests or additional search calls.
