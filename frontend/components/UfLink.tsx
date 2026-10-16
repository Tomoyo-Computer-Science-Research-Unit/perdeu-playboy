"use client";

import Link from "next/link";
import type { ComponentProps } from "react";
import { useScreenHref } from "@/lib/use-uf";

type Props = Omit<ComponentProps<typeof Link>, "href"> & { href: string; "data-brand"?: boolean };

/** Link para uma tela na UF da página: href="/series" vira "/sp/series/" em São Paulo. */
export function UfLink({ href, ...props }: Props) {
  const screenHref = useScreenHref();
  return <Link href={screenHref(href)} {...props} />;
}

/** Panorama da UF da página (marca do cabeçalho). */
export function HomeLink(props: Omit<Props, "href">) {
  return <UfLink href="/" {...props} />;
}
