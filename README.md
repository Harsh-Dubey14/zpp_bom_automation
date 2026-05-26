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


# BOM Automation Fiori Application

## Overview

This is a custom SAP Fiori/UI5 application for BOM creation automation in SAP S/4HANA Public Cloud.

The application allows users to validate Material and Plant, fetch the next available Alternate BOM, optionally copy items from an existing BOM, maintain BOM item components, validate components against Plant, and create a BOM through backend RAP/OData actions.

Application namespace:

```txt
zppbomautomation
```

Main OData V4 service:

```txt
/sap/opu/odata4/sap/zui_bom_automation_v4/srvd_a2x/sap/zui_bom_automation/0001/
```

---

## Features

- Material and Plant validation
- Base UOM auto-fetch
- Next Alternate BOM auto-determination
- Copy items from existing Alternate BOM
- BOM item row maintenance
- Component value help
- Component validation against selected Plant
- Component description and UOM auto-fill
- Quantity validation up to 3 decimal places
- Sort String value help
- BOM creation through backend action
- Success/error status display after BOM creation

---

## Screens

The application has two main screens:

1. Header/Main Screen
2. BOM Item Screen

---

## Header/Main Screen

View:

```txt
webapp/view/View1.view.xml
```

Controller:

```txt
webapp/controller/View1.controller.js
```

Purpose:

The header screen is used to enter and validate BOM header-level data.

Main responsibilities:

- Enter Material
- Enter Plant
- Validate Material and Plant
- Fetch Base UOM
- Fetch next Alternate BOM
- Maintain Copy From BOM details
- Navigate to BOM Item screen

Important fields:

```txt
Material
Plant
BomUsage
AltBom
BaseQty
ValidFrom
BaseUom
BomStatus
CopyMaterial
CopyPlant
CopyAltBom
```

Important controller methods:

```txt
onValidateMaterial
onContinue
onCancel
onMaterialValueHelp
onPlantValueHelp
onCopyMaterialValueHelp
onCopyPlantValueHelp
onHeaderFieldChange
```

---

## BOM Item Screen

View:

```txt
webapp/view/BOMItem.view.xml
```

Controller:

```txt
webapp/controller/BOMItem.controller.js
```

Purpose:

The item screen is used to maintain BOM item-level data and create the BOM.

Main responsibilities:

- Add BOM item rows
- Delete selected rows
- Maintain Component, Quantity, UOM, and Sort String
- Validate Component against selected Plant
- Auto-fill Component Description and UOM
- Select Component from value help
- Select Sort String from value help
- Submit BOM create request

Important item fields:

```txt
item
component
description
quantity
uom
sortString
category
```

Important controller methods:

```txt
onAddRow
onDelete
onSelectAll
onQuantityLiveChange
onQuantityChange
onComponentChange
onComponentValueHelp
onSortStringValueHelp
onSortStringChange
onSave
onCancel
onNewBOM
onNavBack
```

---

## Project Folder Structure

```txt
webapp/
 ├─ controller/
 │   ├─ View1.controller.js
 │   └─ BOMItem.controller.js
 │
 ├─ view/
 │   ├─ App.view.xml
 │   ├─ View1.view.xml
 │   └─ BOMItem.view.xml
 │
 ├─ config/
 │   └─ Constants.js
 │
 ├─ model/
 │   ├─ HeaderModel.js
 │   ├─ ItemModel.js
 │   └─ ResultModel.js
 │
 ├─ service/
 │   ├─ BomActionService.js
 │   ├─ ValueHelpService.js
 │   └─ ItemScreenService.js
 │
 ├─ util/
 │   ├─ ODataActionHelper.js
 │   ├─ ErrorHelper.js
 │   ├─ FormatterHelper.js
 │   ├─ ValueHelpHelper.js
 │   └─ ItemValueHelpHelper.js
 │
 ├─ i18n/
 │   └─ i18n.properties
 │
 ├─ css/
 │   └─ style.css
 │
 ├─ Component.js
 └─ manifest.json
```

---

## File Responsibilities

### `webapp/config/Constants.js`

Contains common constants used across the application.

This includes:

- BOM usage
- BOM status
- Item category
- Route names
- Backend action paths
- Value help entity paths
- Default values

Important constants:

```txt
BOM_USAGE = "1"
BOM_STATUS = "2"
ITEM_CATEGORY = "L"
```

Backend action paths maintained here:

```txt
ValidateMaterialPlant
GetNextAltBOM
GetAlternateBOMItems
BomCreate
```

Value help paths maintained here:

