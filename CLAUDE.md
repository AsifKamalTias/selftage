# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Project

`selftage` is an Expo SDK 57 app (React Native 0.86, React 19.2, TypeScript, strict mode). It was created from the `create-expo-app` default template and still contains mostly template code. It targets iOS, Android, and web (static output). Expo APIs differ from older SDKs, so check the v57 docs linked in AGENTS.md rather than relying on memory.

## Commands

```bash
npm install
npm start               # expo start (dev server; press a / i / w to open Android / iOS / web)
npm run android         # expo start --android
npm run ios             # expo start --ios
npm run web             # expo start --web
npx tsc --noEmit        # type check (currently passes)
npm run lint            # expo lint (no ESLint config is committed yet; the first run installs and configures eslint-config-expo)
```

There is no test runner set up (no Jest). Expo's guide is "Unit Testing with Jest".

`npm run reset-project` is destructive. It moves `src/` and `scripts/` into `/example` (gitignored), or deletes them, then scaffolds a blank `src/app`. Don't run it unless asked.

`/ios` and `/android` are gitignored because the project uses Continuous Native Generation. Make native configuration changes in `app.json` (config plugins), not in generated native folders.

## Architecture

- **Routing:** expo-router, with `"main": "expo-router/entry"` in `package.json`. Routes live in `src/app/`, not `app/` as the README says. Put only screens and layouts there. Other code goes elsewhere under `src/`.
- **Experiments enabled in `app.json`:**
  - `typedRoutes`: route types are generated into `.expo/types/router.d.ts`, so `href` values are type-checked.
  - `reactCompiler`: manual `useMemo`/`useCallback` is generally unnecessary.
- **Path aliases** (`tsconfig.json`): `@/*` → `src/*` and `@/assets/*` → `assets/*`.
- **Platform-specific files:** Metro resolves `*.web.tsx` / `*.web.ts` over the base file on web. Several modules have both variants, and a change to one usually needs a matching change to the other:
  - `src/components/app-tabs.tsx`: native tabs via `NativeTabs` from `expo-router/unstable-native-tabs`.
  - `src/components/app-tabs.web.tsx`: custom headless tabs via `Tabs`/`TabList`/`TabTrigger` from `expo-router/ui`.
  - `src/components/animated-icon(.web).tsx`: the splash overlay is native-only; the web version returns `null` and uses a CSS module.
  - `src/hooks/use-color-scheme(.web).ts`: the web version returns `'light'` until hydration, which static rendering requires.
- **Adding a tab:** create the route file in `src/app/`, then add a trigger in both `app-tabs.tsx` and `app-tabs.web.tsx`. The root `src/app/_layout.tsx` wraps `<AppTabs />` in the navigation `ThemeProvider` and calls `SplashScreen.preventAutoHideAsync()`.
- **Theming** (`src/constants/theme.ts`):
  - `Colors.light` and `Colors.dark` must keep identical keys. `ThemeColor` is the intersection of both key sets.
  - `useTheme()` returns the active palette and treats `'unspecified'` as light.
  - `ThemedText` (`type`, `themeColor`) and `ThemedView` (`type` = a `ThemeColor` key used as the background) are the building blocks.
  - Use the `Spacing` scale, `MaxContentWidth`, and `BottomTabInset` (bottom padding for content under the native tab bar) for layout.
  - `theme.ts` imports `src/global.css`, which defines the CSS font variables used by `Fonts.web`.
- **Animation:** Reanimated 4 with `react-native-worklets`. Use `scheduleOnRN` from `react-native-worklets`, not the older `runOnJS`.
- **Platform checks:** the code uses both `Platform.OS` / `Platform.select` and `process.env.EXPO_OS`.
