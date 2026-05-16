# ICDV Mobile Operations App

Flutter 3.41.5 · Riverpod · GoRouter · Dio

## Setup

```bash
# 1. Install dependencies
flutter pub get

# 2. Copy logo asset
cp /path/to/web/public/images/logo/logo.png assets/images/logo.png

# 3. Update API base URL in:
#    lib/core/api/api_client.dart → const kBaseUrl
#    Change 10.0.2.2 to your server IP for physical device testing

# 4. Run
flutter run
```

## Project Structure

```
lib/
  core/
    api/         api_client.dart, workflow_api.dart
    models/      models.dart
    providers/   auth_provider.dart
    router/      app_router.dart
    theme/       app_theme.dart
    utils/       widgets.dart (shared reusable widgets)
  features/
    auth/screens/  splash_screen.dart, login_screen.dart
    home/          home_screen.dart
    discharge/     discharge_screen.dart
    batch/         batch_screen.dart
    transfer/      transfer_screen.dart
    receive/       receive_screen.dart
    search/        search_screen.dart
    profile/       profile_screen.dart
```

## API Base URL

| Environment        | URL                             |
|--------------------|---------------------------------|
| Android Emulator   | `http://10.0.2.2:3000/api/v1`  |
| Physical Device    | `http://<your-LAN-IP>:3000/api/v1` |
| Production         | `https://your-api-domain.com/api/v1` |

## Features

- Login / session restore
- Discharge (Vessel → Holding Ground)
- Batch Process (Holding Ground → Batch)
- TPA Transfer (Batch → In Transit)
- Yard Receiving (In Transit → ICDV Yard)
- Chassis Search + operation history
- Profile / logout
