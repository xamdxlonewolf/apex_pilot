# Design Spec body fragments recovered from transcript tool results
Source transcript: `bc-c51cf5ab-4ead-4081-a5ac-ad87cf3a10a4/transcript.json`
Successful read path(s):
- `C:\Users\mikec\Documents\programming\obsidian_vault\programming\Apex Pilot Desktop Design Spec.txt`

Note: `read_file` returned truncated windows despite `totalLines=8497`; only these fragments appear in tool results.
Shell `Get-Content` was used only for `Measure-Object -Line` (92946 bytes / 4370 lines); no body dump.

---

## Fragment (doc-order key=0, msg[54] read_file)

# Apex Pilot UI Design Specification
Version: 1.0 (Draft)
Status: Living Document

---

# 1. Purpose

This document defines the visual language, interaction patterns, layout system, and user experience standards for Apex Pilot.

It is the authoritative source for all desktop UI implementation.

Its purpose is to ensure every screen, component, workflow, and interaction follows a consistent design language while maintaining the core principles of Apex Pilot.

This specification intentionally focuses on user experience and interface implementation.

It does not define backend architecture, SQL execution logic, MCP implementation, Oracle integration, or AI prompt engineering.

---

# 2. Design Philosophy

Apex Pilot is not a dashboard.

It is not a web application.

It is not a SaaS product.

It is a professional desktop development environment.

The user should immediately recognize similarities to tools such as:

- JetBrains IDEs
- Visual Studio Code
- DataGrip
- SQL Developer
- DBeaver
- Postman

The application should feel like software intended to be used for eight hours a day.

Every decision in this specification supports that goal.

---

# 3. Core Principles

## 3.1 Developer First

The interface always prioritizes speed over decoration.

---

## Fragment (doc-order key=7, msg[56] read_file)

# 7. Figure References

This specification references two conceptual mockups.

Figure 1

Overall Mission Control layout.

This image establishes:

- Window composition
- Panel hierarchy
- Density
- Visual style
- Overall proportions

Figure 2

Annotated layout with enlarged component references.

This image clarifies:

- Conversation workspace
- Inspector
- MCP Activity
- Primary interaction zones

These images are conceptual references.

They define design intent rather than pixel-perfect implementation.

---

# 8. Product Identity

Apex Pilot should communicate one central idea.

The AI is not the product.

The AI is the navigator.

SQLcl performs execution.

Oracle Database performs work.

Apex Pilot orchestrates the workflow.

This distinction should influence every interaction.

The interface should continually reinforce that the user remains in control.

---
