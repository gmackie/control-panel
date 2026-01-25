# GMAC Control Panel - Mobile App

React Native / Expo mobile companion app for the GMAC.IO Control Panel.

## App Icons

To update the app icons, replace the following files in `assets/`:

| File | Size | Purpose |
|------|------|---------|
| `icon.png` | 1024x1024 | Main app icon (iOS & Android) |
| `adaptive-icon.png` | 1024x1024 | Android adaptive icon foreground |
| `splash.png` | 2048x2048 | Splash screen |
| `notification-icon.png` | 96x96 | Push notification icon (should be simple, monochrome for Android) |
| `favicon.png` | 48x48 | Web favicon |

**Requirements:**
- PNG format with transparency where appropriate
- `icon.png` should have no transparency (use solid background)
- `adaptive-icon.png` should be the foreground only - background color set in `app.config.js`
- `notification-icon.png` should be simple silhouette for Android compatibility

## Features

- Real-time dashboard with system health overview
- Push notifications for alerts and deployments
- Application status monitoring
- Quick actions for common operations

## Prerequisites

- Node.js 20+
- pnpm 9+
- Expo CLI (`npm install -g expo-cli`)
- iOS Simulator (Mac) or Android Emulator
- Expo Go app on physical device (for quick testing)

## Setup

```bash
# From repository root
cd apps/mobile

# Install dependencies (if not already done at root)
pnpm install

# Start Expo development server
pnpm start
```

## Development

### Running on Simulators

```bash
# iOS Simulator (Mac only)
pnpm ios

# Android Emulator
pnpm android
```

### Running on Physical Device

1. Install "Expo Go" from App Store / Play Store
2. Run `pnpm start`
3. Scan the QR code with your device

### Development Client

For full native functionality (push notifications, etc.), use the Expo dev client:

```bash
# Build development client
npx eas build --profile development --platform ios
npx eas build --profile development --platform android

# Run with dev client
pnpm start --dev-client
```

## Project Structure

```
apps/mobile/
├── src/
│   ├── components/     # Reusable UI components
│   ├── hooks/          # Custom React hooks
│   ├── lib/            # Utilities and API client
│   └── screens/        # Screen components
├── assets/             # Images and static assets
├── app.config.js       # Expo configuration
└── App.tsx             # Root component
```

## App Variants

The app supports two variants configured in `app.config.js`:

| Variant | Bundle ID | Description |
|---------|-----------|-------------|
| Development | `com.gmacko.controlroom.dev` | Dev client with debugging |
| Production | `com.gmacko.controlroom` | App Store / Play Store release |

Set `APP_VARIANT=development` for development builds.

## Push Notifications

Push notifications require:
1. Physical device (not simulator)
2. Expo dev client or production build
3. Backend configured with `EXPO_ACCESS_TOKEN`

The app registers for push tokens on startup and receives notifications for:
- System alerts (critical, warning)
- Deployment status changes
- Service health changes

## Build Profiles

| Profile | Type | Distribution | Use Case |
|---------|------|--------------|----------|
| `development` | Dev Client | Internal (Ad-hoc) | Developer devices with hot reload |
| `simulator` | Dev Client | Internal | iOS Simulator |
| `production` | Release | Store | TestFlight / App Store |

### Development Build

For developer devices with Expo dev client:

```bash
# iOS - requires device UDIDs registered
npx eas build --profile development --platform ios

# Android APK
npx eas build --profile development --platform android

# After installing, run the dev server
pnpm start --dev-client
```

### Simulator Build

```bash
npx eas build --profile simulator --platform ios
```

### Production Build (TestFlight)

```bash
# Build and submit to TestFlight
npx eas build --profile production --platform ios
npx eas submit --profile production --platform ios

# Android Play Store
npx eas build --profile production --platform android
npx eas submit --profile production --platform android
```

## Environment

The mobile app connects to the control panel API. Configure the API URL:

- Development: Uses Expo's tunneling or local network
- Production: Set in `src/lib/trpc.ts`

## Troubleshooting

### Push notifications not working
- Ensure you're on a physical device
- Check `EXPO_ACCESS_TOKEN` is set on backend
- Verify notification permissions are granted

### API connection issues
- Check network connectivity
- Verify API URL is accessible
- Check for CORS issues if using web

### Build failures
- Run `npx expo doctor` to check for issues
- Clear cache: `npx expo start --clear`
- Reinstall node_modules: `rm -rf node_modules && pnpm install`
