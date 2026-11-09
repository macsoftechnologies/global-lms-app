# New Project (React Native + Expo + TypeScript)

A modern, cross-platform mobile application starter built with **React Native**, **Expo SDK 58**, and **TypeScript**. This project comes preconfigured with strict TypeScript type-checking, native Android and iOS configurations, and an interactive welcome screen.

---

## Table of Contents

1. [Technologies Used](#1-technologies-used)
2. [Prerequisites and Software Installation](#2-prerequisites-and-software-installation)
3. [Project Folder Structure](#3-project-folder-structure)
4. [Installation Instructions](#4-installation-instructions)
5. [Commands to Start the Application](#5-commands-to-start-the-application)
6. [Instructions to Run on Android (Expo Go)](#6-instructions-to-run-on-android-expo-go)
7. [Instructions to Run on iOS](#7-instructions-to-run-on-ios)
8. [How to Install Additional Dependencies](#8-how-to-install-additional-dependencies)
9. [Common Errors & Troubleshooting](#9-common-errors--troubleshooting)

---

## 1. Technologies Used

- **[React Native](https://reactnative.dev/) (v0.88.1)**: Framework for building native mobile applications using React.
- **[Expo](https://expo.dev/) (SDK 58)**: Toolchain and platform facilitating rapid development, testing, and deployment.
- **[TypeScript](https://www.typescriptlang.org/) (v6.0)**: Typed superset of JavaScript providing compile-time type safety and code intelligence.
- **[Metro Bundler](https://facebook.github.io/metro/)**: Fast JavaScript bundler optimized for React Native.

---

## 2. Prerequisites and Software Installation

Before running this project, ensure you have the following installed on your computer:

1. **Node.js (LTS version)**:
   - Download and install from [nodejs.org](https://nodejs.org/) (Node.js 18.x or 20.x+ recommended).
   - Verify installation:
     ```bash
     node -v
     npm -v
     ```
2. **Code Editor**:
   - [Visual Studio Code](https://code.visualstudio.com/) (recommended) with the **Expo Tools** and **TypeScript and JavaScript Language Features** extensions.
3. **Mobile Device or Emulator**:
   - **Android**: Install the free **Expo Go** app from the [Google Play Store](https://play.google.com/store/apps/details?id=host.exp.exponent).
   - **iOS**: Install the free **Expo Go** app from the [Apple App Store](https://apps.apple.com/app/expo-go/id982107779).

---

## 3. Project Folder Structure

```text
new-project/
├── .claude/                   # Claude configuration
├── .gitignore                 # Git ignore patterns (node_modules, .expo, etc.)
├── AGENTS.md                  # Development guidelines & best practices
├── App.tsx                    # Root React component
├── app.json                   # Expo configuration (app name, icons, bundle IDs)
├── assets/                    # Static image assets
│   ├── android-icon-background.png
│   ├── android-icon-foreground.png
│   ├── android-icon-monochrome.png
│   ├── favicon.png
│   ├── icon.png
│   └── splash-icon.png
├── index.ts                   # Application entry point registering the root component
├── package.json               # Project manifest, dependencies, and scripts
├── package-lock.json          # Dependency lockfile
├── README.md                  # Project documentation
├── src/                       # Application source code
│   └── screens/
│       └── WelcomeScreen.tsx  # Interactive welcome screen with environment info
└── tsconfig.json              # TypeScript compiler configuration
```

---

## 4. Installation Instructions

1. Open your terminal or PowerShell and navigate to the project root directory:
   ```bash
   cd "path/to/new project"
   ```
2. Install all required dependencies:
   ```bash
   npm install
   ```

---

## 5. Commands to Start the Application

The development server is driven by Expo CLI via npm scripts:

| Command | Description |
| :--- | :--- |
| `npx expo start` | Starts the Metro development server with interactive menu |
| `npm start` | Alias for `expo start` |
| `npm run android` | Starts Metro and attempts to launch directly on connected Android device/emulator |
| `npm run ios` | Starts Metro and attempts to launch in macOS iOS Simulator |
| `npm run web` | Starts local web preview server |
| `npx expo start -c` | Starts server while clearing Metro cache |

### In-Terminal Shortcuts
While the server is running, press these keys in your terminal:
- <kbd>a</kbd>: Open on Android device/emulator.
- <kbd>i</kbd>: Open on iOS simulator (macOS only).
- <kbd>w</kbd>: Open in web browser.
- <kbd>r</kbd>: Reload the app on all connected devices.
- <kbd>m</kbd>: Toggle the in-app developer menu.
- <kbd>c</kbd>: Display the QR code again.
- <kbd>Ctrl</kbd> + <kbd>C</kbd>: Stop the development server.

---

## 6. Instructions to Run on Android (Expo Go)

### Method 1: Using Wi-Fi (Most Common)
1. Ensure both your computer and your Android phone are connected to the **same local Wi-Fi network**.
2. Start the development server:
   ```bash
   npx expo start
   ```
3. A large QR code will appear in your terminal.
4. Open the **Expo Go** app on your Android phone.
5. Tap **"Scan QR code"** and point your phone camera at the terminal QR code.
6. Metro will bundle the JavaScript code and your app will launch on your phone.

### Method 2: Using USB Cable (Recommended if Wi-Fi has isolation)
1. Connect your Android phone to your PC via a USB cable.
2. Enable **Developer Options** and **USB Debugging** on your phone.
3. Start the server and press <kbd>a</kbd> in your terminal to automatically connect.

---

## 7. Instructions to Run on iOS

### Using Physical iPhone / iPad
1. Connect your iPhone to the same Wi-Fi network as your PC.
2. Start the development server:
   ```bash
   npx expo start
   ```
3. Open the default iOS **Camera** app and point it at the QR code in your terminal.
4. Tap the notification banner that reads **"Open in Expo Go"**.

### Using iOS Simulator (macOS only)
1. Ensure Xcode and Command Line Tools are installed on your Mac.
2. Run `npm run ios` or press <kbd>i</kbd> in the running Expo terminal.

---

## 8. How to Install Additional Dependencies

> [!IMPORTANT]
> **Always use `npx expo install` instead of `npm install` for React Native packages.**
> `npx expo install` automatically checks compatibility and installs the exact version tested and validated for your project's Expo SDK version.

### Examples:

- **Vector Icons**:
  ```bash
  npx expo install @expo/vector-icons
  ```
- **Safe Area Context**:
  ```bash
  npx expo install react-native-safe-area-context
  ```
- **Async Storage**:
  ```bash
  npx expo install @react-native-async-storage/async-storage
  ```
- **Regular Utility Libraries** (pure JS/TS libraries with no native code, e.g. `lodash`, `dayjs`):
  ```bash
  npm install lodash
  npm install -D @types/lodash
  ```

---

## 9. Common Errors & Troubleshooting

### 1. Device Cannot Connect to Metro ("Could not connect to development server")
- **Cause**: Computer and phone are on different Wi-Fi networks, or Windows Firewall is blocking incoming traffic on port 8081.
- **Fix**:
  - Verify both devices are on the exact same Wi-Fi network.
  - If using guest or corporate Wi-Fi (client isolation enabled), switch to your phone's personal hotspot or run with tunneling:
    ```bash
    npx expo start --tunnel
    ```

### 2. Cache Issues ("Unable to resolve module" or stale code)
- **Fix**: Clear the Metro bundler cache by starting with the `-c` flag:
  ```bash
  npx expo start -c
  ```

### 3. Incompatible Dependency Versions
- **Fix**: Run Expo's automated package version checker and fixer:
  ```bash
  npx expo install --check
  npx expo install --fix
  ```

### 4. Configuration or Diagnostic Issues
- **Fix**: Run `expo-doctor` to run a 20-point diagnostic check on dependencies, app config, and assets:
  ```bash
  npx expo-doctor
  ```

### 5. TypeScript Errors
- **Fix**: Run the TypeScript compiler in no-emit mode to find any syntax or typing mismatches:
  ```bash
  npx tsc --noEmit
  ```
