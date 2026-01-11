# Gemini Project: Kapture

This document provides a high-level overview of the Kapture project, intended to be used as a reference for the Gemini AI assistant.

## Project Goal

The primary goal of the Kapture project is to create a browser extension that can record user interactions and translate them into automated scripts. This involves capturing events like clicks, keypresses, and navigation, and then generating code that can replay these actions.

## Key Directories

*   **`/extension`**: This is the core of the project, containing the source code for the Chrome extension.
    *   `manifest.json`: Defines the extension's properties, permissions, and components.
    *   `background.js`: The extension's service worker, handling background tasks and managing the extension's state.
    *   `content-script.js`: Injected into web pages to capture user interactions.
    *   `panel.js` & `panel.html`: The user interface for the extension's developer tools panel.
*   **`/server`**: Contains a Node.js server that the extension communicates with. This server is likely responsible for processing the captured events and generating the automation scripts.
*   **`/e2e`**: End-to-end tests for the project, ensuring that the extension and server work together as expected.
*   **`/website`**: Project documentation and website (GitHub Pages).
*   **`/test-app`**: A simple web application used for testing the Kapture extension.

## How it Works (Inferred)

1.  The user installs the Kapture Chrome extension.
2.  The user opens the browser's developer tools and selects the "Kapture" panel.
3.  The user starts a recording session.
4.  The `content-script.js` captures user interactions (clicks, keypresses, etc.) on the active tab.
5.  The captured events are sent to the `background.js` script.
6.  `background.js` communicates with the Node.js server in the `/server` directory.
7.  The server processes the events and generates an automation script.
8.  The generated script is displayed in the Kapture developer tools panel.

## Development & Testing

*   **Dependencies**: The project uses Node.js and has `package.json` files in the `/e2e` and `/server` directories.
*   **Testing**: End-to-end tests are located in the `/e2e` directory and can be run with `npm test` (inferred from the presence of `package.json` and a `test` directory).
*   **Building**: The extension can likely be built and packaged for release using the scripts in the `.github/workflows` directory.
