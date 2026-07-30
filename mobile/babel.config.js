module.exports = function (api) {
  api.cache(true);
  return {
    // babel-preset-expo ~57 auto-applies @babel/plugin-proposal-decorators
    // { legacy: true } (its lazyDecoratorsPlugin) — that's all WatermelonDB
    // 0.28's runtime decorators (@field/@action/@readonly) need. The old
    // "@nozbe/watermelondb/babel-plugin" subpath was removed in 0.28.
    presets: [
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
      "nativewind/babel",
    ],
    plugins: [],
  };
};

