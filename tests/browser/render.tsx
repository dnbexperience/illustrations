import { renderToString } from "react-dom/server";
import House from "../../src/react/buildings/house-family-home.js";
process.stdout.write(
  renderToString(
    <>
      <House title="First" />
      <House title="Second" />
    </>,
    { identifierPrefix: "test-" },
  ),
);