```txt
/product_plant_vh
/plant_vh
/plant_component_vh
/sort_string
```

---

### `webapp/model/HeaderModel.js`

Handles header model creation, default data, reset logic, and validation state changes.

Used by:

```txt
View1.controller.js
BOMItem.controller.js
```

Header model contains:

```txt
Material
Plant
BomUsage
AltBom
BaseQty
ValidFrom
BaseUom
BomStatus
CopyMaterial
CopyPlant
CopyAltBom
IsValidated
Message
MessageType
ShowMessage
```

Change this file when default header values or reset behavior needs to be updated.

---

### `webapp/model/ItemModel.js`

Handles item model logic.

Responsibilities:

- Create item model
- Add blank item row
- Delete selected item rows
- Renumber BOM items
- Clear item data
- Set copied item data
- Apply multiple Sort String selections to item rows

Default item structure:

```txt
item
component
description
quantity
uom
sortString
category
```

Change this file when item row structure or item numbering logic needs to be updated.

---

### `webapp/model/ResultModel.js`

Handles BOM creation result/status model on the item screen.

Result model contains:

```txt
BomId
Status
StatusState
Message
MessageType
ShowMessage
BillOfMaterial
CreatedBomVariant
CanSave
Editable
```

Used by:

```txt
BOMItem.controller.js
```

Change this file when success/error/warning result handling needs to be updated.

---

### `webapp/service/BomActionService.js`

Contains backend action calls.

Methods:

```txt
validateMaterialPlant
getNextAltBOM
getAlternateBOMItems
createBom
```

Internally uses:

```txt
webapp/util/ODataActionHelper.js
```

Change this file when adding or modifying backend action calls.

---

### `webapp/service/ValueHelpService.js`

Loads value help data for the header screen.

Used for:

```txt
Material value help
Plant value help
```

Entities used:

```txt
/product_plant_vh
/plant_vh
```

Change this file when main screen value help data loading needs to be updated.

---

### `webapp/service/ItemScreenService.js`

Contains reusable item-screen business logic.

Responsibilities:

- Quantity sanitization
- Quantity decimal validation
- Component Plant validation
- Component description extraction
- Component UOM extraction
- Component value help data loading
- Sort String value help data loading
- BOM create payload preparation
- BOM number extraction from backend response

Used by:

```txt
BOMItem.controller.js
```

Change this file when item-screen validation, payload, or backend read logic needs to be updated.

---

### `webapp/util/ODataActionHelper.js`

Handles OData action POST calls.

Flow:

```txt
1. Fetch CSRF token from service root.
2. Send POST request to backend action URL.
3. Return backend response.
```

Change this file only if CSRF handling or POST request logic changes.

---

### `webapp/util/ErrorHelper.js`

Extracts readable error messages from backend/UI5 errors.

Used by both controllers.

Change this file when error parsing logic needs to be updated.

---

### `webapp/util/FormatterHelper.js`

Contains common formatting functions.

Examples:

```txt
Format item number as 01, 02, 03
Format quantity to 3 decimals
Format component display value
Normalize material input
```

Change this file when common formatting rules need to be updated.

---

### `webapp/util/ValueHelpHelper.js`

Handles value help dialog UI for the header screen.

Used for:

```txt
Material value help
Plant value help
```

Change this file when header screen value help UI columns or search fields need to be updated.

---

### `webapp/util/ItemValueHelpHelper.js`

Handles value help dialog UI for the item screen.

Used for:

```txt
Component value help
Sort String value help
```

Change this file when item screen value help UI columns, search filters, or selection behavior need to be updated.

---

## Application Flow

### Header Validation Flow

```txt
User enters Material and Plant
        ↓
User clicks Validate Material
        ↓
Material is checked using Product value help data
        ↓
ValidateMaterialPlant backend action is called
        ↓
Base UOM is returned
        ↓
GetNextAltBOM backend action is called
        ↓
Next Alternate BOM is populated
        ↓
User clicks Continue
        ↓
Application navigates to BOM Item screen
```

---

### Copy Existing BOM Flow

```txt
User enters Copy Material, Copy Plant, and Copy Alternate BOM
        ↓
User clicks Load/Continue
        ↓
GetAlternateBOMItems backend action is called
        ↓
Existing BOM items are fetched
        ↓
Items are converted into item model rows
        ↓
Application navigates to BOM Item screen
        ↓
Component description and UOM are filled after validation
```

---

### Item Maintenance and BOM Creation Flow

