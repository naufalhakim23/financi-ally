/** @type {import('tailwindcss').Config} */
module.exports = {
  // M0: no token theme yet — DESIGN.md lands in M7. NativeWind is wired so M3+
  // screens can use classNames; this config is the place the token scale mirros
  // DESIGN.md when it exists.
  content: ["./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {},
  },
  plugins: [],
};
