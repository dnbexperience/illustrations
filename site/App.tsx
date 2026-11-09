import {
  createContext,
  useContext,
  useMemo,
  useState,
  Suspense,
  type ComponentType,
} from "react";
import Anchor from "@dnb/eufemia/components/anchor/Anchor.js";
import Accordion from "@dnb/eufemia/components/accordion/Accordion.js";
import CopyOnClick from "@dnb/eufemia/components/copy-on-click/CopyOnClick.js";
import Card from "@dnb/eufemia/components/card/Card.js";
import Dialog from "@dnb/eufemia/components/dialog/Dialog.js";
import ToggleButton from "@dnb/eufemia/components/toggle-button/ToggleButton.js";
import type { ToggleButtonGroupChangeEvent } from "@dnb/eufemia/components/toggle-button/group-types.js";
import InfinityScroller from "@dnb/eufemia/components/pagination/InfinityScroller.js";
import type { PaginationEvent } from "@dnb/eufemia/components/pagination/types.js";
import FilterActiveFilters from "@dnb/eufemia/components/filter/FilterActiveFilters.js";
import FilterContent from "@dnb/eufemia/components/filter/FilterContent.js";
import FilterHeader from "@dnb/eufemia/components/filter/FilterHeader.js";
import FilterNoResults from "@dnb/eufemia/components/filter/FilterNoResults.js";
import FilterPanel from "@dnb/eufemia/components/filter/FilterPanel.js";
import FilterPanelButton from "@dnb/eufemia/components/filter/FilterPanelButton.js";
import FilterResultCount from "@dnb/eufemia/components/filter/FilterResultCount.js";
import FilterRoot from "@dnb/eufemia/components/filter/FilterRoot.js";
import FilterSearch from "@dnb/eufemia/components/filter/FilterSearch.js";
import FilterSelection from "@dnb/eufemia/components/filter/FilterSelection.js";
import FilterToolbar from "@dnb/eufemia/components/filter/FilterToolbar.js";
import { useFilter } from "@dnb/eufemia/components/filter/hooks/useFilter.js";
import Flex from "@dnb/eufemia/components/flex/Flex.js";
import Grid from "@dnb/eufemia/components/grid/Grid.js";
import Space from "@dnb/eufemia/components/space/Space.js";
import Table, { Th, Td } from "@dnb/eufemia/components/table/Table.js";
import Theme from "@dnb/eufemia/shared/Theme.js";
import H1 from "@dnb/eufemia/elements/H1.js";
import H2 from "@dnb/eufemia/elements/H2.js";
import P from "@dnb/eufemia/elements/P.js";
import manifestData from "../manifest.json" with { type: "json" };
import dnb from "../tokens/dnb.json" with { type: "json" };
import sbanken from "../tokens/sbanken.json" with { type: "json" };
import eiendom from "../tokens/eiendom.json" with { type: "json" };
import carnegie from "../tokens/carnegie.json" with { type: "json" };
import type { IllustrationProps } from "../src/react/index.js";
import generatedComponents from "./components.generated.js";
import {
  brands,
  type IllustrationBrand,
  type IllustrationEntry,
  type IllustrationManifest,
  type IllustrationSurface,
} from "../src/types.js";
import {
  filterIllustrations,
  groupIllustrations,
  type IllustrationGroup,
  getCategories,
  selectedValues,
} from "./catalogue.js";

const manifest = manifestData as IllustrationManifest;
const palettes = { dnb, sbanken, eiendom, carnegie };
const CatalogueContext = createContext<{
  brand: IllustrationBrand;
  surface: IllustrationSurface;
  groups: IllustrationGroup[];
  onSelect: (group: IllustrationGroup) => void;
} | null>(null);
const components: Record<
  string,
  ComponentType<IllustrationProps>
> = generatedComponents;
const filterId = "illustration-catalogue";
const links = {
  repository: "https://github.com/dnbexperience/illustrations",
  package: "https://www.npmjs.com/package/@eufemia/illustrations",
  manifest: "./manifest.json",
  license: "./LICENSE",
  readme: "https://github.com/dnbexperience/illustrations#readme",
  figma:
    "https://www.figma.com/design/dgJbK9h01WK6JsnFEozlFKYO/Eufemia---Illustrations?node-id=3514-0",
};
const publishedAt = new Date(__PUBLISHED_AT__);
const publishedDate = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "long",
  timeZone: "Europe/Oslo",
}).format(publishedAt);
const componentName = (slug: string) =>
  slug
    .split("-")
    .map((s) => s[0]!.toUpperCase() + s.slice(1))
    .join("");