```txt
User adds/edits BOM item rows
        ↓
User enters or selects Component
        ↓
Component is validated against selected Plant
        ↓
Description and UOM are auto-filled
        ↓
User enters Quantity
        ↓
Quantity is validated up to 3 decimal places
        ↓
User optionally selects Sort String
        ↓
User clicks Save
        ↓
BOM payload is prepared
        ↓
BomCreate backend action is called
        ↓
Success/error message is displayed
```

---

## Backend Actions

### Validate Material Plant

Action path:

```txt
/BomApi/com.sap.gateway.srvd_a2x.zui_bom_automation.v0001.ValidateMaterialPlant
```

Payload:

```json
{
  "Material": "MATERIAL",
  "Plant": "PLANT"
}
```

Expected response:

```json
{
  "IsValid": true,
  "BaseUnit": "NOS",
  "Message": "Material and Plant are valid"
}
```

---

### Get Next Alternate BOM

Action path:

```txt
/BomApi/com.sap.gateway.srvd_a2x.zui_bom_automation.v0001.GetNextAltBOM
```

Payload:

```json
{
  "Material": "MATERIAL",
  "Plant": "PLANT",
  "BomUsage": "1"
}
```

Expected response:

```json
{
  "Success": true,
  "NextAltBom": "01",
  "Message": "Next Alternate BOM determined"
}
```

---

### Get Alternate BOM Items

Action path:

```txt
/BomApi/com.sap.gateway.srvd_a2x.zui_bom_automation.v0001.GetAlternateBOMItems
```

Payload:

```json
{
  "Material": "MATERIAL",
  "Plant": "PLANT",
  "BomUsage": "1",
  "BillOfMaterialVariant": "01"
}
```

Expected response contains BOM item details such as:

```txt
BillOfMaterialComponent
BillOfMaterialItemNumber
BillOfMaterialItemQuantity
BillOfMaterialItemUnit
BillOfMaterialVariant
BomUsage
Success
Message
```

---

### Create BOM

Action path:

```txt
/BomCreate
```

Payload structure:

```json
{
  "Material": "MATERIAL",
  "Plant": "PLANT",
  "BomUsage": "1",
  "AltBom": "01",
  "BaseQty": 1,
  "ValidFrom": "2026-05-24",
  "BomStatus": "2",
  "_Item": [
    {
      "ItemNo": "01",
      "ItemCategory": "L",
      "Component": "COMPONENT",
      "Quantity": 1,
      "Uom": "NOS",
      "SortString": ""
    }
  ]
}
```

Expected response:

```json
{
  "Status": "SUCCESS",
  "Message": "BOM created successfully",
  "BomId": "UUID",
  "ApiResponse": "{\"BillOfMaterial\":\"BOM_NUMBER\"}"
}
```

---

## Value Help Entities

### Material Value Help

Entity:

```txt
/product_plant_vh
```

Fields:

```txt
Product
ProductDescription
```

---

### Plant Value Help

Entity:

```txt
/plant_vh
```

Fields:

```txt
Plant
PlantName
```

---

### Component Value Help

Entity:

```txt
/plant_component_vh
```

Fields:

```txt
Plant
component
ProductDescription
uom
```

Component value help is filtered by selected Plant.

---

### Sort String Value Help

Entity:

```txt
/sort_string
```

Fields:

```txt
Product
Style
Zcomb
ColorName
sizes
```

Sort String value help is filtered by header Material.

---

## Business Rules

- BOM Usage is fixed as `1`.
- BOM Status default is `2`.
- BOM Item Category default is `L`.
- Item numbering is `01`, `02`, `03`, etc.
- Base Quantity must be greater than `0`.
- Quantity supports maximum 3 digits after decimal.
- Component must be available in selected Plant.
- Component Description and UOM are filled from component value help.
- Sort String can be entered manually or selected through value help.
- Multiple Sort String selection can create additional item rows.
- After successful BOM creation, Save is disabled and the screen becomes non-editable.
- After success and back navigation, draft data is cleared.

---

## Local Development

Install dependencies:

```bash
npm install
```

Run locally:

```bash
npm start
```

or:

```bash
ui5 serve
```

When testing after JavaScript/controller/service changes, use hard refresh:

```txt
Ctrl + Shift + R
```

Useful debug URL parameters:

```txt
?sap-ui-debug=true&sap-ui-xx-viewCache=false
```

---

## Deployment Notes

Before deployment, verify:

```txt
1. manifest.json service URI
2. ui5.yaml proxy target
3. package.json deploy script
4. SAPUI5 repository name
5. Transport request
6. Business catalog assignment
7. IAM app assignment
8. Target system URL
```

Main service URI in `manifest.json`:

