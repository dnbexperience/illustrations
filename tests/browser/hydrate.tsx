import { hydrateRoot, createRoot } from "react-dom/client";
import { useEffect } from "react";
import House from "../../src/react/buildings/house-family-home.js";
function Fixture() {
  useEffect(() => {
    document
      .querySelector("#hydration-root")
      ?.setAttribute("data-hydrated", "true");
  }, []);
  return (
    <>
      <House title="First" />
      <House title="Second" />
    </>
  );
}
export function hydrateFixture() {
  hydrateRoot(document.querySelector("#hydration-root")!, <Fixture />, {
    identifierPrefix: "test-",
  });
}
export function renderSizingFixture() {
  const root = document.createElement("div");
  root.id = "sizing-root";
  document.body.append(root);
  createRoot(root).render(<House title="Sizing" height={100} />);
}
