## Application Details
|               |
| ------------- |
|**Generation Date and Time**<br>Mon May 11 2026 21:09:05 GMT+0000 (Coordinated Universal Time)|
|**App Generator**<br>SAP Fiori Application Generator|
|**App Generator Version**<br>1.24.0|
|**Generation Platform**<br>SAP Business Application Studio|
|**Template Used**<br>Basic V4|
|**Service Type**<br>OData URL|
|**Service URL**<br>https://my433482-api.s4hana.cloud.sap/sap/opu/odata4/sap/zui_bom_automation_v4/srvd_a2x/sap/zui_bom_automation/0001/|
|**Module Name**<br>zpp_bom_automation|
|**Application Title**<br>Bom Automation|
|**Namespace**<br>|
|**UI5 Theme**<br>sap_horizon|
|**UI5 Version**<br>1.142.12|
|**Enable TypeScript**<br>False|
|**Add Eslint configuration**<br>True, see https://www.npmjs.com/package/@sap-ux/eslint-plugin-fiori-tools#rules for the eslint rules.|

## zpp_bom_automation

An SAP Fiori application.

### Starting the generated app

-   This app has been generated using the SAP Fiori tools - App Generator, as part of the SAP Fiori tools suite.  To launch the generated application, run the following from the generated application root folder:

```
    npm start
```

- It is also possible to run the application using mock data that reflects the OData Service URL supplied during application generation.  In order to run the application with Mock Data, run the following from the generated app root folder:

```
    npm run start-mock
```

#### Pre-requisites:

1. Active NodeJS LTS (Long Term Support) version and associated supported NPM version.  (See https://nodejs.org)


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