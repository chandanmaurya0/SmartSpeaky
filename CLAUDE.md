# Claude Context for SmartSpeaky

## Project Overview

SmartSpeaky is an intelligent voice dictation desktop app (Electron) forked from ITO. It enables global voice-to-text in any application using AI transcription via a local gRPC server.

## Project Structure

```
SmartSpeaky/
├── app/                  # Electron renderer (React frontend)
│   ├── components/       # React components
│   ├── hooks/            # Custom React hooks
│   ├── store/            # Zustand state management
│   ├── styles/           # TailwindCSS styles
│   ├── utils/            # Frontend utilities
│   ├── media/            # Frontend media helpers
│   └── generated/        # Auto-generated protobuf types
├── lib/                  # Shared library (Electron main process)
│   ├── main/             # Main process logic (session, interactions, etc.)
│   ├── media/            # Audio/keyboard native interfaces
│   ├── preload/          # Preload scripts & IPC bridge
│   ├── auth/             # Authentication helpers
│   ├── clients/          # gRPC client implementations
│   ├── constants/        # Shared constants
│   ├── protocol/         # Protocol definitions
│   ├── types/            # Shared TypeScript types
│   ├── utils/            # Shared utilities
│   └── window/           # Window management
├── native/               # Native components (Rust/Swift)
│   ├── audio-recorder/   # Audio capture (Rust)
│   ├── global-key-listener/ # Keyboard events (Rust)
│   ├── text-writer/      # Text insertion (Rust)
│   ├── active-application/ # Active window detection (Rust)
│   ├── selected-text-reader/ # Selected text extraction (Rust)
│   ├── cursor-context/   # Cursor context (Swift)
│   └── macos-text/       # macOS-specific text handling (Swift)
├── server/               # gRPC transcription server
│   ├── src/              # Server implementation
│   │   ├── ito.proto     # Protocol buffer definitions
│   │   ├── clients/      # LLM provider clients (Groq, etc.)
│   │   ├── services/     # gRPC service implementations
│   │   ├── db/           # Database access
│   │   └── migrations/   # DB migrations
│   └── infra/            # AWS CDK infrastructure
├── scripts/              # Build and utility scripts
├── resources/            # Build resources & assets
└── build/                # Build configuration
```

## Branch

Main development branch: `dev`

## Development Commands

- Dev: `bun dev` (starts electron-vite dev with watch)
- Dev with Rust rebuild: `bun dev:rust` (builds Rust binaries then starts dev)
- Server: `docker compose up --build` (run from `server/` directory)
- Build app (macOS): `bun build:mac`
- Build app (Windows): `bun build:win`
- Build Rust binaries (macOS): `bun build:rust:mac`
- Build Rust binaries (Windows): `bun build:rust:win`
- Test: `bun runAllTests` (runs lib, server, app, and native tests)
  - Lib tests: `bun runLibTests`
  - Server tests: `bun runServerTests`
  - App tests: `bun runAppTests`
  - Native tests: `bun runNativeTests` (or see "Native Binary Tests" section)
- Lint:
  - TypeScript: `bun lint` (check) or `bun lint:fix` (fix)
  - Rust: `bun lint:native` (check) or `bun lint:fix:native` (fix)
- Type check: `bun type-check`
- Format:
  - TypeScript: `bun format` (check) or `bun format:fix` (fix)
  - Rust: `bun format:native` (check) or `bun format:fix:native` (fix)

## Native Binary Tests

The `native/` directory contains Rust binaries that power the app's core functionality. The modules are organized as a Cargo workspace, allowing you to test and build all modules with a single command.

### Running Tests

Test all native modules:

```bash
cd native
cargo test --workspace
```

Or use the npm script:

```bash
bun runNativeTests
```

Test a single module:

```bash
cd native/global-key-listener
cargo test
```

### Native Modules

- `global-key-listener` - Keyboard event capture and hotkey management (Rust)
- `audio-recorder` - Audio recording with sample rate conversion (Rust)
- `text-writer` - Cross-platform text input simulation (Rust)
- `active-application` - Active window detection (Rust)
- `selected-text-reader` - Selected text extraction (Rust)
- `cursor-context` - Cursor context detection (Swift, macOS)
- `macos-text` - macOS-specific text handling (Swift)

### Linting and Formatting

Rust code follows standard formatting and linting rules defined in `native/`:

- **rustfmt.toml** - Code formatting configuration (100 char width, Unix line endings)
- **clippy.toml** - Linter configuration (cognitive complexity threshold)
- **Cargo.toml** - Workspace-level lint rules (pedantic + nursery warnings)

Run checks locally:

```bash
# Check formatting
bun format:native

# Auto-fix formatting
bun format:fix:native

# Check lints
bun lint:native

# Auto-fix lints (where possible)
bun lint:fix:native
```

### CI/CD

Native tests and builds are integrated into the existing CI workflows:

**Tests** (`.github/workflows/test-runner.yml`):

- Unit tests run on macOS runner (OS-agnostic tests)
- Runs automatically via `bun runAllTests` on all pushes and PRs
- Executed as part of the main CI controller workflow

**Compilation Checks** (`.github/workflows/native-build-check.yml`):

- macOS: Verifies compilation for x86_64 and aarch64 architectures
- Windows: Verifies cross-compilation for x86_64-pc-windows-gnu
- Runs automatically on all pushes and PRs via the CI controller
- Ensures binaries compile correctly for both platforms before merging

## Code Style Preferences

- Keep code as simple as possible
- Don't create overly long files
- Group related code into useful, well-named functions
- Prefer clean, readable code over complex solutions
- Follow existing patterns and conventions in the codebase
- Always prefer console commands over log commands. E.g. use `console.log` instead of `log.info`.

## Tech Stack

**Client (Electron app)**

- TypeScript, Bun
- Electron + electron-vite
- React 19, TailwindCSS v4, Zustand, Framer Motion
- gRPC (connectrpc) with Protocol Buffers
- SQLite (local storage), electron-store (settings)
- Auth0 (authentication), Sentry (error tracking)

**Server**

- TypeScript, Bun
- gRPC (Protocol Buffers via `ito.proto`)
- PostgreSQL (via Docker), database migrations
- Various LLM providers (Groq, etc.)
- AWS CDK for infrastructure

**Native Components**

- Rust (audio recording, keyboard events, text insertion, window detection)
- Swift (macOS cursor context and text handling)
