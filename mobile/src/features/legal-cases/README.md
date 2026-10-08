# legal-cases

Reserved for Milestone 4 (sensitive public records). Do not add UI here until the editorial workflow (Milestone 3) is in place.

The domain model (`LegalCaseRecord`) and its row schema already exist. Rules:

- Show procedural status only (`COMPLAINT`, `CHARGED`, `DISMISSED`, `CONVICTED`, ...). Never collapse it into a boolean such as "has criminal record".
- Never present an allegation as guilt.
- An empty list must never be shown as "no cases" or "clean record".
