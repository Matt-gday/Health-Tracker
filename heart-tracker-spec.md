# Heart & Health Tracker — Complete Application Specification

**Author:** Matt Allan & Claude  
**Date:** 11 February 2026  
**Status:** Ready for Development  
**Target Device:** iPhone 12 (390 × 844 viewport)  
**Deployment:** Progressive Web App (PWA), offline-first, hosted on GitHub Pages  

---

## 1. Overview

A personal health tracking PWA designed primarily to support management of **paroxysmal atrial fibrillation** and related cardiovascular health. All collected data serves one core purpose: providing Matt's cardiologist (and GP) with accurate, contextualised health data for better clinical decisions.

### 1.1 User Profile (Pre-loaded)

- **Name:** Matt Allan
- **DOB:** 16 June 1973 (Age 52)
- **Height:** 190cm
- **Starting Weight:** ~160kg (weight loss in progress)
- **Key Diagnoses:**
  - Paroxysmal atrial fibrillation
  - Coronary artery calcium score: 1500 (significant calcification)
  - Preserved ejection fraction
  - Negative myocardial perfusion scan (blood flow adequate despite calcium)
  - Sleep apnea (treated with CPAP)
  - Asthma
- **Cardiologist:** Dr Khaled Bhuiyan (public health system, scheduled appointments)
- **GP:** Dr Raymond Collins, Smartclinics Carseldine

---

## 2. Technical Requirements

### 2.1 PWA Configuration

- **Offline-first:** Service Workers + Cache API. App must function fully without internet.
- **Data storage:** IndexedDB only (LocalStorage is too limited for health data volumes). All data persists locally on device.
- **Manifest:** `display: standalone`, `apple-mobile-web-app-capable: yes` for full-screen home screen app experience.
- **Update mechanism:** On launch, check GitHub repository version number. If new version available, show a non-intrusive toast notification prompting "Refresh to Update."
- **Data migration:** When database schema changes between versions, include migration logic to preserve all existing data.

### 2.2 Notifications

- **Attempt PWA push notifications** (supported iOS 16.4+) for medication reminders.
- **Always implement in-app pop-up as reliable fallback** since iOS PWA notifications are unreliable.
- User must grant notification permission on first launch.

### 2.3 Design Principles

- **Light mode only** for initial release. Build colour system using CSS variables so dark mode can be added later.
- **Modern health app aesthetic** — clean, calm, trustworthy. Generous white space, clear typography, intuitive layout. Think Apple Health level of polish.
- **Icons:** Monochrome only. Simple line icons or solid minimal icons. White, black, or single accent colour depending on context. **NO coloured emojis ever.**
- **iPhone 12 optimised:** Bottom tab navigation for thumb-reachable primary actions on the 6.1-inch screen.

---

## 3. Navigation Structure

### 3.1 Bottom Tab Bar

Persistent bottom navigation with tabs:

1. **Home** — Main action buttons
2. **Dashboard** — Unified data visualisation
3. **History** — Browse all data by type
4. **Settings** — Configuration and exports

### 3.2 Home Screen

The home screen displays **9 main action buttons** in a clean grid or card layout. Each button is a single-tap entry point for logging data:

1. **AFib** (toggle: Start / Stop)
2. **Blood Pressure / Heart Rate** (entry form)
3. **Sleep** (toggle: Start / Stop)
4. **Weight** (quick number entry)
5. **Walk** (toggle: Start / Stop)
6. **Steps** (quick number entry)
7. **Food** (entry with library)
8. **Drink** (entry with library)
9. **Medication** (smart checklist)

Each button should have a clear monochrome icon and label. Toggle buttons (AFib, Sleep, Walk) must visually change state when active — different background colour, border, or subtle animation — so Matt can glance at the home screen and immediately see what's currently "running."

---

## 4. Feature Specifications

### 4.1 AFib Toggle

**Purpose:** Track the start time, end time, and duration of every atrial fibrillation episode.

**Home Screen Behaviour:**

