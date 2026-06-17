import type { MetadataRoute } from "next";

export const dynamic = "force-static";

const baseUrl = "https://perdeu-playboy.online";
const lastModified = new Date("2026-06-17T00:00:00-03:00");

const routes = [
  "",
  "/dashboard",
  "/trends",
  "/map",
  "/rankings",
  "/changes",
  "/governors",
  "/sources",
  "/glossary",
  "/methodology"
];

export default function sitemap(): MetadataRoute.Sitemap {
  return routes.map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified,
    changeFrequency: route === "" ? "weekly" : "daily",
    priority: route === "" ? 1 : 0.8
  }));
}
