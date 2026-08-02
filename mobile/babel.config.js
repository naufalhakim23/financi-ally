module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ["babel-preset-expo", { jsxImportSource: "nativewind", decorators: false }],
      "nativewind/babel",
    ],
    // WatermelonDB models need legacy decorators. Do NOT add
    // @babel/plugin-transform-class-properties here: it runs before Flow-strip
    // and turns RN's type-only fields (Event.js `+NONE: 0`) into real
    // assignments onto read-only prototype props -> "Cannot assign to
    // read-only property 'NONE'". babel-preset-expo already handles fields.
    plugins: [["@babel/plugin-proposal-decorators", { legacy: true }]],
    overrides: [
      {
        // Function (not string/RegExp) so Metro's filename-less cache-key pass
        // doesn't throw "Configuration contains string/RegExp pattern".
        test: (filename) => !!filename && !filename.includes("node_modules"),
        plugins: [
          ["@babel/plugin-transform-class-properties", { loose: true }],
          ["@babel/plugin-transform-private-methods", { loose: true }],
        ],
      },
    ],
  };
};