- Default state: Button displays "AFib Start" with a neutral appearance.
- On tap: Records current date/time as episode start. Button changes to "AFib Stop" with a prominent highlight colour (e.g., amber/orange background or border) so it's immediately obvious the app thinks Matt is currently in AFib.
- On second tap (Stop): Records current date/time as episode end. Calculates and stores duration. Button returns to default state.

**Data Stored Per Episode:**

| Field | Type | Notes |
|-------|------|-------|
| startTime | ISO 8601 datetime | Auto-recorded on Start tap |
| endTime | ISO 8601 datetime | Auto-recorded on Stop tap |
| duration | Minutes | Auto-calculated |
| notes | String (optional) | Free-text field available on the episode |

**Edit/Delete:**

- All timestamps (start and end) are fully editable after the fact.
- Entire episodes can be deleted with confirmation prompt.
- Duration recalculates automatically when times are edited.
- "Last edited" timestamp stored on modified entries.

**AFib Detail Page:**

- **Summary stats at top:** Episodes this week, this month, average duration, longest episode.
- **Calendar heat map:** Days with AFib episodes are coloured. Allows visual pattern spotting (e.g., "always on Mondays").
- **Episode list:** Scrollable history showing each episode with start, end, duration. Tappable for deep dive.

**AFib Event Deep Dive Page (critical feature):**

When the user taps on a specific AFib episode, a new page opens showing a **unified timeline of ALL data logged in the lead-up period.**

- **Default window:** 24 hours before the episode start time.
- **Expandable:** Toggle to show 48 hours for wider context.
- **Timeline displays (chronologically):**
  - Sleep data from the previous night (duration)
  - Medication confirmation/skips (morning and evening)
  - Ventolin usage (with preventive/reactive tag)
  - Weight (if logged that day)
  - Walk/exercise (duration)
  - Step count (previous day)
  - All food entries with nutrition totals (protein, carbs, fat, sodium)
  - All drink entries with totals (especially flagging caffeine or alcohol)
  - BP/HR readings with context tags
  - Notes on any entry
- **Purpose:** Allow cardiologist (and Claude via CSV analysis) to identify patterns and triggers across multiple episodes.

**Future Feature (design data structure to support):** Cross-episode pattern detection — e.g., "4 out of 6 AFib episodes were preceded by less than 6 hours sleep."

---

### 4.2 Blood Pressure & Heart Rate

**Purpose:** Log BP and HR readings with contextual information, automatically flagging readings taken during AFib.

**Home Screen Behaviour:**

- On tap: Opens a quick entry screen.

**Entry Screen Fields:**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| systolic | Number | No | Top number |
| diastolic | Number | No | Bottom number |
| heartRate | Number | No | BPM |
| exerciseContext | Enum | No | None / Before Exercise / After Exercise |
| foodContext | Enum | No | None / Before Food / After Food |
| isDuringAFib | Boolean | Auto | Auto-set to true if AFib toggle is currently active |
| timestamp | ISO 8601 | Auto | Auto-recorded, editable |
| notes | String | No | Free-text |

- All three number fields are optional — if Matt only has two values, it saves what's there.
- Exercise and food context: two sets of toggle options at the top of the entry screen. Tap "Before Exercise" or "After Exercise" or leave unset. Same for food.
- AFib flag is **automatic** — if the AFib toggle is currently in "active" state, the reading is flagged without Matt needing to do anything.

**BP/HR Detail Page:**

- **Summary stats:** Latest reading, weekly/monthly averages, high/low range.
- **Line chart:** Systolic, diastolic, and heart rate over time. Readings taken during AFib are displayed in a different colour (e.g., amber/orange) on the graph.
- **Scrollable list:** All readings with context tags (exercise, food, AFib flag). Tappable to edit or delete.

---

### 4.3 Sleep Toggle

**Purpose:** Track sleep duration with simple start/stop logging.

**Home Screen Behaviour:**

