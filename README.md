# TokenLayer

TokenLayer is a Figma plugin for exploring, inspecting, and safely migrating design tokens and local variable collections.

---

## Features

### 1. Token Explorer
- **Multi-view token browsing:** Toggle between a hierarchical list view with full group paths and a compact swatch grid view.
- **3-axis filtering:** Filter variables by Collection, Resolved Type (Color, Float, String, Boolean), and Mode.
- **Search:** Real-time search across token names, descriptions, and collections.
- **Deep alias inspection:** Recursively resolves token aliases up to 5 levels deep, displaying the full reference chain and computed values.
- **Quick copy:** Hover to copy raw or formatted token values directly to the clipboard.

### 2. Migration Planner & Engine
- **Cross-collection migration:** Migrate tokens from any local collection into existing or newly created destination collections.
- **Live conflict preview:** Real-time pre-flight inspection comparing source tokens against destination variables before applying any changes.
- **Conflict resolution policies:**
  - `Skip existing tokens`: Preserves existing destination variables and values.
  - `Overwrite existing`: Updates destination variable values across matching modes.
  - `Rename with suffix`: Automatically resolves naming collisions by appending numeric suffixes (`-1`, `-2`).
- **Naming flexibility:** Choose between keeping original paths, prefixing with collection names, lowercase hyphenation, or adding version suffixes.
- **Alias preservation:** Resolves and preserves `VARIABLE_ALIAS` relationships during migration.

### 3. Migration History & Audit Results
- **Persistent audit log:** Past migrations are safely saved locally to `figma.clientStorage`.
- **Detailed inspection drawer:** Inspect exactly why tokens were created, updated, or skipped, complete with side-by-side source vs. destination value comparisons.
- **Dedicated history screen:** Browse all past migrations with status filtering and instant detail recall.

---

## Getting Started

### Prerequisites
- Node.js (v18 or higher recommended)
- Figma Desktop App

### Installation & Development
1. Clone the repository and install dependencies:
   ```bash
   npm install
   ```
2. Build the production bundles:
   ```bash
   npm run build
   ```
   Or run the watcher during active development:
   ```bash
   npm run watch:ui
   npm run watch:plugin
   ```
3. Load in Figma:
   - In the Figma Desktop App, go to **Plugins** → **Development** → **Import plugin from manifest...**.
   - Select the `manifest.json` file in this repository root.
   - Run **TokenLayer** from the plugins menu.

---

## Security & Permissions
- **Network access:** TokenLayer requires no external network access (`allowedDomains: ["none"]`). All operations run entirely locally within the Figma sandbox.
- **Self-contained bundle:** All styles, UI components, and fonts (`Inter`) are inlined into the single-file UI bundle.
