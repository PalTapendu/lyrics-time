# Timing Console — Lyric Timestamp Tagger

A tap-to-timestamp tool for tagging the exact Start (and, if you want,
End) of every line or word in a song. Runs entirely on your own machine —
no backend, no account, nothing uploaded anywhere.

## Files

```
index.html     the page
styles.css     all styling (dark + light theme)
app.js         all app logic
spectrum.js    the live Three.js audio-reactive spectrum
README.md      this file
```

Keep all files together in one folder — `index.html` loads the rest by
relative path.

## Running it

Double-click `index.html`. No install, no server. The first run needs
internet once, to fetch the fonts and Three.js from public CDNs; after
that everything works offline too (you just lose the animated spectrum
if Three.js can't load).

## Layout

- The **player is permanently docked** at the bottom of the screen —
  waveform, spectrum, and transport controls stay put no matter how far
  you scroll.
- Above it, the page has **two panes that swap like an accordion**: the
  Setup pane (song + lyrics upload) and the Console pane (lyrics list +
  captured timestamps). Only one is open at a time — opening one
  animates the other closed. Each pane has its own clickable header bar — click either one to
  switch. Switching never touches your tagging progress; only "Load
  into console" rebuilds the line list, and it asks first.

## Setting up

1. **Choose song file** — draws the waveform and wires up the spectrum.
2. **Paste lyrics** or load a `.txt`.
3. **Split by** — Line or Word.
4. **Capture** — what you want per line:
   - **Start only** — just the moment each line begins.
   - **Start & End** — both ends of each line.
5. **Tap using** — how you want to mark them:
   - **Buttons** — each line shows its own Start (and End) button.
   - **Click line** — no buttons at all; the whole line is the button.
     In Start-only mode one click marks the Start. In Start & End mode
     the first click marks Start, the second marks End. Hovering a line
     shows a small hint of what the next click will do.
6. **"Load into console"** — Setup animates closed, Console animates
   open.

## Tagging

- The amber-highlighted line is the one you're on. It scrolls itself
  into a comfortable position automatically after each tag, so you don't
  have to keep moving the mouse down the list.
- **The highlight only ever moves forward.** If you miss a line and
  carry on tagging later ones, the highlight follows you forward and the
  missed line simply stays behind — it will never yank your focus back.
  A small "N skipped" badge appears next to the count so you know
  they're there, and you can go back to them whenever you like by
  clicking them directly.
- Keyboard: **S** marks Start on the current line, **E** marks End,
  **Enter** plays/pauses.
- Slow the song with 0.5× / 0.75× for dense sections.
- Click anywhere on the waveform to jump there. Tick marks on the
  waveform show every Start (gold) and End (green) you've captured.

## Fixing mistakes

- **Per-line revert (↺ on the line)** — appears on any line whose
  timestamp you overwrote. One click puts the previous value back. This
  is the safety net for accidental clicks in "Click line" mode.
- **↺ undo** (top of the right panel) — steps back through your tagging
  history globally, one action at a time.
- **± buttons** — nudge a captured time by 0.1s.
- **Click a time and type** — full manual entry, `mm:ss.mmm` (e.g.
  `01:23.450`) or plain seconds (`83.45`), Enter to apply.
- **⟲ reset all** — clears everything on the song (asks first).
- In Start & End mode, each tagged line also shows its **Duration**,
  flagged red if End lands before Start.

## Checking your work

Each captured line has two preview buttons:
- **▶ play** — plays the song from that line's Start onward, normally.
- **⟳ loop** — loops just that line, Start to End, over and over. Click
  again to stop.

## Saving and exporting

- **💾 save / 📂 load** — writes your progress to a small `.json` file
  (lyrics + timestamps + settings, not the audio) so you can resume
  later.
- The app also **autosaves to this browser** as you tag, and offers to
  restore it if you come back after closing the tab. Re-select your song
  file after restoring — browsers can't remember a local file across
  reloads, but all your timestamps come back exactly as they were.
- **Exports**: `.LRC`, `.SRT`, `.VTT`, `.TXT`. The filename is built
  from the song's own name plus the capture mode, e.g.
  `Song Name - Start-End.srt`.


## Timeline (player dock)

The dock at the bottom is always on screen and never scrolls away.

- **Drag its top edge** (the grip bar) to make the whole dock taller or
  shorter. Your size is remembered.
- **Lyric blocks track** sits directly above the waveform. Every tagged
  line appears as a block spanning its Start→End, with the text inside,
  animating in as you tag. Lines with no End yet show as a dashed
  "pending" block.
  - **Drag the middle** of a block to shift the whole line in time.
  - **Drag either edge** to adjust just the Start or just the End.
  - Both update the timestamps panel live.
  - The **⌃ button** in the toolbar expands the track so longer lines
    show their full text.
- **Waveform**: click to seek, or **drag the playhead** like a video
  editor scrubber.
- **Zoom** with the +/− buttons (or the `+` / `−` keys, or Ctrl/Cmd +
  scroll). Zoomed in, a **minimap** appears underneath — drag it to move
  around the song.
- **Spectrum** sits beside the transport controls, spanning the
  remaining width, and animates live with the music.

## Keyboard

| Key | Action |
| --- | --- |
| `Space` | Play / pause |
| `S` | Mark Start on the current line |
| `E` | Mark End on the current line |
| `←` / `→` | Seek 2s (hold Shift for 5s) |
| `+` / `−` | Zoom the timeline in / out |

---

**Timing Console** — created by **Tapendu Pal**.
