/** Colors read from nuancebylcove.com theme CSS (--bg, --bone, --bubble, --scan, --brand-red, #ff3d49). */
export const NUANCE = {
  bg: "#08080a",
  bgBanned: "#1a0608",
  bone: "#ece7dc",
  boneDim: "#b9b4a8",
  faint: "#4b483f",
  bubble: "#ff9fc8",
  bubbleSoft: "#ffd6e8",
  scan: "#79c3cf",
  brand: "#c4142d",
  alert: "#ff3d49",
};

export function rgb(hex) {
  const n = Number.parseInt(hex.slice(1), 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
}

export function passColors(status) {
  const banned = String(status || "").toLowerCase() === "banned";
  return {
    backgroundColor: rgb(banned ? NUANCE.bgBanned : NUANCE.bg),
    foregroundColor: rgb(NUANCE.bone),
    labelColor: rgb(banned ? NUANCE.alert : NUANCE.bubble),
  };
}