```txt
/sap/opu/odata4/sap/zui_bom_automation_v4/srvd_a2x/sap/zui_bom_automation/0001/
```

Application ID:

```txt
zppbomautomation
```

---

## Common Issues and Fixes

### Blank screen after refactor

Check browser console.

Common causes:

```txt
1. Wrong folder name
2. Wrong import path
3. Missing JS file
4. Syntax error in JS module
5. Import count and function parameter count mismatch
```

Correct folder name:

```txt
webapp/util
```

Do not rename it to:

```txt
webapp/utils
```

Correct imports:

```txt
zppbomautomation/util/...
zppbomautomation/service/...
zppbomautomation/model/...
zppbomautomation/config/...
```

---

### Product value help error

Error:

```txt
Cannot read properties of undefined reading _getUniqueProducts
```

Fix:

Inside `ValueHelpService.js`, use module reference:

```js
aResults = ValueHelpService._getUniqueProducts(aResults);
```

Do not use:

```js
this._getUniqueProducts(aResults);
```

inside async callback.

---

### Component description or UOM not filling

Check value help entity:

```txt
/plant_component_vh
```

Expected fields:

```txt
Plant
component
ProductDescription
uom
```

Also check that Plant is selected before component validation.

---

### CSRF token error

Check:

```txt
webapp/util/ODataActionHelper.js
```

The app first fetches CSRF token from service root, then sends POST request to backend action.

If CSRF fails, check:

```txt
1. Service URL
2. Authentication
3. Deployment destination/proxy
4. Backend service availability
```

---

### BOM create fails

Check backend response message first.

Common reasons:

```txt
1. Component not extended to Plant
2. Missing UOM
3. Invalid quantity
4. Backend standard BOM API mandatory field missing
5. Alternate BOM already exists
6. Backend communication/API error
```

For BOM Usage `1`, backend standard BOM API may require production-relevant item flags. This is handled in backend logic.

---

## Developer Change Guide

### Change backend action paths

Update:

```txt
webapp/config/Constants.js
```

---

### Change BOM create payload

Update:

```txt
webapp/service/ItemScreenService.js
```

Method:

```txt
buildBomCreatePayload
```

---

### Change header default values

Update:

```txt
webapp/model/HeaderModel.js
```

---

### Change item row structure

Update:

```txt
webapp/model/ItemModel.js
```

Also check:

```txt
webapp/service/ItemScreenService.js
webapp/view/BOMItem.view.xml
```

---

### Change header value help UI

Update:

```txt
webapp/util/ValueHelpHelper.js
```

---

### Change component or sort string value help UI

Update:

```txt
webapp/util/ItemValueHelpHelper.js
```

---

### Change validation logic

Header validation:

```txt
webapp/controller/View1.controller.js
webapp/service/BomActionService.js
```

Item validation:

```txt
webapp/service/ItemScreenService.js
```

---

## Testing Checklist

Before handover, test the following:

```txt
[ ] App opens without console errors.
[ ] Material value help opens.
[ ] Plant value help opens.
[ ] Manual material entry validates properly.
[ ] Material and Plant validation works.
[ ] Base UOM is filled after validation.
[ ] Next Alternate BOM is filled.
[ ] Copy existing BOM items works.
[ ] Continue navigates to item screen.
[ ] Add row works.
[ ] Delete selected row works.
[ ] Select all works.
[ ] Component value help opens.
[ ] Component selection fills component, description, and UOM.
[ ] Manual component entry validates against Plant.
[ ] Quantity allows maximum 3 decimals.
[ ] Sort String value help opens.
[ ] Multiple Sort String selection creates multiple rows.
[ ] Save creates BOM successfully.
[ ] Backend error message displays properly.
[ ] Cancel clears draft data.
[ ] New BOM clears draft data.
[ ] Back navigation works after successful BOM creation.
```

---

## Handover Notes

Important points for the next developer:

```txt
1. Do not rename util folder to utils.
2. Keep namespace as zppbomautomation unless manifest id changes.
3. If manifest app id changes, all module import paths must be changed.
4. Backend action paths are maintained in Constants.js.
5. CSRF and POST handling are centralized in ODataActionHelper.js.
6. Header model and item model are shared between both screens.
7. Value help data is cached in controller instance variables.
8. Hard refresh browser after JavaScript changes.
```

---

## Ownership

Application:

```txt
BOM Automation Fiori Application
```

Namespace:

```txt
zppbomautomation
```

Frontend:

```txt
SAPUI5 / SAP Fiori Basic Template
```

Backend:

```txt
SAP S/4HANA Public Cloud RAP / OData V4
```