# Eufemia illustrations

Token-based React illustrations from the [Eufemia Illustrations Figma library](https://www.figma.com/design/dgJbK9h01WK6JsnFEozlFKYO/Eufemia---Illustrations?node-id=3514-0), with foundation palettes for DNB, Sbanken, DNB Eiendom and DNB Carnegie.

## Use the library

After the first release, install with npm install @eufemia/illustrations. To try the package before publication, run npm ci, npm run build and npm pack, then install the tarball.

```tsx
import "@eufemia/illustrations/styles.css";
import HouseFamilyHome from "@eufemia/illustrations/react/buildings/house-family-home";

<HouseFamilyHome title="Your home" brand="sbanken" width={320} />;
<HouseFamilyHome decorative width={160} />;
```

Use a title for meaningful artwork, or decorative when adjacent content conveys its meaning. Each SVG uses instance-scoped IDs for masks, clips and titles. SSR and hydration use React useId; independent roots should use distinct identifierPrefix values consistently on the server and client.

Import an individual component for the smallest bundle. The React entry point also provides named exports and IllustrationProvider:

```tsx
import { IllustrationProvider } from "@eufemia/illustrations/react";

<IllustrationProvider brand="sbanken" surface="dark">
  <HouseFamilyHome title="Your home" />
</IllustrationProvider>;
```

Explicit component props override provider defaults. Brand selection is explicit; connect your application's theme to the provider. Carnegie supports light surfaces only. Width and height props preserve aspect ratio by default.

The library is the distribution channel. It contains compiled components, CSS and a manifest of imports, dimensions, Figma pages, material roles and supported surfaces. Build-only source artwork is excluded from the package. The docs do not offer file downloads or raw artwork comparisons.

## Foundation colors

Material roles such as wall-front, roof, upholstery and foliage reference named foundation colors. Foundation snapshots live in tokens/*.json; role mappings contain variable names, not hex assignments. The shared stylesheet provides low-specificity foundation defaults so Eufemia applications can supply their own foundation values.

DNB and Sbanken names match Eufemia's runtime foundations. Carnegie uses the nine named colors in the [documented brand palette](https://eufemia.dnb.no/web/styling-and-themes/legacy-colors#dnb-carnegie-colors), exposed as --ca-color-* properties, plus white. Its visible roles, including skin and foliage, use these colors; mask luminance values remain unchanged. Eiendom foundations come from Eufemia's exported color.tokens.json and are included here because its current runtime theme still imports DNB UI foundations. Brand-owner approval is still required for the proposed illustration palettes.

The expanded collection uses foundation-normalized palette roles alongside the seven individually mapped examples. Human skin-tone variants use skin-light, skin-medium and skin-dark roles. Each brand maps these roles to its own foundations: DNB coldgreen, Sbanken purple, Eiendom emeraldgreen and Carnegie green. Older bulk mappings are not fully semantic: some shapes with the same source hex share a role even when they represent different materials. They remain explicit to preserve the reviewed appearance. Validation rejects visible roles referencing another brand. Masks retain their original luminance and are exempt from the visible-color rule. Embedded raster details remain fixed; their pixels cannot respond to tokens.

## Collection and Figma synchronization

The inventory covers Approved illustrations, Components and Human library. Page and source status are exposed in the manifest and docs. Work-in-progress artwork is excluded from both the docs and package. Cover art, usage examples, team information, annotations and board decoration are not library illustrations.

There are 590 component entries. The coverage report records duplicate exports, four components without visible exportable layers, the excluded work-in-progress page, and the excluded numbered backdrops and white-only cloud components. .figma/coverage.json records the source node for each inclusion or exception. Similar artwork with different geometry, skin tones or compositions remains a separate entry.

The Background collection includes six Splash components from Figma. These are decorative backdrop shapes for composing illustrations.

figma.config.json contains stable package names, source nodes and explicit paint mappings. A changed, new or missing paint fails synchronization until its mapping is reviewed. New source nodes are discovered during synchronization and staged as color proposals before they can be distributed. Raw source SVGs under sources/ are build inputs, not public assets.

Run the manual Sync illustrations from Figma workflow with a dedicated read-only FIGMA_TOKEN repository secret. It pins a source version, validates the configured exports, generates optimized components and proposes a review PR with a token-based review catalog. It also uploads a separate new-illustration-proposals artifact, including when configured artwork is unchanged. Review artwork, names, page/status metadata, palette assignments and supported surfaces before merging.

### New illustrations and hex colors

Figma supports shared paint styles and bound variables, and this file contains both. Many illustration layers, especially in Human library, use unbound colors. The SVG export supplies concrete paint values. Token conversion therefore works from those values and the layer context; it does not depend on designers adopting variables first.

To discover new artwork locally, set FIGMA_TOKEN and run npm run discover:figma. Discovery walks configured approved/component pages in small, version-pinned requests. It finds new components and frames with SVG export settings, skips instances and previously recorded exclusions/duplicates, and writes .figma-review/index.html and report.json. Reviewed container boards remain traversable so new artwork inside them can be discovered. New pages, plain groups and frames without SVG export settings require an explicit configuration/export decision. Discovery never changes Figma, the package, committed sources or existing mappings.

New proposals use eight reusable material groups, each with foundation assignments for every brand:

| Material             | Roles                                                                |
| -------------------- | -------------------------------------------------------------------- |
| Skin                 | skin-light, skin-medium, skin-dark                                   |
| Hair                 | hair-light, hair, hair-dark                                          |
| Clothing             | clothing-light, clothing, clothing-dark, clothing-accent             |
| Foliage              | foliage-light, foliage, foliage-medium, foliage-shadow, foliage-dark |
| Surfaces             | surface-light, surface, surface-shade, surface-dark                  |
| Outlines and details | outline                                                              |
| Highlights           | highlight                                                            |
| Accents              | accent-light, accent, accent-dark                                    |

Layer names such as Face, Hair, Shirt and Leaf select a material group, including context inherited from a parent group. A more specific child name overrides its parent. Within that group, source colors select exact matches or deterministic nearest-color suggestions in OKLab, weighted toward lightness. Anonymous Vector layers remain generic palette suggestions. A matching hex cannot prove that two shapes represent the same material. Reviewers assign the correct material when names are missing or misleading. New artwork normally reuses these roles; add a role only when an existing one cannot express its visual purpose. Existing mappings and colors stay unchanged when new artwork is discovered.

The report distinguishes exact color matches, nearest-color suggestions and unresolved paints. It flags color pairs that lose distinction, masks without an exact preserved tone, compositing effects and embedded rasters. Pairwise contrast ignores geometry, opacity and adjacency. It is a review heuristic, not a WCAG check or a guarantee of visual quality. Brand palette membership is automatic; brand-owner approval of faces and compositions still requires review.

Serve .figma-review over HTTP to compare the Figma source with the proposed brand previews. Review and edit source.name, source.slug, source.category, source.original and source.paints in report.json; source.original must match sources/<category>/<slug>.svg. Resolve every paint and inspect each brand/surface. Then explicitly import selected candidates with npm run import:figma -- 123:456. This validates mappings and source hashes and renders the complete batch before writing sources, configuration, coverage, the source lock and generated output. Invalid artwork leaves those files unchanged. Run npm run ci and npm run test:browser before committing. Import does not publish or push. To exclude a candidate, record its node ID, page ID and reason in .figma/coverage.json instead. Regenerating proposals replaces .figma-review, so import or save reviewed edits before another discovery.

Existing illustrations keep their exact reviewed paint mappings. A changed paint still stops synchronization; nearest-color suggestions never silently replace an existing mapping.

The initial source exports came through the Figma MCP session. Figma REST can produce different IDs, geometry and bounds for the same artwork. The source lock records both the approved build input hash (sha256) and its reviewed REST export fingerprint (exportSha256). An unchanged REST export retains the approved build input, which is independently hash-checked and paint-validated. A changed export goes through the normal mapping validation and review process. REST exports preserve stroke geometry and include visible artwork bounds. Ordinary builds and releases use committed sources and never fetch Figma.

## Optimization

Generation uses SVGO 4, the engine behind [SVGOMG](https://jakearchibald.github.io/svgomg/). Multipass optimization runs after paint mapping, removes unused metadata and IDs, simplifies path data and preserves dimensions, viewBox, opacity, masks and token references. .figma/optimization.json records SVG sizes before and after optimization. Embedded raster details are compressed independently.

The documentation lazy-loads components and uses Eufemia InfinityScroller to load more entries as people scroll. Consumers importing one component do not bundle the remaining artwork.

Numbered component families share one catalog card. Families are detected from source names ending in -01, -02 or a space followed by a number, within the same Figma page and category. Scenes and generated slug suffixes remain separate. The dialog lists each variant with its own package import; searching for a variant still finds its family.

## Documentation

Run npm ci, then npm run dev. The terminal prints the local URL. The docs use a compact Eufemia thumbnail grid with infinite scrolling and system light/dark mode. Brand and surface toggle buttons stay visible in the sticky header and update loaded previews without resetting the grid or scroll position. Additional filters are collapsed initially. Filter by name, category, Figma page or source status. Select an illustration to open its previews, foundation assignments and package import in a dialog.

npm run site:check builds and verifies .pages for GitHub Pages. npm run preview creates a copy in .review; serve that folder over HTTP. The Pages workflow deploys merged main revisions to [dnbexperience.github.io/illustrations](https://dnbexperience.github.io/illustrations/). A draft PR does not deploy or release.

Documentation HTML includes noindex, nofollow, noimageindex and nosnippet directives. The build verifies them before deployment. Keep the HTML crawlable so search engines can read noindex; blocking it in robots.txt can leave URLs in search results. These directives apply to cooperating crawlers, not access control. The public GitHub repository and npm package remain discoverable. Restricted hosting is required to guarantee that content is unavailable to search engines.

## Validation and release

npm run ci checks formatting, lint, types, source/mapping safety, generated output, React rendering, the static catalog and a packed consumer build. npm run test:browser checks filtering, token updates, system dark mode, library-only distribution and repeated SSR/hydrated masks. Install Chromium with npm exec playwright install chromium when needed.

npm run release:check exercises the npm publishing lifecycle without publishing. CI and release validation run it before publication. The prepack hook verifies generated files and builds the package; the complete validation runs separately before the publishing job receives credentials.

The Release workflow validates main with package and browser checks, then transfers the validated build to a separate publishing job. It uses semantic-release and npm Trusted Publishing (OIDC), with provenance and no stored npm token. Publishing runs in the npm-release environment with npm lifecycle scripts disabled. It creates a version tag and GitHub release and verifies package availability. Releases queue and never cancel an active publication. No Figma access is used during releases.

Before the first production release:

- The @eufemia/illustrations package is staged publicly at 0.0.0-stage. Verify ownership and publishing access before releasing.
- Configure its npm trusted publisher for owner dnbexperience, repository illustrations, workflow release.yml, environment npm-release. Allow npm publish for automatic releases. The first successful publish must occur within two days of creating the trust configuration.
- Require two-factor authentication and disallow traditional token publishing in npm package settings.
- Restrict the npm-release GitHub environment to main and protect main with Validate package.
- Squash merge with the Conventional Commit PR title as the commit subject. A plain implementation commit message does not trigger a release.
- Complete the Figma credential setup and live synchronization check below.

### Figma credential setup

Create a dedicated [Figma personal access token](https://developers.figma.com/docs/rest-api/personal-access-tokens/) with only file_content:read. The account must have access to the configured illustration file. This scope covers file nodes and image exports; variable access and write scopes are unnecessary. Set an appropriate expiry, record its owner and renewal date internally, and rotate it before expiry.

Store it as the FIGMA_TOKEN repository Actions secret in [GitHub settings](https://github.com/dnbexperience/illustrations/settings/secrets/actions). For a token saved in a local file, use gh secret set FIGMA_TOKEN --repo dnbexperience/illustrations < /path/to/token. Do not put credentials in configuration, artifacts, committed files or chat. The workflow passes the secret only to its Figma fetch step. Package builds, Pages and releases use committed sources without the token.

Before enabling production synchronization, verify live node access and SVG export with the dedicated token, then run npm run discover:figma and inspect the proposals. Run the first full synchronization in a clean checkout and review its diff across all brands. The initial MCP exports may differ from REST exports; paint changes must be reviewed before import. A missing, expired or unauthorized token fails the workflow without publishing changes.

The manual CI workflow has a Validate live Figma synchronization option. Select the intended branch to test the repository secret, discovery, all configured exports and the regenerated package in a disposable checkout. Its live-figma-review artifact contains proposals, a source patch and the visual review catalog. This check never commits or publishes its results.

Removed imports, renamed imports and removed material roles are breaking changes. Use the Conventional Commit PR title when squash merging sync changes so semantic-release classifies them correctly. Never commit credentials.

## License

Copyright © DNB Bank ASA. Only DNB employees may use these illustrations in DNB applications. Use by anyone else is not permitted. The software license applies separately to the library tooling and implementation code. See [LICENSE](./LICENSE).
