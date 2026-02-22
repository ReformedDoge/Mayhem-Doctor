# 🩺 Mayhem Doctor

<p align="center">
  <strong>Your personal ARAM Mayhem analyst, built right into the League client.</strong>
</p>

<p align="center">
  <video src="https://github.com/user-attachments/assets/fb53daa6-9115-49d6-ab7f-681d06079c8e" controls width="90%"></video>
</p>

<p align="center">
  <img src="https://github.com/user-attachments/assets/f8f5849a-547d-4e03-84db-95430efbdc84" alt="General Stats" width="49%">
  <img src="https://github.com/user-attachments/assets/1ad4f34d-58a6-4a40-945f-2d60542ce851" alt="Champion Search" width="49%">
</p>
<p align="center">
  <img src="https://github.com/user-attachments/assets/a3f7a05d-fb5c-4a85-b1bc-d517e7a3cc5b" alt="Match History" width="49%">
  <img src="https://github.com/user-attachments/assets/6e9627bd-76d8-4285-8d73-5e7c73f6c2bf" alt="Match Scoreboard" width="49%">
</p>
<p align="center">
  <img src="https://github.com/user-attachments/assets/71da047b-00c4-4168-95ba-88155910c0d9" alt="Champion Deep Dive" width="80%">
</p>

## What it does

**General Stats** — A bird's-eye view of your recent games. Win rates by champion, your most-picked augments and how they're performing, and which items are showing up in your wins vs your losses.

**Full Match History** — Every game listed out with result, champion, KDA, damage, and items. Click any game to open a full scoreboard showing both teams — stats, builds, augments, the works.

**Specific Champions** — Pick any champion you've played and go deep. See your best augment combinations, suggested builds based on what's actually been winning, your most common item paths, and individual item win rates — all specific to that champ.

**Patch Filter** — All of the above can be filtered by patch. A small filter sits quietly in the corner letting you uncheck patches you don't want included in the stats — useful for ignoring old data after a big balance update. Your selection is saved between sessions.

**Investigator Mode** — Curious about a teammate or opponent? Enter any player's Riot ID and pull the same full breakdown for them.

---

## Requirements

- **[Pengu Loader](https://github.com/PenguLoader/PenguLoader/releases/)** — a free, open-source tool that lets you run plugins inside the League client

---

## Installation

### Step 1 — Install Pengu Loader

1. Download the latest release from **[here](https://github.com/PenguLoader/PenguLoader/releases/)**

### Step 2 — Install Mayhem Doctor

1. Open Pengu Loader and click **Open Plugins Folder**
2. Drop the `mayhem-doctor` folder in so the structure looks like this:

```
plugins/
└── mayhem-doctor/
    ├── index.js
    └── src/
        ├── analysis.js
        ├── cache.js
        ├── config.js
        ├── lcu.js
        ├── assets/
        │   ├── aram.svg
        │   ├── base.css
        │   ├── champions.css
        │   ├── investigator.css
        │   └── matchView.css
        └── ui/
            ├── augments.js
            ├── investigator.js
            ├── items.js
            ├── matchView.js
            ├── modal.js
            ├── patchFilter.js
            ├── table.js
            └── tabs.js
```

3. Launch (or relaunch) your League client — after a few seconds you'll see a toast notification confirming **Mayhem Doctor is ready**

---

## How to use it

### `Alt + X` — From anywhere in the client
Press **Alt + X** at any time to open Mayhem Doctor. Choose how many games to look back through (10–400), hit **Analyse My History**, and it'll get to work. The first run takes a moment — after that it caches everything locally so reopening is near-instant.

### Command Bar
Press **Ctrl + K** to open Pengu's Command Bar and search for **Mayhem Doctor** or **ARAM**.

### Match History page
Navigate to your match history and you'll find a **Mayhem!** button with a game count slider.

### Profile pages
Visit any player's profile and you'll see a **Mayhem Investigator** tab in the sub-navigation. Enter a Riot ID (`GameName#TAG`) and investigate.

---

## Tips

- **First run is the slowest.** Fetching 200 games can take 5–10 seconds. After that, only new games are fetched — everything else loads from cache.
- **Use the patch filter after big updates.** Uncheck old patches so your stats only reflect the current state of the game.
- **Click any row in Match History** to open the full scoreboard for that game.
- **Click any champion** in the Specific Champions tab to see their full breakdown.

---

## Privacy

Mayhem Doctor never sends your data anywhere. Everything is fetched directly from Riot's servers using your own login session, processed locally, and stored on your own machine. No accounts, no servers, no tracking.

---

## Disclaimer

Mayhem Doctor is not affiliated with or endorsed by Riot Games and does not reflect the views or opinions of Riot Games or anyone officially involved in producing or managing League of Legends. Use at your own discretion.

---
