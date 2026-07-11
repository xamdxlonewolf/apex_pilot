## Parent

Part of #25 (Spec: Apex Pilot desktop UI overhaul — Mission Control).

## What to build

Center Mission replaces Chat. The composer is present before Agent Core with send disabled and honest Stub treatment so Agent Core can attach later without chat-app framing.

## Acceptance criteria

- [ ] Center primary surface is Mission (not Chat product framing)
- [ ] Mission composer is present; send is disabled with Stub treatment
- [ ] No fake agent success or mock streaming on this surface
- [ ] Vitest asserts Mission region, Stub treatment, and disabled send

## Blocked by

- PLACEHOLDER_BLOCKERS