function Preview({
  entry,
  brand,
  surface,
  compact = false,
}: {
  entry: IllustrationEntry;
  brand: IllustrationBrand;
  surface: IllustrationSurface;
  compact?: boolean;
}) {
  const Component = components[entry.slug]!;
  const palette = palettes[brand];
  const background =
    surface === "dark" && "dark" in palette.surfaces
      ? palette.surfaces.dark
      : palette.surfaces.light;
  return (
    <Theme colorScheme={surface} surface={surface}>
      <figure
        className={
          "illustration-preview illustration-preview--" +
          surface +
          (compact ? " illustration-preview--compact" : "")
        }
        style={{ background: "var(" + background + ")" }}
      >
        <Suspense fallback={<P size="small">Loading</P>}>
          <Component
            {...(compact
              ? { decorative: true as const }
              : { title: entry.name + ", " + palette.name + " " + surface })}
            brand={brand}
            surface={surface}
          />
        </Suspense>
      </figure>
    </Theme>
  );
}

function Variant({
  entry,
  brand,
}: {
  entry: IllustrationEntry;
  brand: IllustrationBrand;
}) {
  const palette = palettes[brand];
  const visibleSurfaces = entry.supportedSurfaces[brand];
  if (!visibleSurfaces.length) {
    return null;
  }
  return (
    <section aria-label={entry.name + " " + palette.name}>
      <P size="small" bottom="x-small">
        {palette.name}
      </P>
      <Grid.Container
        columns={{ small: 1, medium: 2, large: 2 }}
        columnGap="x-small"
        rowGap="x-small"
      >
        {visibleSurfaces.map((surface, index) => (
          <Grid.Item
            key={surface}
            span={{
              small: "full",
              medium: [index + 1, index + 1],
              large: [index + 1, index + 1],
            }}
          >
            <Preview entry={entry} brand={brand} surface={surface} />
          </Grid.Item>
        ))}
      </Grid.Container>
      {brand === "carnegie" && (
        <P size="small" top="x-small">
          Light surface only
        </P>
      )}
    </section>
  );
}

function IllustrationDetails({
  entry,
  brand,
}: {
  entry: IllustrationEntry;
  brand: IllustrationBrand;
}) {
  const palette = palettes[brand];
  const refs: Record<string, string> = palette.roles;
  const dark: Record<string, string> = palette.darkRoles;
  const importStatement =
    "import " +
    componentName(entry.slug) +
    ' from "@eufemia/illustrations/react/' +
    entry.category +
    "/" +
    entry.slug +
    '";';
  return (
    <Flex.Vertical layoutEngine="css" align="stretch" gap={false}>
      <Space top="small">
        <Variant entry={entry} brand={brand} />
      </Space>
      <Accordion top="small" variant="tertiary" title="Details and import">
        <Flex.Vertical layoutEngine="css" align="stretch" gap="small">
          <Flex.Horizontal gap="x-small" align="center">
            <P size="small">{entry.page}</P>
          </Flex.Horizontal>
          <Flex.Horizontal align="flex-start" justify="space-between" wrap>
            <P size="small">{entry.slug}</P>
            <P size="small">{entry.category}</P>
          </Flex.Horizontal>
          <Flex.Horizontal
            layoutEngine="css"
            align="center"
            gap="x-small"
            wrap={false}
          >
            <pre className="dnb-pre illustration-import">
              <code>{importStatement}</code>
            </pre>
            <CopyOnClick.Button
              title="Copy import"
              size="small"
              copyContent={importStatement}
            />
          </Flex.Horizontal>
          <P size="small">Foundation assignments</P>
          <Table.ScrollView className="illustration-foundations">
            <Table
              size="small"
              outline
              border="horizontal"
              aria-label="Foundation assignments"
            >
              <thead>
                <tr>
                  <Th scope="col">Material role</Th>
                  <Th scope="col">Light</Th>
                  {palette.supportedSurfaces.includes("dark") && (
                    <Th scope="col">Dark</Th>
                  )}
                </tr>
              </thead>
              <tbody>
                {entry.roles
                  .filter((role) => role !== "mask")
                  .map((role) => (
                    <tr key={role}>
                      <Th scope="row">{role}</Th>
                      <Td>
                        <code>{refs[role]}</code>
                      </Td>
                      {palette.supportedSurfaces.includes("dark") && (
                        <Td>
                          <code>{dark[role] ?? refs[role]}</code>
                        </Td>
                      )}
                    </tr>
                  ))}
              </tbody>
            </Table>
          </Table.ScrollView>
        </Flex.Vertical>
      </Accordion>
    </Flex.Vertical>
  );
}

const chunkSize = 48;