- Default state: Button displays "Start Sleep."
- On tap: Records current date/time. Button changes to "Stop Sleep" with visual highlight (dimmer/calmer colour than AFib — e.g., a muted blue/purple).
- On second tap (Stop / wake up): Records wake time. Calculates sleep duration.

**Data Stored:**

| Field | Type | Notes |
|-------|------|-------|
| startTime | ISO 8601 | Bedtime — auto-recorded, editable |
| endTime | ISO 8601 | Wake time — auto-recorded, editable |
| duration | Minutes | Auto-calculated |
| notes | String (optional) | e.g., "restless night", "woke up multiple times" |

**Sleep Detail Page:**

- **Summary stats:** Average sleep duration (week/month), best night, worst night.
- **Bar chart:** Each bar is one night, showing hours slept. Easy trend spotting.
- **Scrollable list:** All entries, tappable to edit/delete.

---

### 4.4 Weight

**Purpose:** Track weight over time for cardiologist and personal motivation.

**Home Screen Behaviour:**

- On tap: Opens a simple number input. Type weight in kg. Auto-stamps date and time.

**Data Stored:**

| Field | Type | Notes |
|-------|------|-------|
| weight | Number (kg) | Decimal allowed (e.g., 152.3) |
| timestamp | ISO 8601 | Auto-recorded, editable |
| notes | String (optional) | Free-text |

**Weight Detail Page:**

- **Summary stats:** Current weight, starting weight (first entry), total lost, weekly average.
- **Line graph:** Weight over time with trend line. The visual goal is to see it going down.
- **Scrollable list:** All entries, tappable to edit/delete.

---

### 4.5 Walk / Exercise Toggle

**Purpose:** Track dedicated exercise (primarily morning walks) with start/stop timing.

**Home Screen Behaviour:**

- Default state: Button displays "Start Walk."
- On tap: Records start time. Button highlights (e.g., green accent) to show walk is in progress.
- On second tap (Stop): Records end time. Calculates walk duration.

**Data Stored:**

| Field | Type | Notes |
|-------|------|-------|
| startTime | ISO 8601 | Auto-recorded, editable |
| endTime | ISO 8601 | Auto-recorded, editable |
| duration | Minutes | Auto-calculated |
| notes | String (optional) | Free-text |

---

### 4.6 Steps

**Purpose:** Manually record daily step count from external pedometer.

**Home Screen Behaviour:**

- On tap: Opens a number input asking "How many steps today?" Type in the number. Auto-stamps date.

**Data Stored:**

| Field | Type | Notes |
|-------|------|-------|
| steps | Number | Integer |
| date | Date | Auto-recorded (date only, not time-specific) |
| notes | String (optional) | Free-text |

---

### 4.5 + 4.6 Combined: Activity Detail Page

Walks and Steps share a single **Activity** page since they're both daily movement data.

- **Top section:** Today's walk (duration or "No walk logged today") and today's step count, displayed side by side.
- **Chart:** Combined view showing daily steps as bars with walk duration alongside or overlaid. Shows the relationship between dedicated exercise and overall activity.
- **Time range selector:** Day, Week, Month, 3 Months, Year, All Time.
- **Scrollable list:** All walk and step entries, tappable to edit/delete.

---

### 4.7 Food

**Purpose:** Log food intake with nutrition information, building a personal food library over time.

**Home Screen Behaviour:**

- On tap: Opens the food entry screen.

**Entry Flow:**

1. **Search/type field** at the top. As Matt types, previously entered foods appear as suggestions (autocomplete from personal library).
2. **If selecting an existing food:** Pre-fills all nutrition info. Matt confirms or adjusts quantity.
3. **If creating a new food entry:**
   - **Name** (e.g., "Cheese Omelette", "Half Roast Chicken")
   - **Ingredients** (free-text list — can be typed or pasted from another app, e.g., for manufactured products)
   - **Nutrition per serving:**
     - Protein (g)
     - Carbohydrates (g)
     - Fat (g)
     - Sodium (mg)
   - These values can be manually typed or found via AI and pasted in.
