# ZPP BOM Automation — SAP Fiori Application

A custom SAP Fiori (SAPUI5) application for creating Material Bills of Materials (BOMs) in SAP S/4HANA via an OData V4 back-end service. The app guides users through a two-step wizard: a **Header Screen** (View1) for entering and validating BOM header data, and an **Item Screen** (BOMItem) for adding component line items before final submission.

---

## Table of Contents

1. [Application Overview](#1-application-overview)
2. [Architecture & Project Structure](#2-architecture--project-structure)
3. [Screen Flow](#3-screen-flow)
4. [Key Modules Explained](#4-key-modules-explained)
5. [OData Back-End Integration](#5-odata-back-end-integration)
6. [Running the Application](#6-running-the-application)
7. [Build & Deployment](#7-build--deployment)
8. [Code Review Notes](#8-code-review-notes)

---

## 1. Application Overview

| Detail | Value |
|---|---|
| **App ID** | `zppbomautomation` |
| **UI5 Version** | 1.142.12 |
| **OData Version** | 4.0 |
| **FLP Semantic Object** | `zc_bom_hdr_n` / action `display` |
| **BOM Usage** (hardcoded) | `1` (Production) |
| **BOM Status** (default) | `2` (Active) |
| **Item Category** (default) | `L` (Stock Item) |
| **Generated with** | SAP Fiori Application Generator 1.24.0 |
| **Back-end service URL** | `/sap/opu/odata4/sap/zui_bom_automation_v4/srvd_a2x/sap/zui_bom_automation/0001/` |

The application automates the manual steps required to create a production BOM in SAP. Instead of using transaction CS01, users interact with a guided Fiori UI that validates inputs against the back-end before creating the BOM record.

---

## 2. Architecture & Project Structure

```
zpp_bom_automation/
├── webapp/
│   ├── Component.js            # UIComponent entry point; initialises routing & device model
│   ├── index.html              # Standalone launchpad entry (non-FLP)
│   ├── manifest.json           # App descriptor — routing, models, data sources, FLP config
│   ├── config/
│   │   └── Constants.js        # Central config: routes, OData action paths, value-help paths
│   ├── controller/
│   │   ├── App.controller.js   # Shell controller (no logic — keeps shell view alive)
│   │   ├── View1.controller.js # Header Screen controller (Step 1)
│   │   └── BOMItem.controller.js # Item Screen controller (Step 2)
│   ├── model/
│   │   ├── models.js           # Device model factory (used by Component.js)
│   │   ├── HeaderModel.js      # JSONModel factory & helper for BOM header data
│   │   ├── ItemModel.js        # JSONModel factory & helper for BOM item rows
│   │   └── ResultModel.js      # JSONModel factory & helper for creation result/status
│   ├── service/
│   │   ├── BomActionService.js # Thin wrapper — maps logical actions to ODataActionHelper calls
│   │   ├── ItemScreenService.js# Business logic for item screen (validation, VH data load, payload build)
│   │   └── ValueHelpService.js # Generic OData list-binding VH data loader with in-memory cache
│   ├── util/
│   │   ├── ODataActionHelper.js# Low-level jQuery AJAX wrapper: fetches CSRF token then POSTs action
│   │   ├── ErrorHelper.js      # Parses OData/HTTP error responses into a user-readable string
│   │   ├── FormatterHelper.js  # Pure formatting functions (item numbers, quantities, materials)
│   │   ├── ValueHelpHelper.js  # Builds & manages the generic sap.ui.comp ValueHelpDialog (header VH)
│   │   └── ItemValueHelpHelper.js # Builds & manages component & sort-string VH dialogs (item screen)
│   ├── view/
│   │   ├── App.view.xml        # Shell/NavContainer host view
│   │   ├── View1.view.xml      # Header Screen (Step 1) — form inputs
│   │   └── BOMItem.view.xml    # Item Screen (Step 2) — editable BOM items table
│   ├── css/style.css           # App-level CSS overrides
│   ├── i18n/i18n.properties    # Text bundle (English)
│   └── localService/
│       └── mainService/
│           └── metadata.xml    # Local OData metadata for mock server
├── package.json                # npm scripts & dev dependencies
├── ui5.yaml                    # UI5 tooling config (production build)
├── ui5-mock.yaml               # UI5 tooling config (mock server)
├── ui5-local.yaml              # UI5 tooling config (local proxy to real back-end)
└── ui5-deploy.yaml             # UI5 tooling config (deployment to ABAP)
```

### Dependency Graph (simplified)

```
Component.js
  └── models.js (device model)
  └── manifest.json → OData mainService model (default "")

View1.controller.js
  ├── HeaderModel.js     ← JSONModel for header fields
  ├── ItemModel.js       ← JSONModel for item rows (shared via component)
  ├── BomActionService.js → ODataActionHelper.js → jQuery.ajax (CSRF + POST)
  ├── ValueHelpService.js  → OData bindList (material / plant lists)
  ├── ValueHelpHelper.js   → sap.ui.comp.ValueHelpDialog
  ├── FormatterHelper.js
  └── ErrorHelper.js

BOMItem.controller.js
  ├── HeaderModel.js     (reads from component — written by View1)
  ├── ItemModel.js       (reads/writes via component)
  ├── ResultModel.js     ← view-scoped JSONModel for creation result
  ├── BomActionService.js
  ├── ItemScreenService.js → OData bindList (component VH, sort string VH, payload build)
  ├── ItemValueHelpHelper.js → sap.ui.comp.ValueHelpDialog
  └── ErrorHelper.js
```

---

## 3. Screen Flow

```
FLP Launchpad
    │
    ▼
[App.view.xml]  (NavContainer shell)
    │
    ▼
[View1.view.xml]  ─── RouteView1
  Header Screen
  ┌─────────────────────────────────────────────────────────────────────┐
  │  Material (VH)  | Plant (VH)  | BOM Usage (read-only = "1")         │
  │  Alternative BOM (auto-filled) | Base Qty | Valid From              │
  │  Base UOM (auto-filled) | BOM Status (auto-filled)                  │
  │                                                                     │
  │  ── Copy From Section (optional) ──                                 │
  │  Copy Material | Copy Plant | Copy Alt BOM                          │
  │                                                                     │
  │  [Validate ✔]  [Continue →]  [Copy Existing BOM]                   │
  └─────────────────────────────────────────────────────────────────────┘
        │ onValidateMaterial
        │   1. Resolve material via VH cache
        │   2. POST ValidateMaterialPlant → gets BaseUom
        │   3. POST GetNextAltBOM → auto-fills AltBom
        │ onContinue
        │   1. Check all required header fields
        │   2. If Copy From filled → POST GetAlternateBOMItems
        │   3. navTo RouteBOMItem
        ▼
[BOMItem.view.xml]  ─── RouteBOMItem
  Item Screen
  ┌─────────────────────────────────────────────────────────────────────┐
  │  Header summary (read-only): Material, Plant, AltBom, BaseQty …    │
  │                                                                     │
  │  Editable Table:                                                    │
  │  [Item] [Component (VH)] [Description] [Quantity] [UOM] [Sort Str] │
  │                                                                     │
  │  [+ Add Row]  [Delete Selected]  [Select All]                      │
  │  [Save ✔]  [Cancel ✖]  [New BOM]                                   │
  │                                                                     │
  │  Result strip: Status | BOM Request ID | Created BOM number        │
  └─────────────────────────────────────────────────────────────────────┘
        │ onSave
        │   1. validateBeforeSave (header + all rows)
        │   2. Per-row: checkComponentPlantExtension (live OData call)
        │   3. POST CreateBOM → back-end creates CS01 equivalent
        │   4. Display result (SUCCESS / ERROR / WARNING)
        │ onNavBack → returns to Header Screen (or clears all if SUCCESS)
```

---

## 4. Key Modules Explained

### Component.js

Entry point for the SAPUI5 component. Responsibilities:
- Calls `UIComponent.prototype.init` (triggers manifest-based model setup and routing initialisation).
- Creates a `device` model via `models.js` (used for responsive layout bindings).
- Implements `sap.ui.core.IAsyncContentCreation` for async view loading.

### Constants.js (`webapp/config/Constants.js`)

Single source of truth for all magic values. Any change to back-end action paths, route names, or default values should be made here only.

| Constant | Value | Purpose |
|---|---|---|
| `BOM_USAGE` | `"1"` | Hardcoded production BOM usage |
| `BOM_STATUS` | `"2"` | Default BOM status (Active) |
| `ITEM_CATEGORY` | `"L"` | Default item category (Stock) |
| `ROUTES.HEADER` | `"RouteView1"` | Router route name for header screen |
| `ROUTES.ITEM` | `"RouteBOMItem"` | Router route name for item screen |
| `DEFAULTS.BASE_QTY` | `1` | Default base quantity |
| `ACTIONS.*` | OData paths | Full paths to OData bound actions |
| `VALUE_HELP.*` | OData entity set paths | Paths and `$select` fields for all value helps |

### Models

All models are plain `sap.ui.model.json.JSONModel` instances managed as singleton-like objects at the component level (except `ResultModel` which is view-scoped).

#### HeaderModel.js
Stores BOM header fields. Key properties:

| Property | Type | Description |
|---|---|---|
| `Material` | string | Header material number |
| `Plant` | string | Manufacturing plant |
| `BomUsage` | string | Always `"1"` (enforced on every write) |
| `AltBom` | string | Alternative BOM variant (auto-filled by `GetNextAltBOM`) |
| `BaseQty` | number | Base quantity for the BOM |
| `ValidFrom` | string | Validity start date (ISO date, defaults to today) |
| `BaseUom` | string | Base unit of measure (auto-filled by `ValidateMaterialPlant`) |
| `BomStatus` | string | BOM status code |
| `CopyMaterial/Plant/AltBom` | string | Optional "Copy From" fields |
| `IsValidated` | boolean | Set to `true` only after successful `ValidateMaterialPlant` call |
| `Message/MessageType/ShowMessage` | string/boolean | Inline message strip state |

**State lifecycle:**
1. Created fresh on first navigation to Header Screen.
2. Persisted at component level so it survives route changes.
3. Serialised into URL query parameters via `_syncHeaderToRoute` so browser back/forward works.
4. Reset to defaults on "Cancel" or "New BOM".

#### ItemModel.js
Stores the array of BOM item rows at `/items`. Each row:

| Property | Type | Description |
|---|---|---|
| `item` | string | Zero-padded item number (e.g. `"01"`, `"02"`) |
| `component` | string | Component material number |
| `description` | string | Auto-resolved component description |
| `quantity` | string | Component quantity |
| `uom` | string | Unit of measure |
| `sortString` | string | Sort string / style variant |
| `category` | string | Item category (always `"L"`) |

Key operations: `addRow`, `deleteIndexes` (renumbers after delete), `setItems`, `clearItems`, `applySortStringSelections` (duplicates a row per selected Zcomb value).

#### ResultModel.js
View-scoped (lives on `BOMItem` view only). Tracks the BOM creation result:

| Property | Description |
|---|---|
| `Status` | `"SUCCESS"` / `"ERROR"` / `"WARNING"` |
| `StatusState` | Semantic colour for `ObjectStatus` (`Success` / `Error` / `Warning`) |
| `BomId` | SAP BOM request ID returned from back-end |
| `BillOfMaterial` | Created BOM number |
| `CanSave` / `Editable` | Controls Save button & form editability |
| `ShowMessage` | Drives MessageStrip visibility |

### Services

#### BomActionService.js
A thin façade mapping four logical operations to `ODataActionHelper.postAction`:

| Method | OData Action | Purpose |
|---|---|---|
| `validateMaterialPlant` | `ValidateMaterialPlant` | Checks material+plant combination exists; returns `BaseUnit` |
| `getNextAltBOM` | `GetNextAltBOM` | Returns the next available alternative BOM number |
| `getAlternateBOMItems` | `GetAlternateBOMItems` | Fetches items from an existing BOM for copying |
| `createBom` | `/BomCreate` (entity set) | Creates the BOM record in SAP |

#### ItemScreenService.js
Contains the bulk of the item-screen business logic:

- **`sanitizeQuantity(sValue)`** — strips non-numeric chars, caps at 3 decimal places (live input formatting).
- **`isValidQuantityDecimal(v)`** — regex validation for max 3 decimal places.
- **`checkComponentPlantExtension(oModel, sComponent, sPlant)`** — OData `bindList` against `plant_component_vh` to validate component availability in the plant; returns `{ valid, component, description, uom }`.
- **`fillComponentDetails(...)`** — calls `checkComponentPlantExtension` then writes result into the item model at the given binding path.
- **`loadComponentVHData(oController, sPlant)`** — loads and caches component list for VH dialog (cache invalidated on plant change).
- **`loadSortStringVHData(oController, sMaterial)`** — loads and caches sort string variants (cached per material).
- **`validateBeforeSave(oHeader, aItems)`** — pure validation of all required fields on both header and item rows before the save API call.
- **`buildBomCreatePayload(oHeader, aItems)`** — constructs the JSON payload for `createBom`.
- **`extractBillOfMaterial(sApiResponse)`** — parses the back-end API response string to extract the created BOM number.

#### ValueHelpService.js
Generic OData list-binding loader with in-memory cache (per controller instance). Exposes:
- `loadVHData(oController, sPath, aSelectFields, sCacheName, bUniqueProduct)` — generic loader.
- `loadMaterialVHData(oController)` — loads `/product_plant_vh` (deduped by `Product`).
- `loadPlantVHData(oController)` — loads `/plant_vh`.
- `findMaterial(sMaterial, oMaterialVHModel)` — case-insensitive lookup against loaded material list.

### Utilities

#### ODataActionHelper.js
Low-level HTTP helper. Implements the two-step CSRF dance required by SAP OData:
1. `GET` service root with `X-CSRF-Token: Fetch` to obtain the token.
2. `POST` to the action URL with the token and JSON payload.

Uses `jQuery.ajax` (available in SAPUI5 runtime). Returns a `Promise`.

> **Note:** `jQuery` is declared as a global comment (`/* global jQuery, Promise */`) for linting purposes.

#### ErrorHelper.js
Parses the various error response shapes returned by SAP OData V4:
- `responseJSON.error.message` (string or `{ value }` object)
- `responseText` (JSON string with `.error`)
- Plain `message` property

Always returns a user-readable string; falls back to `"Unexpected error occurred."`.

#### FormatterHelper.js
Pure, stateless formatting functions:
- `formatItemNumber(n)` — zero-pads to 2 digits (`1 → "01"`).
- `formatQuantityForDisplay(v)` — formats to 3 decimal places (`1 → "1.000"`).
- `formatComponentForDisplay(s)` — strips leading zeros from numeric material numbers.
- `normalizeMaterialInput(s)` — trims whitespace.

#### ValueHelpHelper.js
Builds `sap.ui.comp.valuehelpdialog.ValueHelpDialog` with a `FilterBar` for the **header screen** value helps (Material, Plant). Configurable via an `oConfig` object with `dialogName`, `tableName`, `modelName`, `columns`, `filterFields`, etc. Dialogs are cached on the controller instance to avoid recreating on every open.

#### ItemValueHelpHelper.js
Same pattern as `ValueHelpHelper` but purpose-built for the **item screen**:
- **Component VH** — single-select dialog with Component + Description filter inputs.
- **Sort String VH** — multi-select dialog (multi-row expand: one item row is duplicated per selected sort string / `Zcomb` value).

### Controllers

#### App.controller.js
Empty shell controller. The `App.view.xml` is a simple `NavContainer`; no logic is needed at this level.

#### View1.controller.js (Header Screen)

**`onInit`** — initialises `headerModel` and `itemModel` on the component; attaches route pattern matched handler.

**`_onRouteMatched`** — restores header state from URL query parameters (enables browser back/forward to preserve inputs) or resets to defaults.

**`_syncHeaderToRoute`** — serialises entire header model into URL query parameters using `navTo` with `replace: true` (no new history entry). This is how state is preserved across navigation without a back-end draft.

**`onHeaderFieldChange`** — clears validation state on any header field edit. Also clears copied items if a "Copy From" field changes.

**`onValidateMaterial`** (async) — full validation sequence:
1. Resolves typed material against VH cache (case-insensitive).
2. Calls `ValidateMaterialPlant` → gets `BaseUnit`.
3. Calls `GetNextAltBOM` → auto-fills `AltBom`.
4. Sets `IsValidated = true` on success.

**`onContinue`** (async) — guards navigation to Item Screen:
1. Validates all required header fields.
2. If "Copy From" fields are filled, calls `GetAlternateBOMItems` and pre-loads rows.
3. Navigates to `RouteBOMItem`.

**`onLoadCopyFromBomItems`** — standalone "Copy Existing BOM" button handler.

Value help handlers: `onMaterialValueHelp`, `onPlantValueHelp` — delegate to `ValueHelpHelper.openValueHelp`.

#### BOMItem.controller.js (Item Screen)

**`onInit`** — initialises `itemModel` and `resultModel`; attaches route matched handler.

**`_onRouteMatched`** (async) — checks header model is present (redirects to header if missing); ensures at least one blank row exists; calls `_fillCopiedAlternateBomDetails` to auto-resolve component details for any pre-loaded copied items.

**`onAddRow`** — appends a blank item row.

**`onDelete`** — removes selected rows and renumbers remaining rows.

**`onSave`** (async) — full save sequence:
1. `validateBeforeSave` (synchronous header + row checks).
2. Per-row async check: `checkComponentPlantExtension` — updates component/description/uom with server-resolved values.
3. Builds payload and calls `createBom`.
4. Handles `SUCCESS / ERROR / WARNING` responses.

**`onComponentChange`** (async) — when user types directly into the Component input, upper-cases input and resolves description/UOM from the back-end.

**`onComponentValueHelp`** / **`onSortStringValueHelp`** — open the respective VH dialogs via `ItemValueHelpHelper`.

**`onCancel`** — prompts with `MessageBox.warning` before clearing all draft data and returning to Header Screen.

**`onNavBack`** — smart back: if BOM was created successfully, always go to a fresh Header Screen; otherwise try browser back or fall back to `navTo`.

### Views

#### View1.view.xml (Header Screen)
`sap.m.Page` with custom header `Bar` containing three toolbar buttons (Validate, Continue, Copy Existing BOM). Body is a `SimpleForm` (ResponsiveGridLayout) with Material, Plant, BOM Usage (read-only), Alternative BOM (auto-filled), Base Quantity, Valid From, Base UOM, BOM Status, and an optional Copy From section.

A `MessageStrip` above the form shows validation messages bound to `headerModel>/ShowMessage`.

#### BOMItem.view.xml (Item Screen)
`sap.m.Page` with nav-back button. Contains:
1. A read-only `SimpleForm` showing all header summary fields plus a live `ObjectStatus` and `ObjectIdentifier` for the creation result.
2. A `MessageStrip` for result messages.
3. An editable `sap.m.Table` (`bomItemsTable`) with columns: Item No, Component (input+VH), Description (read-only), Quantity (input), UOM (read-only), Sort String (input+VH).
4. Table toolbar: Add Row, Delete, Select All.
5. Footer toolbar: Save, Cancel, New BOM.

---

## 5. OData Back-End Integration

### Service URL
```
/sap/opu/odata4/sap/zui_bom_automation_v4/srvd_a2x/sap/zui_bom_automation/0001/
```

### Entity Sets (Value Helps — read via `bindList`)

| Entity Set | Used For | Filter |
|---|---|---|
| `/product_plant_vh` | Material value help | None (loads all, deduped) |
| `/plant_vh` | Plant value help | None (loads all) |
| `/plant_component_vh` | Component validation & VH | `Plant EQ {plant}` |
| `/sort_string` | Sort String VH | `Product EQ {material}` |

### OData Actions (called via jQuery AJAX + CSRF)

| Action Path | Purpose | Key Payload Fields | Key Response Fields |
|---|---|---|---|
| `.../ValidateMaterialPlant` | Validate material+plant exists | `Material`, `Plant` | `IsValid`, `Message`, `BaseUnit` |
| `.../GetNextAltBOM` | Get next available alt BOM number | `Material`, `Plant`, `BomUsage` | `Success`, `Message`, `AltBom` |
| `.../GetAlternateBOMItems` | Fetch items from existing BOM | `Material`, `Plant`, `BomUsage`, `BillOfMaterialVariant` | `value[]` (array of items) |
| `/BomCreate` | Create the BOM in SAP | Full header + `_Item[]` array | `Status`, `Message`, `BomId`, `ApiResponse` |

### CSRF Token Handling
`ODataActionHelper.postAction` always fetches a fresh CSRF token via a `GET` to the service root before every mutating call. This is correct for SAP OData V4 but means every action generates two HTTP round-trips.

---

## 6. Running the Application

### Prerequisites
- Node.js LTS
- npm ≥ 8

### Install dependencies
```bash
npm install
```

### Available Scripts

| Command | Description |
|---|---|
| `npm run start` | Run against real SAP back-end (requires network & auth). Opens FLP. |
| `npm run start-local` | Run with local proxy config (`ui5-local.yaml`). Opens FLP. |
| `npm run start-mock` | Run with mock server (`ui5-mock.yaml`). No SAP connection needed. |
| `npm run start-noflp` | Run standalone (no FLP shell), opens `index.html` directly. |
| `npm run lint` | Run ESLint across the project. |
| `npm run unit-test` | Run QUnit unit tests with mock server. |
| `npm run int-test` | Run OPA5 integration tests with mock server. |
| `npm run build` | Build deployable artifact to `dist/` folder. |
| `npm run deploy` | Build and deploy to SAP ABAP back-end. |

### Mock Server
The mock server uses `@sap-ux/ui5-middleware-fe-mockserver`. Mock data should be placed under `webapp/localService/`. The metadata XML at `webapp/localService/mainService/metadata.xml` drives the mock entity sets.

---

## 7. Build & Deployment

```bash
# Build for production
npm run build

# Deploy to ABAP (requires ui5-deploy.yaml configured with BSP app details)
npm run deploy

# Test-mode deploy (dry run)
npm run deploy-test

# Undeploy
npm run undeploy
```

The build output lands in `dist/`. `ui5-deploy.yaml` holds the ABAP system, client, and BSP target configuration.

---

## 8. Code Review Notes

The following observations were made during code review, categorised by severity.

### High Priority

#### 1. Raw `sap.m.*` constructors in `ValueHelpHelper.js` bypass the module loader
**File:** `webapp/util/ValueHelpHelper.js`  
`new sap.m.Table(...)`, `new sap.m.Column(...)`, etc. are accessed via the global namespace instead of the `sap.ui.define` dependency array. This bypasses the UI5 module loader and will fail in builds with module preloading or strict CSP environments.  
**Fix:** Add `sap/m/Table`, `sap/m/Column`, `sap/m/Label`, `sap/m/ColumnListItem`, `sap/m/Text` as explicit `sap.ui.define` dependencies (as already done correctly in `ItemValueHelpHelper.js`).

#### 2. CSRF token fetched on every action call (double round-trip)
**File:** `webapp/util/ODataActionHelper.js`  
Each `postAction` call performs a `GET` to the service root to fetch a CSRF token before the actual `POST`. SAP tokens are valid for the session, so this doubles network round-trips for every user action.  
**Fix:** Cache the CSRF token after the first successful fetch. On a `403 Forbidden` response (expired token), retry once with a fresh fetch.

#### 3. `ItemModel.init` called twice on `View1` initialisation
**File:** `webapp/controller/View1.controller.js` — `onInit` and `_onRouteMatched`  
`ItemModel.init` is invoked in both methods. While the existing-model guard prevents data duplication, it is redundant code that can mislead future maintainers.  
**Fix:** Remove the `ItemModel.init` call from `onInit`; retain only the call in `_onRouteMatched`.

### Medium Priority

#### 4. User-facing strings are hard-coded in controllers instead of i18n
**Files:** `View1.controller.js`, `BOMItem.controller.js`  
Error/info messages like `"Please fill Material and Plant."` are hard-coded English strings inside controller logic.  
**Fix:** Move all user-facing messages to `i18n/i18n.properties` and retrieve them via `this.getView().getModel("i18n").getResourceBundle().getText(...)`.

#### 5. Sequential `await` in loops should use `Promise.all`
**File:** `BOMItem.controller.js` — `_validateBeforeSaveAsync`, `_fillCopiedAlternateBomDetails`  
Both methods `await` one `checkComponentPlantExtension` call per item row serially. For BOMs with many items this is unnecessarily slow.  
**Fix:** Collect all promises and resolve in parallel:
```js
var aResults = await Promise.all(
    aItems.map(function(oItem) {
        return ItemScreenService.checkComponentPlantExtension(oModel, oItem.component, sPlant);
    })
);
```

#### 6. Value help data loaded up to 5000 rows client-side
**File:** `webapp/service/ValueHelpService.js` — `loadVHData`  
`requestContexts(0, 5000)` loads up to 5000 records into memory for the material and component value helps. For large catalogues this degrades performance.  
**Fix:** Implement server-side search filtering (pass user-typed value as an OData `$filter`) instead of loading all records upfront.

#### 7. Sort string VH cache guard uses `""` as initial sentinel
**File:** `webapp/controller/BOMItem.controller.js` — `onInit`  
`this._sSortStringVHMaterial = ""` is set as the initial cache key. If the header material is later also `""`, the cache incorrectly matches and stale data is returned.  
**Fix:** Initialise to `null` and guard with `oController._sSortStringVHMaterial !== null`.

### Low Priority

#### 8. `i18n.properties` is sparse — only 4 keys defined
The entire UI uses hard-coded English strings. For production SAP applications all UI text should go through the i18n bundle to support translation and localisation.

#### 9. `BomUsage` is reassigned redundantly throughout `View1.controller.js`
`oHeaderModel.setProperty("/BomUsage", Constants.BOM_USAGE)` appears in nearly every method. Since `HeaderModel.createDefaultData` and `reset` already set it to `"1"`, the repeated writes are noise.  
**Fix:** Remove the redundant reassignments; rely on the model defaults.

#### 10. `notes/handover.txt` is empty
The file exists but contains no content. It should document deployment contacts, transport request numbers, and any known back-end constraints for future maintainers.

---

## Application Details (Generator Metadata)

| | |
|---|---|
| **Generation Date** | Mon May 11 2026 |
| **App Generator** | SAP Fiori Application Generator 1.24.0 |
| **Platform** | SAP Business Application Studio |
| **Template** | Basic V4 |
| **Service URL** | `https://my433482-api.s4hana.cloud.sap/...` |
| **UI5 Theme** | sap_horizon |
| **TypeScript** | No |
| **ESLint** | Yes (`@sap-ux/eslint-plugin-fiori-tools`) |


