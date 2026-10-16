# Source Policy

## Principle

Use the strongest available evidence and let users inspect it.

## Suggested source hierarchy

### Tier 1 — Primary authoritative records

Examples:
- COMELEC documents
- official government agency records
- Congress/Senate legislative records
- court/tribunal decisions and dockets where publicly available
- Office of the Ombudsman/public disclosure records
- official local-government records
- official gazettes and government publications

Preferred whenever available.

### Tier 2 — Direct attributed material

Examples:
- official candidate/party websites
- verified official public statements
- speeches
- interviews
- press releases

Useful for what a person or organization says about itself.

### Tier 3 — Established secondary reporting

Used to:
- identify events
- add context
- corroborate
- locate primary records

Secondary reporting should not replace primary records when primary records are readily available.

### Tier 4 — Other sources

Academic, NGO, watchdog, archive, or specialist sources may be valuable depending on methodology and transparency.

## Election records

Election metadata (date, status, contested offices) and every election participation status
follow this order of preference:

1. **COMELEC**: resolutions, the election calendar, certified lists of candidates, filing records,
   withdrawal and disqualification resolutions, canvass and proclamation records.
2. **Other official election records**: provincial, city and municipal election offices; boards
   of canvassers; the electoral tribunals (PET, SET, HRET) and courts for contested results.
3. **Official Gazette and other government publications**, for laws and proclamations that fix
   election dates or create offices.
4. **The candidate's or party's own statement**, only for what they say about themselves (for
   example a declared intention to run). Such a claim is `SELF_DECLARED` and labelled as such.
5. **Reputable secondary reporting**, to corroborate, to give context, or to find the primary
   record. On its own it supports at most `REPORTED`.

What each participation status needs:

| Status | Minimum evidence |
|---|---|
| Potential aspirant | Reporting (`REPORTED`). Must not be presented as a declaration |
| Publicly declared aspirant | The person's own public statement, or reporting of it with a quote |
| Filed certificate of candidacy | A COMELEC or filing-office record of the filing; reporting alone is `REPORTED` |
| Official candidate | An official COMELEC list of candidates. Nothing else |
| Withdrawn | A withdrawal record, or the person's own statement (self-declared) |
| Disqualified | A COMELEC or court resolution, with its number |
| Elected / Not elected | Proclamation or canvass records |

Never infer one status from another: a filing is not an official candidacy, a declaration is not a
filing, and a news report that someone "will run" is not a declaration. Each status is a separate
claim with its own evidence (`docs/ELECTION_INFORMATION_MODEL.md`).

## Wikipedia

Wikipedia can be used as a discovery aid, not as the preferred evidence for sensitive political claims.

Follow its citations to stronger sources.

## Social media

Use only for claims about what the account itself publicly stated, and only when identity/authenticity is sufficiently established.

Do not treat social posts as proof of unrelated factual allegations.

## Required source fields

- title
- publisher
- URL or document identifier
- source type
- publication date if known
- retrieval date
- archive URL when practical

## Broken links

A broken URL should not automatically delete a historical claim.

Retain:
- metadata
- archive link if available
- verification history

Flag the source for review.
