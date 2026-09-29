# Data Governance & Regulatory Policy

This document defines the lifecycle, verification guidelines, and governance workflows for maintaining the drone compliance databases.

---

## 1. Defining Official Sources

Only documents matching the following criteria qualify as official legal sources for the database:
1. **Primary Statutes**: Gazetted Acts enacted by the Parliament of Nepal (e.g. CAAN Act 2053).
2. **Technical Requirements**: Formally signed Requirements Directives issued by the CAAN Director General (e.g. UASR Issue 01).
3. **Security Procedures**: Formally stamped procedures published by the Ministry of Home Affairs Secretariat (e.g. RPA Working Procedure 2075).
4. **Site-specific Rules**: Notices published directly on `.gov.np` domains by the official custodian department (e.g. Sagarmatha National Park Office).

*Any secondary guides, tourism blogs, or travel agent lists do NOT qualify as authoritative and must be marked as advisory/low-confidence.*

---

## 2. Regulatory Review Workflow

Before a rule or coordinate is updated in `/data/`, it must advance through the lifecycle:

```
[Extracted] -> [Parsed] -> [Reviewed] -> [Verified] -> [Published] -> [Deprecated]
```

1. **Extracted**: The legal paragraph or coordinate is copied to the `knowledge/documents/` folder. Provenance metadata (page, paragraph, checksum) is generated.
2. **Parsed**: The text is translated to a structured condition block in the JSON DSL format.
3. **Reviewed**: A peer developer/legal analyst compares the DSL condition block against the original text source to ensure intent matches.
4. **Verified**: The rule is run against the automated scenario test runner (`tests/generate_scenarios.ts`) to verify there are no engine crashes or conflicts.
5. **Published**: The rules are tagged `Published` in `rules.json`, incrementing the database semantic version (e.g., from `1.0.0` to `1.1.0`).

---

## 3. Resolving Conflicts
When legal requirements from different agencies conflict:
- **Precedence Hierarchy**: Federal aviation laws (CAAN) and security directives (MoHA) take precedence over local or provincial guidelines.
- **Strictest Rule Standard**: If two valid authorities overlap in scope and disagree on thresholds, the engine resolves to the **stricter constraint** (e.g. if CAAN allows flight up to 100m, but a National Park restricts it to 50m, the limit resolves to 50m).
