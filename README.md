# Izlude

[![Publish Release](https://github.com/nanpipat/Izlude/actions/workflows/release.yml/badge.svg)](https://github.com/nanpipat/Izlude/actions/workflows/release.yml)
[![Vercel Deployment](https://img.shields.io/badge/Deploy-Vercel-black?logo=vercel&logoColor=white)](https://vercel.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Izlude** is a minimal API client. It sends requests, shows the response, and otherwise stays out of the way. Built with **Tauri, Rust, and React** on the OS WebView — a roughly 5MB native binary that launches fast and uses little RAM, with no Electron in the loop.

---

## Key Features

- **⚡ Rust-Engine Desktop Core**: Powered by Tauri v2 and native system WebViews (WebView2 on Windows, WebKit on macOS). Footprint of ~5MB installer and low RAM consumption.
- **🛡️ CORS-Bypassing Requests**: Executes HTTP requests natively inside Rust, bypassing browser-enforced CORS restrictions automatically without requiring proxy servers.
- **📝 CodeMirror 6 Editor**: Rich JSON editing featuring automatic brace auto-closing, bracket matching, code folding, auto-indentation, and real-time JSON syntax lint validation with red squiggly highlights.
- **📂 Auto cURL Parsing**: Paste raw cURL commands directly into the main URL input bar. Izlude decomposes and populates the HTTP method, headers, parameters, and request body instantly.
- **⚙️ Dynamic Variable Auto-complete (`{{`)**: Type `{{` in any field to open a floating auto-complete popover listing your active environment variables.
- **🌓 Dynamic Light & Dark Themes**: Full light/dark mode support. The code editor and panels automatically transition stylesheets dynamically with zero editor remounting.
- **🔍 Response Search & Folding**: Easily query keywords inside JSON response payloads with `⌘F` (or `Ctrl+F`), and collapse/expand complex JSON nodes using gutter arrow chevrons.
- **📋 Calculated Headers Tracker**: A collapsible sub-grid showing implicit headers injected dynamically by Auth settings (e.g., Bearer tokens) or body types, facilitating precise request debugging.

---

## Download & Installation

Visit the **[GitHub Releases Page](https://github.com/nanpipat/Izlude/releases)** to download native installers:

- **macOS (Intel & Apple Silicon)**: Download the `.dmg` installer.
- **Windows (x64)**: Download the `.msi` / `.exe` installer.

*Note: Native desktop builds are compiled automatically via GitHub Actions.*

---

## Local Development

Ensure you have **Node.js** and **Rust** installed on your machine.

### 1. Install Dependencies
```bash
npm install
```

### 2. Run Development Servers
To run both the Vite frontend client and the Tauri Rust application shell simultaneously:
```bash
npm run dev
```

If you only want to build or run the Vite client in standard web browsers:
```bash
npm run client
```

### 3. Compile Local Production Desktop App
To package the native app on your host machine:
```bash
npx tauri build
```

---

## CI/CD Releases Pipeline

Izlude uses GitHub Actions to automate release builds in the cloud:

1. **Tag Push Trigger**: Creating and pushing a version tag (e.g., `v0.0.1`) kicks off the compiler workflow:
   ```bash
   git tag v0.0.1
   git push origin v0.0.1
   ```
2. **Cloud Compilation**: GitHub Actions spins up `macos-latest` and `windows-latest` virtual environments to compile the native client binaries.
3. **Draft Release**: The workflow packages the installers and attaches them directly as draft assets on your GitHub Releases page, ready to deploy.

---

## Tech Stack

- **Frontend**: React, TypeScript, Vite
- **Code Editor**: CodeMirror 6
- **Desktop Core**: Tauri v2, Rust
- **Styling**: Vanilla CSS (Monochrome Light/Dark Palette)
- **Icons**: Lucide React

---

## License

Distributed under the MIT License. See [LICENSE](LICENSE) for more information.