function IllustrationPage({ pageNumber }: { pageNumber: number }) {
  const { groups, onSelect, brand, surface } = useContext(CatalogueContext)!;
  return (
    <Grid.Container
      columns={{ small: 2, medium: 4, large: 6 }}
      rowGap="x-small"
      columnGap="x-small"
      top={pageNumber > 1 ? "x-small" : undefined}
    >
      {groups
        .slice((pageNumber - 1) * chunkSize, pageNumber * chunkSize)
        .map((group, index) => (
          <Grid.Item
            className="catalogue-item"
            key={group.id}
            span={{
              small: [(index % 2) + 1, (index % 2) + 1],
              medium: [(index % 4) + 1, (index % 4) + 1],
              large: [(index % 6) + 1, (index % 6) + 1],
            }}
          >
            <Card.Action
              responsive={false}
              innerSpace="x-small"
              onClick={() => onSelect(group)}
            >
              <Preview
                entry={group.entries[0]!}
                brand={brand}
                surface={surface}
                compact
              />
              <P
                className="illustration-name"
                size="small"
                top="x-small"
                title={group.name}
              >
                {group.name}
              </P>
              {group.entries.length > 1 && (
                <P size="small">{group.entries.length} variants</P>
              )}
            </Card.Action>
          </Grid.Item>
        ))}
    </Grid.Container>
  );
}

// InfinityScroller replaces the current page when its children change identity.
const firstPage = <IllustrationPage pageNumber={1} />;

