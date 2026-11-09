"use client";

import {
  createContext,
  forwardRef,
  useContext,
  useId,
  type ReactNode,
  type SVGProps,
} from "react";
import type { IllustrationBrand, IllustrationSurface } from "../types.js";

export type IllustrationTheme = {
  brand?: IllustrationBrand;
  surface?: IllustrationSurface;
};
const IllustrationContext = createContext<IllustrationTheme>({});

export function IllustrationProvider({
  brand,
  surface,
  children,
}: IllustrationTheme & { children: ReactNode }) {
  const parent = useContext(IllustrationContext);
  return (
    <IllustrationContext.Provider
      value={{
        brand: brand ?? parent.brand,
        surface: surface ?? parent.surface,
      }}
    >
      {children}
    </IllustrationContext.Provider>
  );
}

type Accessibility =
  { title: string; decorative?: false } | { decorative: true; title?: never };
export type IllustrationProps = Omit<
  SVGProps<SVGSVGElement>,
  | "children"
  | "title"
  | "dangerouslySetInnerHTML"
  | "viewBox"
  | "role"
  | "aria-label"
  | "aria-labelledby"
  | "aria-hidden"
> &
  IllustrationTheme &
  Accessibility;

type Definition = {
  slug: string;
  name: string;
  width: number;
  height: number;
  draw: (prefix: string) => ReactNode;
};

export function createIllustration({
  slug,
  name,
  width,
  height,
  draw,
}: Definition) {
  const Illustration = forwardRef<SVGSVGElement, IllustrationProps>(
    function Illustration(
      { brand, surface, title, decorative, className, ...props },
      ref,
    ) {
      const theme = useContext(IllustrationContext);
      const id =
        "illustration-" +
        Array.from(useId(), (character) =>
          character.codePointAt(0)!.toString(16),
        ).join("-");
      const currentBrand = brand ?? theme.brand ?? "dnb";
      const currentSurface =
        currentBrand === "carnegie"
          ? "light"
          : (surface ?? theme.surface ?? "light");
      if (!decorative && !title?.trim()) {
        throw new Error("Provide an illustration title or set decorative.");
      }
      return (
        <svg
          {...props}
          ref={ref}
          className={["dnb-illustration", className].filter(Boolean).join(" ")}
          data-illustration={slug}
          data-illustration-brand={currentBrand}
          data-illustration-surface={currentSurface}
          xmlns="http://www.w3.org/2000/svg"
          width={
            props.width ??
            (typeof props.height === "number"
              ? (props.height * width) / height
              : width)
          }
          height={props.height ?? (props.width === undefined ? height : "auto")}
          viewBox={"0 0 " + width + " " + height}
          fill="none"
          role={decorative ? undefined : "img"}
          aria-hidden={decorative ? true : undefined}
          aria-labelledby={decorative ? undefined : id + "-title"}
          focusable="false"
        >
          {!decorative && <title id={id + "-title"}>{title}</title>}
          {draw(id)}
        </svg>
      );
    },
  );
  Illustration.displayName = name;
  return Illustration;
}
