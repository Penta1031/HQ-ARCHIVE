/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: { accent: "#e50000" },
      fontFamily: { pretendard: ["Pretendard Variable", "Pretendard", "sans-serif"] },
      keyframes: {
        "fade-in": { from: { opacity: 0, transform: "translateY(6px)" }, to: { opacity: 1, transform: "translateY(0)" } },
        "pop-in": { from: { opacity: 0, transform: "scale(.94)" }, to: { opacity: 1, transform: "scale(1)" } }
      },
      animation: { "fade-in": "fade-in .28s ease-out both", "pop-in": "pop-in .38s cubic-bezier(.2,.8,.2,1) both" }
    }
  },
  plugins: []
};
