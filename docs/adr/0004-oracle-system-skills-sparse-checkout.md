# ADR-0004: Oracle System Skills Sparse Checkout

## Status

Accepted

## Date

2026-06-16

## Context

Apex Pilot will rely on Oracle and Oracle APEX domain skills for intelligence,
validation, transformation, and generation. The upstream source for Oracle
skills is `https://github.com/oracle/skills.git`, but Apex Pilot only needs the
Oracle database and APEX skill families for the initial product scope.

The project also needs traceability, update history, rollback support, and a
clean boundary between upstream system skills and local extensions.

## Decision Drivers

- Install only the upstream skill content needed for the product.
- Keep system skill behavior traceable to an upstream commit.
- Support auto-update from upstream while retaining rollback metadata.
- Avoid editing installed upstream checkout files directly.
- Let user skills extend behavior without replacing trusted system actions or
  safety policy.

## Considered Options

### Option 1: Sparse Checkout of `apex/` and `db/`

- Pros: Minimal installed surface, clear source of truth, and straightforward
  update tracking.
- Cons: Requires installer logic for sparse checkout, snapshots, and rollback
  metadata.

### Option 2: Clone the Entire Upstream Repository

- Pros: Simpler git operation.
- Cons: Installs unrelated skills and broadens the trusted system surface.

### Option 3: Vendor Skill Files Into This Repository

- Pros: Simple review of current contents.
- Cons: Makes upstream updates and rollback history harder to manage and risks
  local edits diverging from upstream.

## Decision

Apex Pilot will install system skills from
`https://github.com/oracle/skills.git` using sparse checkout of only `apex/` and
`db/`. Installed system skills track upstream `main`, record installed commits,
snapshot previous versions, expose update history, and support rollback metadata.

Installed upstream checkout files must not be edited directly. If Apex Pilot
needs additional manifest data, it will create adapter manifests or metadata
alongside the sparse checkout.

## Consequences

### Positive

- The trusted system skill surface is narrow and explicit.
- Updates are traceable and reversible.
- Upstream content remains cleanly separated from Apex Pilot adapters.
- User extensions can be additive without replacing core system behavior.

### Negative

- The skill installer needs git sparse-checkout test coverage.
- Auto-update and rollback behavior must be designed before the runtime depends
  on it.
- Adapter manifests may be required if upstream formats differ from Apex Pilot
  runtime expectations.

### Risks

- User skills could appear to override system behavior.
- Mitigation: same-name user skills are additive add-ons only. They may
  contribute templates, examples, prompts, validation rules, or extra actions,
  but cannot override core system skill actions or safety policy.

## Implementation Notes

- Store installed system skills under a local system skills directory.
- Track installed commit, update history, previous-version snapshots, and
  rollback metadata.
- Add tests with a fake git repository.
- Prove only `apex/` and `db/` are checked out.
- Add explicit Node and Python adapters.
- Do not execute arbitrary manifest-declared programs by default.

## Related Decisions

- [ADR-0003](0003-guarded-agent-and-skill-boundaries.md)
