const path = require("path");

const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

// src/lib/{money,balances,…}.ts re-export shared-context/domain, which sits
// outside the Expo project root. Metro only reads files under projectRoot +
// watchFolders, and it will not follow a relative path out of the root, so the
// shared code is addressed as the package `@financially/domain` (mirrored by
// the matching path in tsconfig.json) and mapped here. The scope matters:
// Metro reads `@scope/name` as one package key, so a bare `@domain` alias
// would never match `@domain/money`.
const DOMAIN = path.resolve(__dirname, "../shared-context/domain");

const PREFIX = "@financially/domain/";

config.watchFolders = [DOMAIN];

const upstream = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName.startsWith(PREFIX)) {
    return { type: "sourceFile", filePath: path.join(DOMAIN, `${moduleName.slice(PREFIX.length)}.ts`) };
  }
  return (upstream ?? context.resolveRequest)(context, moduleName, platform);
};

// NOTE: Expo's on-demand filesystem truncates watchFolders down to projectRoot
// during `expo export` (@expo/cli withMetroMultiPlatform), which makes the
// domain files unreadable at bundle time even once they resolve. It is turned
// off in app.json → experiments.onDemandFilesystem, which is the only place
// that setting is read — setting it here has no effect.

module.exports = withNativeWind(config, { input: "./global.css" });
