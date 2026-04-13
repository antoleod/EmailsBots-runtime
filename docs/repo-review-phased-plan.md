# Repository review and phased refactor plan

## What is in the repository today

The repository is currently centered around a single generated artifact:

- `emailsbots.bundle.js`

From commit history and diff inspection, the bundle internally contains logical modules such as:

- `utils.js`
- `servicenow.js`
- `templates.js`
- `ui.js`
- `core.js`
- `entry.js`

This means the code already has modular concepts, but they are flattened into one shipped bundle in the repository.

## Current strengths

- Clear functional split inside the bundle
- Good early effort to isolate ServiceNow access, template logic, UI injection, and bootstrap logic
- Useful base for email generation from ticket context
- Existing preview/popup extraction flow for `requested_for`

## Main risks found

### 1. Source of truth is the bundle
Working directly in the generated bundle makes large feature work fragile, hard to review, and hard to maintain.

### 2. Tight coupling to fragile selectors
Several behaviors depend on very specific DOM ids and popup structures, especially around preview extraction and ServiceNow field reads.

### 3. Limited context hydration
The current flow mainly reads:

- `number`
- `short_description`
- `description`
- `cmdb_ci`
- previewed user fields

This is not enough for richer email, reminder, agenda, and custom action workflows.

### 4. UI configuration is not yet a platform
The current button injection is simple and works as a feature, but it is not yet a configurable assistant shell with settings, ordering, visibility, theme tokens, custom links, and custom actions.

### 5. No clean extension point
Requested features such as settings, work-note quick insert, smart reminders, deep links, agenda fixes, and custom buttons will become expensive if implemented directly inside the bundle without extracting source files.

## Recommended PR strategy

### PR 1 — source extraction scaffold
Goal: make future changes safe.

Create a source layout such as:

```text
src/
  core/
    bootstrap.js
    runtime.js
  services/
    servicenow.js
    context.js
    storage.js
  templates/
    email-templates.js
    reminder-templates.js
    worknote-templates.js
    smart-routing.js
  ui/
    shell.js
    panels.js
    settings-panel.js
    buttons-panel.js
    links-panel.js
  agenda/
    event-builder.js
  pdf/
    export-controller.js
  index.js
```

Outputs:

- preserve `emailsbots.bundle.js` as build output
- add build instructions
- keep runtime behavior unchanged as much as possible

### PR 2 — settings and assistant shell
Implement:

- Settings inside Parameters
- theme colors
- button show/hide
- button ordering
- persistent user preferences
- custom links storage and management

### PR 3 — context and smart templates
Implement:

- better ticket hydration
- stronger email template selection
- formal second-line IT templates
- professional reminders
- generic incident fallback templates

### PR 4 — work notes and productivity actions
Implement:

- Work Notes `+` insert flow
- recent/frequent templates
- reusable quick actions
- custom user-defined buttons

### PR 5 — agenda fixes
Implement:

- correct location mapping
- correct follow-up date/time mapping
- direct event creation flow with clearer defaults

## What should not be changed carelessly

- PDF export behavior should stay stable
- Existing working email generation flow should not be replaced in one big rewrite
- ServiceNow selector logic should be wrapped, not scattered

## Recommended implementation principles

- Keep selectors centralized
- Add defensive guards around every ServiceNow lookup
- Separate read/context/build/render actions
- Persist user config in one storage module
- Prefer additive refactor over full rewrite
- Keep the bundle generated, not hand-edited, once source extraction exists

## Suggested next development action

The best next technical step is **not** a large feature PR directly against the bundle.
The best next step is a **source-extraction/refactor scaffold PR**, followed by small focused PRs for each feature family.

This document exists to make that path explicit before feature work expands further.
