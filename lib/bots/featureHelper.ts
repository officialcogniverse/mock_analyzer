import catalog from "@/lib/featureCatalog.json";

type Catalog = typeof catalog;

export function respondWithFeatureCatalog(message: string) {
  const normalized = message.toLowerCase();
  const entry = (catalog as Catalog).features.find((feature) =>
    feature.keywords.some((keyword) => normalized.includes(keyword))
  );

  if (!entry) {
    return catalog.fallback;
  }

  return {
    reply: entry.reply,
    actions: entry.actions,
  };
}