export default function App() {
  const [brand, setBrand] = useState<IllustrationBrand>("dnb");
  const [surface, setSurface] = useState<IllustrationSurface>("light");
  const [selectedGroup, setSelectedGroup] = useState<IllustrationGroup | null>(
    null,
  );
  const [detailsOpen, setDetailsOpen] = useState(false);
  const { filters, search } = useFilter(filterId);
  const categories = useMemo(() => getCategories(manifest.illustrations), []);
  const selectedCategories = selectedValues(filters, "category");
  const entries = filterIllustrations(manifest.illustrations, {
    pages: selectedValues(filters, "page"),
    statuses: selectedValues(filters, "status"),
    query: "",
    categories: selectedCategories,
    brands: [],
    surfaces: [],
  });
  const groups = groupIllustrations(entries).filter(
    (group) =>
      filterIllustrations(group.entries, {
        query: search,
        categories: [],
        brands: [],
        surfaces: [],
      }).length > 0,
  );
  const contentKey = JSON.stringify([
    search,
    selectedCategories,
    selectedValues(filters, "page"),
    selectedValues(filters, "status"),
  ]);
  return (
    <Theme colorScheme="auto" className="app-theme">
      <Space
        element="header"
        className="page-width"
        innerSpace={{ top: "medium" }}
      >
        <Card innerSpace="small" responsive={false}>
          <div>
            <H1 size="large" bottom="x-small">
              Illustrations
            </H1>
            <P size="small" top="x-small">
              Copyright © DNB Bank ASA. Only DNB employees may use these
              illustrations in DNB applications.{" "}
              <Anchor href={links.license}>License</Anchor>.
            </P>
            <Flex.Horizontal top="small" gap="medium" wrap>
              <Anchor href={links.readme} target="_blank">
                How to use
              </Anchor>
              <Anchor href={links.repository} target="_blank">
                Repository
              </Anchor>
              <Anchor href={links.package} target="_blank">
                npm package
              </Anchor>
              <Anchor href={links.figma} target="_blank">
                Figma source
              </Anchor>
            </Flex.Horizontal>
            <Flex.Horizontal top="small" gap="large" wrap>
              <div>
                <P size="small">Illustrations</P>
                <P size="small">{manifest.illustrations.length}</P>
              </div>
              <div>
                <P size="small">Figma version</P>
                <P size="small">
                  {manifest.figmaVersion ?? "Not synchronized"}
                </P>
              </div>
              <div>
                <P size="small">Published</P>
                <P size="small">
                  <time dateTime={publishedAt.toISOString()}>
                    {publishedDate}
                  </time>
                </P>
              </div>
            </Flex.Horizontal>
          </div>
        </Card>
      </Space>
      <Space
        element="main"
        className="page-width"
        innerSpace={{ block: "medium" }}
      >
        <section aria-labelledby="catalogue-heading">
          <H2 id="catalogue-heading" size="medium" bottom="zero">
            Browse illustrations
          </H2>
          <FilterRoot
            id={filterId}
            resultCount={groups.length}
            top="small"
            defaultPanelOpen={false}
          >
            <FilterHeader className="catalogue-filter__header">
              <FilterToolbar>
                <FilterSearch
                  label="Search illustrations"
                  labelSrOnly
                  placeholder="Name, slug or category"
                />
                <FilterToolbar.Actions>
                  <FilterPanelButton />
                </FilterToolbar.Actions>
              </FilterToolbar>
              <Flex.Horizontal gap="medium" align="center" wrap top="small">
                <ToggleButton.Group
                  label="Brand"
                  labelDirection="horizontal"
                  value={brand}
                  size="small"
                  onChange={({ value }: ToggleButtonGroupChangeEvent) => {
                    const nextBrand = value as IllustrationBrand;
                    setBrand(nextBrand);
                    if (nextBrand === "carnegie") {
                      setSurface("light");
                    }
                  }}
                >
                  {brands.map((value) => (
                    <ToggleButton
                      key={value}
                      value={value}
                      text={palettes[value].name}
                    />
                  ))}
                </ToggleButton.Group>
                <ToggleButton.Group
                  label="Surface"
                  labelDirection="horizontal"
                  value={surface}
                  size="small"
                  onChange={({ value }: ToggleButtonGroupChangeEvent) =>
                    setSurface(value as IllustrationSurface)
                  }
                >
                  <ToggleButton value="light" text="Light" />
                  <ToggleButton
                    value="dark"
                    text="Dark"
                    disabled={brand === "carnegie"}
                  />
                </ToggleButton.Group>
              </Flex.Horizontal>
              <FilterPanel>
                <FilterSelection
                  label="Figma page"
                  filterKey="/page"
                  data={[
                    ...new Map(
                      manifest.illustrations.map((entry) => [
                        entry.pageId,
                        entry.page,
                      ]),
                    ).entries(),
                  ].map(([value, label]) => ({ value, label }))}
                />
                <FilterSelection
                  label="Source status"
                  filterKey="/status"
                  data={[
                    { value: "approved", label: "Approved" },
                    { value: "component", label: "Component" },
                  ]}
                />
                <FilterSelection
                  label="Category"
                  filterKey="/category"
                  data={categories.map((category) => ({
                    value: category,
                    label: category,
                  }))}
                />
              </FilterPanel>
              <FilterActiveFilters showCategoryLabel />
              <FilterResultCount />
            </FilterHeader>
            <FilterContent top="small">
              <FilterNoResults />
              {groups.length > 0 && (
                <Space element="section" aria-label="Illustration results">
                  <CatalogueContext.Provider
                    value={{
                      brand,
                      surface,
                      groups,
                      onSelect: (group) => {
                        setSelectedGroup(group);
                        setDetailsOpen(true);
                      },
                    }}
                  >
                    <InfinityScroller
                      key={contentKey}
                      startupPage={1}
                      pageCount={Math.ceil(groups.length / chunkSize)}
                      minWaitTime={0}
                      onLoad={({ pageNumber, setContent }: PaginationEvent) => {
                        setContent(
                          pageNumber,
                          <IllustrationPage pageNumber={pageNumber} />,
                        );
                      }}
                    >
                      {firstPage}
                    </InfinityScroller>
                  </CatalogueContext.Provider>
                </Space>
              )}
            </FilterContent>
          </FilterRoot>
        </section>
      </Space>
      <Dialog
        open={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        omitTriggerButton
        title={selectedGroup?.name}
        maxWidth="60rem"
        verticalAlignment="top"
      >
        {selectedGroup && (
          <Flex.Vertical
            layoutEngine="css"
            align="stretch"
            gap="large"
            divider="line"
          >
            {selectedGroup.entries.map((entry) => (
              <Space
                key={entry.slug}
                element="section"
                aria-label={entry.name}
                className="illustration-details"
              >
                {selectedGroup.entries.length > 1 && (
                  <H2 size="medium" bottom="small">
                    {entry.name}
                  </H2>
                )}
                <IllustrationDetails entry={entry} brand={brand} />
              </Space>
            ))}
          </Flex.Vertical>
        )}
      </Dialog>
      <Space
        element="footer"
        className="page-width"
        innerSpace={{ bottom: "x-large" }}
      >
        <Flex.Horizontal top="small" gap="medium" wrap>
          <Anchor href={links.repository} target="_blank">
            Repository
          </Anchor>
          <Anchor href={links.package} target="_blank">
            npm package
          </Anchor>
          <Anchor href={links.manifest}>Package manifest</Anchor>
          <Anchor href={links.license}>License</Anchor>
          <Anchor href={links.figma} target="_blank">
            Figma source
          </Anchor>
        </Flex.Horizontal>
        <P size="small" top="small">
          Generated from the <Anchor href={links.manifest}>manifest</Anchor> in{" "}
          <Anchor href={links.repository}>dnbexperience/illustrations</Anchor>.
          Brand palettes remain subject to design approval.
        </P>
      </Space>
    </Theme>
  );
}
