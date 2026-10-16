import type { Metadata } from "next";
import { PUBLISHED_UFS, ROOT_UF, configFor, ufByCode } from "@/lib/uf";

// As UFs publicadas fora do Rio moram em /<uf>/ com as mesmas telas (menos Tiroteios); o Rio fica na raiz.
export const dynamicParams = false;

export function generateStaticParams() {
  return PUBLISHED_UFS.filter((entry) => entry.code !== ROOT_UF).map((entry) => ({ uf: entry.code.toLowerCase() }));
}

export async function generateMetadata({ params }: { params: Promise<{ uf: string }> }): Promise<Metadata> {
  const entry = ufByCode((await params).uf);
  const config = configFor(entry ?? ROOT_UF);
  return {
    description: config.description,
    keywords: config.keywords,
    alternates: { canonical: `/${config.code.toLowerCase()}/` },
    openGraph: { description: config.description }
  };
}

export default function UfLayout({ children }: { children: React.ReactNode }) {
  return children;
}