4. **Quantity:** How much (e.g., 1 serve, half, quarter). For items like roast chicken, the library stores "Half Roast Chicken" and "Quarter Roast Chicken" as separate entries with proportional nutrition.
5. Auto-stamps date and time.

**Data Stored Per Log Entry:**

| Field | Type | Notes |
|-------|------|-------|
| foodId | Reference | Links to food library item |
| foodName | String | Denormalised for easy display |
| quantity | Number/String | e.g., 1, 0.5, "2 patties" |
| protein_g | Number | From library, adjusted for quantity |
| carbs_g | Number | From library, adjusted for quantity |
| fat_g | Number | From library, adjusted for quantity |
| sodium_mg | Number | From library, adjusted for quantity |
| timestamp | ISO 8601 | Auto-recorded, editable |
| notes | String (optional) | Free-text |

**Food Library (separate data store):**

| Field | Type | Notes |
|-------|------|-------|
| id | Unique ID | Auto-generated |
| name | String | e.g., "Cheese Omelette" |
| ingredients | String | Free-text ingredient list |
| protein_g | Number | Per serve |
| carbs_g | Number | Per serve |
| fat_g | Number | Per serve |
| sodium_mg | Number | Per serve |

- Library items can be edited (e.g., fix wrong nutrition info on the master entry).
- Library items can be deleted (with confirmation — warn if it's been used in log entries).

**Food Detail Page:**

- **Daily log view:** Select a date, see everything eaten that day with per-item and daily total nutrition breakdown (protein, carbs, fat, sodium).
- **Weekly summary:** Daily averages for each macro.
- **Scrollable list:** All entries, tappable to edit/delete.

---

### 4.8 Drink

**Purpose:** Log fluid intake with type tracking and running daily total.

**Home Screen Behaviour:**

- On tap: Opens the drink entry screen.
- **Running daily fluid total** displayed on or near the Drink button on the home screen (e.g., "1,250 mL today").

**Entry Flow:**

Same pattern as Food:

1. Search/type with autocomplete from personal drink library.
2. Select existing or create new.
3. **Volume:** Default is 250 mL (one glass). Adjustable.
4. Auto-stamps date and time.

**New Drink Entry Fields:**

- **Name** (e.g., "Water", "Diet Cordial", "Coffee")
- **Volume default** (mL)
- **Nutrition per default volume** (if applicable):
  - Protein (g)
  - Carbohydrates (g)
  - Fat (g)
  - Sodium (mg)

**Data Stored Per Log Entry:**

| Field | Type | Notes |
|-------|------|-------|
| drinkId | Reference | Links to drink library item |
| drinkName | String | Denormalised |
| volume_ml | Number | Default 250, adjustable |
| protein_g | Number | Adjusted for volume |
| carbs_g | Number | Adjusted for volume |
| fat_g | Number | Adjusted for volume |
| sodium_mg | Number | Adjusted for volume |
| timestamp | ISO 8601 | Auto-recorded, editable |
| notes | String (optional) | Free-text |

**Drink Detail Page:**

- **Daily total** prominently displayed at top (total mL).
- **Daily log:** What was drunk and when, with amounts.
- **Chart:** Daily fluid intake (mL) over time.
- **Scrollable list:** All entries, tappable to edit/delete.

---

### 4.9 Medication (Smart Checklist)

**Purpose:** Confirm daily medication adherence with minimal effort, track Ventolin usage separately, and catch missed logging via smart prompts.

#### 4.9.1 Medication Setup (in Settings)

User manually enters each medication:

| Field | Type | Notes |
|-------|------|-------|
| name | String | e.g., "Sotalol Hydrochloride" |
| dosage | String | e.g., "40mg (half of 80mg tablet)" |
| schedule | Enum | Morning / Evening / Both |

**Pre-loaded Medication List (Matt's current meds):**

| Medication | Dosage | Schedule |
|------------|--------|----------|
| Sotalol Hydrochloride 80mg | Half tablet (40mg) | Both (morning + evening) |
| Telmisartan/Hydrochlorothiazide 80mg/25mg | 1 tablet | Morning |
| Rilast Turbuhaler (Budesonide/Formoterol) | 1 inhalation | Both (morning + evening) |
| Super Multi Plus (Ethical Nutrients) | 1 tablet | Morning |

- Medications can be added, edited, or removed at any time (e.g., if Matt starts a statin).

#### 4.9.2 Medication Button Behaviour

**Time-based display (12pm cutoff):**

- **Before 12:00 (noon):** Shows morning medication list.
- **12:00 and after:** Shows evening medication list.

**Default state:** All items displayed as **pre-checked (taken)**. Matt only interacts to **un-check** an item he missed. This minimises effort on normal days.

**On confirm/close:** Logs each medication with status.

**Data Stored Per Medication Event:**

| Field | Type | Notes |
|-------|------|-------|
| medName | String | Medication name |
| dosage | String | Dosage taken |
| status | Enum | Taken / Skipped |
| timeOfDay | Enum | AM / PM |
| timestamp | ISO 8601 | Auto-recorded, editable |
| notes | String (optional) | Free-text |

#### 4.9.3 Ventolin (As-Needed Tracking)

Ventolin appears as a **separate section** within the Medication screen (not in the AM/PM checklist since it's not scheduled).

- On tap: Timestamps the usage.
- **Context selector:** Two options — "Preventive" (before exercise or known trigger) or "Reactive" (actual asthma symptoms).
- Ventolin usage feeds into the AFib event timeline and unified dashboard.

**Data Stored Per Ventolin Event:**

| Field | Type | Notes |
|-------|------|-------|
| type | "ventolin" | Fixed |
| context | Enum | Preventive / Reactive |
| timestamp | ISO 8601 | Auto-recorded, editable |
| notes | String (optional) | Free-text |

#### 4.9.4 Smart Medication Reminders

The app tracks whether Matt has tapped the Medication button for each required session (AM and PM).

**Morning check (on app open, before noon):**
- If no PM medication confirmation exists for the previous evening → Show pop-up: "Did you take your evening medications last night?"
- Options: "Yes, all taken" (logs all as taken with estimated evening timestamp) / "Let me check" (opens the PM checklist to mark individually) / "Dismiss"

**Evening check (on app open, after noon):**
- If no AM medication confirmation exists for today → Show pop-up: "Did you take your morning medications today?"
- Same options as above.

**Push notification attempt (belt and braces):**
- Attempt to register PWA push notification at a configurable time (e.g., 8pm if PM meds not confirmed, 9am if AM meds not confirmed).
- If notifications fail or aren't permitted, rely on in-app pop-up only.

#### 4.9.5 Medication Detail Page

- **Today's status:** Morning meds taken/skipped, evening meds taken/skipped.
- **Ventolin usage log:** With preventive/reactive tags.
- **History list:** Scrollable log of all medication events, tappable to edit/delete.
- **Adherence summary:** Percentage of doses taken vs skipped over the week/month.

---

## 5. Unified Dashboard

**Purpose:** A single view that overlays multiple data types on a shared timeline, allowing visual pattern recognition and correlation spotting.

**Location:** Accessible via the Dashboard tab in bottom navigation.

### 5.1 Layout

- **Top two-thirds:** Graph/visualisation area.
- **Below the graph:** A row of tappable toggle chips — one for each data type:
  - AFib | BP | Heart Rate | Sleep | Weight | Walk | Steps | Food | Drink | Medication | Ventolin

- **Time range selector** above the graph: Day | Week | Month | 3 Months | Year | All Time

### 5.2 Data Layer Types

Different data types require different visual treatments:

| Data Type | Visualisation | Notes |
|-----------|--------------|-------|
| AFib episodes | Coloured bands/blocks | Spans across time showing episode duration |
| BP (systolic/diastolic) | Line graph (paired lines) | Different colour for AFib-flagged readings |
| Heart Rate | Line graph | Can overlay with BP or show separately |
| Sleep | Bars or bands | Nightly duration |
| Weight | Line graph | Trend over time |
| Walk duration | Bars | Daily duration |
| Steps | Bars | Daily count |
| Food (macros) | Bars or markers | Daily totals for protein, carbs, fat, sodium |
| Drink | Bars | Daily fluid intake (mL) |
| Medication | Dot markers | Green dot = taken, red dot = skipped |
| Ventolin | Dot markers | With preventive/reactive distinction |

### 5.3 Design Constraints

- **Maximum 3-4 data types visible simultaneously** to avoid visual clutter on a phone screen.
- Start with everything off. User toggles on what they want.
- Consider offering **preset combinations** for common views:
  - "AFib Analysis" = AFib + Sleep + Medication
  - "Weight Journey" = Weight + Food + Walk
  - "Heart Health" = BP + HR + AFib + Medication
- Each toggled data type gets its own scale/axis as needed.
- Tapping a data point on the graph could show a tooltip with the actual values.

### 5.4 Export Integration

The dashboard view (whatever combination of data is currently displayed) should be exportable as part of the cardiologist PDF — a visual summary of whatever the doctor wants to review.

---

## 6. Data Editing & Deletion

### 6.1 Universal Rules

Every single entry across every data type must be:

- **Editable** — all fields including the auto-stamped timestamp. This covers the case where Matt logs something after the fact and wants the time to reflect when it actually happened.
- **Deletable** — with a confirmation prompt ("Are you sure you want to delete this entry?") to prevent accidental loss.
- **Edit-tracked** — a "lastEdited" timestamp is stored on any modified entry so exported data shows whether an entry was corrected after the fact.

### 6.2 Toggle Events (AFib, Sleep, Walk)

For start/stop events specifically:

- Start time is editable (e.g., "I went into AFib an hour ago but forgot to press Start").
- End time is editable (e.g., "I forgot to press Stop Sleep when I woke up").
- Duration recalculates automatically when either time is changed.
- Entire event can be deleted (e.g., accidental press of AFib Start).

### 6.3 Access Points

- Each **detail page** has a history list where entries can be tapped to edit or swiped to delete.
- Alternatively, a dedicated edit icon/button on each entry row.

---

## 7. Notes Field

**Available on every entry type** — an optional free-text field for qualitative context.

Examples:
- AFib episode: "Felt dizzy," "started during stressful phone call"
- BP reading: "Felt lightheaded"
- Sleep: "Restless, woke up multiple times"
- Food: "Ate pizza at church lunch — carbs I usually avoid"
- Medication: "Took Sotalol 30 minutes late"
- Walk: "Very hot morning, cut walk short"
- Weight: "After big meal last night"

These notes are included in CSV exports for Claude's analysis and could reveal qualitative patterns not visible in numerical data alone.

---

## 8. Settings

### 8.1 Medication Master List

- Add, edit, remove medications.
- Each entry: Name, Dosage, Schedule (Morning / Evening / Both).
- Pre-loaded with Matt's current medications (see Section 4.9.1).

### 8.2 Food & Drink Library Management

- View all saved food items and drink items.
- Edit any library item (name, ingredients, nutrition values).
- Delete library items (with warning if used in existing log entries).

### 8.3 User Info

- Age, height, weight (for reference — weight detail page tracks actual logs).
- Pre-loaded with Matt's info.

### 8.4 Nutritional Goals (optional)

- Daily protein goal (g)
- Daily carb limit (g)
- Daily fluid intake goal (mL)

### 8.5 Notification Preferences

- Enable/disable medication reminder notifications.
- Configure reminder times.

### 8.6 App Update Check

- Toggle: "Check for updates on launch."
- Manual "Check Now" button.

---

## 9. Data Export

### 9.1 CSV for Claude (AI Analysis)

**Purpose:** Upload to Claude for trend analysis, AFib trigger identification, and pattern spotting.

**Format:** Single unified CSV file. Every event on its own row, all types mixed together chronologically.

**Columns:**

| Column | Description |
|--------|-------------|
| timestamp | ISO 8601 datetime |
| eventType | afib_start, afib_end, bp_hr, sleep_start, sleep_end, weight, walk_start, walk_end, steps, food, drink, med_taken, med_skipped, ventolin |
| value1 | Context-dependent (e.g., systolic for BP, kg for weight, steps for steps, protein_g for food) |
| value2 | Context-dependent (e.g., diastolic for BP, carbs_g for food) |
| value3 | Context-dependent (e.g., heart rate for BP, fat_g for food) |
| value4 | Context-dependent (e.g., sodium_mg for food/drink) |
| name | Item name (food name, drink name, medication name) |
| quantity | Amount (food quantity, drink mL) |
| context1 | Exercise context (None/Before/After) or Ventolin context (Preventive/Reactive) |
| context2 | Food context (None/Before/After) |
| isDuringAFib | Boolean — was AFib toggle active during this entry |
| duration_min | For completed toggle events (AFib, Sleep, Walk) |
| notes | Free-text notes |
| wasEdited | Boolean — was this entry modified after initial creation |

**Date Range Picker:** User selects start and end date for export. Options include presets: Last 7 Days, Last 30 Days, Last 3 Months, Last Year, All Time.

### 9.2 PDF for Cardiologist

**Purpose:** Clean, formatted medical report for on-screen viewing during appointments and for printing/emailing.

**Design Requirements:**

- **On-screen first:** Must look excellent on iPhone 12 screen for showing during appointments.
- **Exportable:** Full-colour PDF for printing or emailing.
- **AFib readings clearly flagged:** BP/HR readings taken during AFib must be visually distinct (colour-coded, labelled, or separated) so the cardiologist knows which data points may be unreliable.

**Report Sections:**

1. **Patient Summary:** Name, DOB, key diagnoses, current medications.
2. **AFib Summary:** Episode count, average duration, longest episode, frequency trend.
3. **Blood Pressure & Heart Rate Summary:** Averages, trends, graph. AFib-flagged readings clearly marked.
4. **Weight Trend:** Graph and summary stats.
5. **Medication Adherence:** Percentage taken, any skipped doses.
6. **Activity Summary:** Walk frequency/duration, average daily steps.
7. **Nutrition Summary:** Average daily macros.
8. **Sleep Summary:** Average duration, trend.
9. **Dashboard Graph:** Whatever combination the user has currently selected on the dashboard.

**Date Range Picker:** Same as CSV export.

### 9.3 JSON Full Backup

**Purpose:** Complete system state backup for disaster recovery or migration.

**Contents:**

- All settings (medication list, food/drink library, user info, goals, preferences).
- All logged data across every data type.
- All library items.

**Import capability:** If an update fails or data is wiped, this file can be re-imported to restore the app to its previous state.

### 9.4 Export Access

All three exports accessible from **Settings** page with clear labels:
- "Export Data for AI Analysis (CSV)"
- "Generate Cardiologist Report (PDF)"
- "Full Backup (JSON)"

---

## 10. Data Schema Summary

### 10.1 Event Types and Their Fields

All events share these common fields:

| Field | Type | Present On |
|-------|------|-----------|
| id | UUID | All events |
| timestamp | ISO 8601 | All events |
| eventType | String | All events |
| notes | String (optional) | All events |
| lastEdited | ISO 8601 (nullable) | All events |
| isDuringAFib | Boolean | All events (auto-set) |

**Type-specific additional fields:**

**AFib:** startTime, endTime, duration_min

**BP/HR:** systolic, diastolic, heartRate, exerciseContext, foodContext

**Sleep:** startTime, endTime, duration_min

**Weight:** weight_kg

**Walk:** startTime, endTime, duration_min

**Steps:** steps (integer), date

**Food:** foodId, foodName, quantity, protein_g, carbs_g, fat_g, sodium_mg

**Drink:** drinkId, drinkName, volume_ml, protein_g, carbs_g, fat_g, sodium_mg

**Medication:** medName, dosage, status (Taken/Skipped), timeOfDay (AM/PM)

**Ventolin:** context (Preventive/Reactive)

### 10.2 Library Tables

**Food Library:** id, name, ingredients, protein_g, carbs_g, fat_g, sodium_mg

**Drink Library:** id, name, defaultVolume_ml, protein_g, carbs_g, fat_g, sodium_mg

**Medication List:** id, name, dosage, schedule (Morning/Evening/Both)

---

## 11. Edge Cases & Business Logic

### 11.1 AFib + BP Cross-Reference

Any BP/HR reading logged while the AFib toggle is active is **automatically** flagged as `isDuringAFib: true`. This requires no user action. On all displays and exports, these readings are visually distinguished.

### 11.2 Medication Reminder Logic

- Morning session = before 12:00 noon.
- Evening session = 12:00 noon and after.
- If app opens in morning and no PM confirmation exists for the previous evening → pop-up prompt.
- If app opens in afternoon/evening and no AM confirmation exists for today → pop-up prompt.
- Pop-up offers: "Yes all taken" / "Let me check" / "Dismiss."
- "Yes all taken" logs all scheduled meds for that session as Taken with an estimated timestamp.

### 11.3 Food/Drink Quick Entry

- Autocomplete searches the personal library by name as the user types.
- First-time entries create a new library item AND a log entry simultaneously.
- Subsequent uses of the same food/drink pre-fill from the library.
- Library edits do NOT retroactively change historical log entries (nutrition values are stored on each log entry at time of logging).

### 11.4 Daily Running Totals

- **Drink:** Running daily mL total displayed on home screen near the Drink button.
- **Food:** Daily protein, carbs, fat, sodium totals visible on the Food detail page.

### 11.5 Toggle Safety

- If Matt opens the app and sees the AFib button is in "active" state but he's not actually in AFib, he can tap Stop and then edit/delete the accidental event.
- Same applies to Sleep and Walk toggles.

---

## 12. Future Considerations (Not In V1)

These are noted for awareness but NOT included in the initial build:

- Dark mode (CSS variable system makes this easy to add later).
- Cross-episode AFib pattern detection ("3 of 5 episodes preceded by <6hr sleep").
- CPAP data integration (even a yes/no toggle — may add later).
- Integration with external apps or APIs.
- Multiple user support.
- Cloud sync/backup.

---

## 13. Development Notes

### 13.1 Technology Stack

- **HTML/CSS/JavaScript** — single-page application.
- **IndexedDB** for all persistent data storage.
- **Service Worker** for offline capability and caching.
- **Chart.js or similar** for graphs and visualisations.
- **manifest.json** for PWA installation.
- Hosted on **GitHub Pages**.

### 13.2 File Structure (Suggested)

```
/heart-tracker/
├── index.html
├── manifest.json
├── sw.js (Service Worker)
├── css/
│   └── styles.css (CSS variables for theming)
├── js/
│   ├── app.js (main application logic)
│   ├── db.js (IndexedDB operations)
│   ├── ui.js (UI rendering and interactions)
│   ├── charts.js (dashboard and detail page graphs)
│   ├── export.js (CSV, PDF, JSON export logic)
│   └── notifications.js (PWA notification handling)
├── icons/
│   └── (monochrome SVG icons)
└── img/
    └── (app icons for PWA manifest)
```

### 13.3 Key Implementation Priorities

1. **Data integrity first** — IndexedDB operations must be rock-solid. Data loss is unacceptable for health data.
2. **Speed of entry** — every logging action should be completable in under 5 seconds for the common case. The app is useless if it's tedious.
3. **Visual clarity** — AFib-flagged data must be unmistakably marked everywhere it appears.
4. **Offline reliability** — the app must work identically with or without internet.

---

*End of specification. This document should be provided alongside the codebase to any developer or AI continuing work on this project.*
