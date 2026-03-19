# ⬡ QuantaCAD — AutoCAD SAP Desktop Application
> Quantity Takeoff & Cost Estimating — like CostX, as a native desktop app

---

## 🚀 Quick Start (3 steps)

### Prerequisites
- **Node.js 18+** — download from https://nodejs.org

### 1. Install & Run (Development)
```bash
# In the quantacad-app folder:
node setup.js        # installs all dependencies

npm start            # launches the app
```

### 2. Build an Installer

| Platform | Command | Output |
|----------|---------|--------|
| Windows | `npm run build:win` | `dist/QuantaCAD Setup 1.0.0.exe` |
| macOS | `npm run build:mac` | `dist/QuantaCAD-1.0.0.dmg` |
| Linux | `npm run build:linux` | `dist/QuantaCAD-1.0.0.AppImage` |

The installer will be inside the `dist/` folder. Double-click to install like any normal application.

---

## 📁 Project Structure
```
quantacad-app/
├── src/
│   ├── main.js          ← Electron main process (window, menus, file dialogs)
│   └── preload.js       ← Secure IPC bridge (main ↔ renderer)
├── renderer/
│   ├── index.html       ← Application UI
│   ├── styles.css       ← All styles
│   └── app.js           ← Canvas engine, tools, takeoff logic
├── build/               ← App icons (add icon.ico / icon.icns / icon.png here)
├── package.json         ← Dependencies and build config
└── setup.js             ← One-click setup script
```

---

## 🎯 Features

### Canvas & Measurement Tools
| Tool | Shortcut | Description |
|------|----------|-------------|
| Select | `Esc` | Click & select measurements |
| Pan | `Space` + drag | Move around the drawing |
| Length | `L` | Polyline length measurement |
| Area | `R` | Polygon area measurement |
| Count | `C` | Place count markers |
| Volume | `V` | Area × depth = volume |

### Drawing Support
- **Import drawings**: PNG, JPG, TIFF images (drag & drop onto canvas)
- **DWG/DXF/PDF**: supported via the import dialog (image rendering)
- Unlimited drawing tabs — one per sheet

### Takeoff Register
- Group items by trade: Concrete, Masonry, Openings, Finishes, MEP, Civil
- Unit rates → auto total cost
- Live canvas measurements sync to bottom register table

### Cost Reports
- Grand total with GST calculation
- Trade-by-trade breakdown bar chart
- Export to CSV (File > Export or `Ctrl+E`)

### Scale & Calibration
- Set scale via toolbar (e.g. `1:100`, `1:50`)
- **Calibrate** (`K`): click two known points → enter real distance → auto-set scale

### Project Files
- Save/open `.qcad` project files (`Ctrl+S` / `Ctrl+O`)
- All measurements, items, and settings preserved

---

## ⌨️ Full Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `L` | Length tool |
| `R` | Area tool |
| `C` | Count tool |
| `V` | Volume tool |
| `Esc` | Select tool |
| `Space+drag` | Pan |
| `Scroll` | Zoom in/out |
| `G` | Toggle grid snap |
| `K` | Calibrate scale |
| `Enter` / `DblClick` / `RightClick` | Finish measurement |
| `Del` | Delete selected |
| `Ctrl+Z` | Undo |
| `Ctrl+Y` | Redo |
| `Ctrl+0` | Fit view |
| `Ctrl+S` | Save |
| `Ctrl+O` | Open |
| `Ctrl+I` | Import drawing |
| `Ctrl+E` | Export report |
| `Ctrl+/` | Keyboard shortcuts list |

---

## 🖼️ Adding App Icons
Place these files in the `build/` folder before building:
- `icon.ico` (Windows — 256×256)
- `icon.icns` (macOS)
- `icon.png` (Linux — 512×512)

You can generate them from any PNG at: https://www.icoconverter.com

---

## 🔧 Customisation Tips
- **Add more groups**: edit `defaultGroups()` in `renderer/app.js`
- **Change currency**: search for `₹` in `app.js` and `styles.css`
- **GST rate**: search for `0.18` in `app.js`
- **Default scale**: change `scale: 100` in the `state` object in `app.js`
- **Window size**: change `width: 1600, height: 960` in `src/main.js`

---

## 📞 Troubleshooting
| Problem | Solution |
|---------|----------|
| `electron: command not found` | Run `node setup.js` first |
| App doesn't open | Check Node.js version: `node --version` (needs 18+) |
| Build fails on Mac | Run `xcode-select --install` first |
| Build fails on Linux | Run `sudo apt install rpm` for all targets |
