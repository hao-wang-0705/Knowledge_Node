# Components Domain Map

This directory follows domain-oriented grouping to keep growth manageable.

- `node/`: node rendering and node interaction building blocks
- `editor/`: editor shell, command center, and editing overlays
- `sidebar/`: navigation sidebar and breadcrumb-related components
- `tag-library/`: supertag management panels
- `capture/`: quick-capture flow components
- `split-pane/`: detail panel and split-pane state adapters
- `auth/`: authentication forms
- `ui/`: reusable primitive UI components

Legacy flat files remain supported while migration is in progress. New components should prefer domain folders first.
