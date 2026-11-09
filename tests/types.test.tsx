import House from "../src/react/buildings/house-family-home.js";
// @ts-expect-error Meaningful artwork needs an accessible title.
const missing = <House />;
// @ts-expect-error Decorative artwork must not expose a title.
const conflict = <House decorative title="Home" />;
// @ts-expect-error Only supported brands are accepted.
const unsupported = <House title="Home" brand="other" />;
void [missing, conflict, unsupported];
