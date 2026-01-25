import catalog from "@/lib/featureCatalog.json";

type Catalog = typeof catalog;

type FeatureEntry = Catalog["features"][number];

type FeatureMatch = FeatureEntry & { score: number };

function scoreFeature(message: string, feature: FeatureEntry) {
  const normalized = message.toLowerCase();
  return feature.keywords.reduce((score, keyword) => {
    if (!keyword) return score;
    return normalized.includes(keyword.toLowerCase()) ? score + 1 : score;
  }, 0);
}

function formatReply(matches: FeatureEntry[]) {
  if (!matches.length) return catalog.fallback.reply;
  const names = matches.map((feature) => feature.name).join(" · ");
  return `Here are the closest features: ${names}.`;
}

export function respondWithFeatureCatalog(message: string) {
  const matches = (catalog as Catalog).features
    .map((feature) => ({ ...feature, score: scoreFeature(message, feature) }))
    .filter((feature) => feature.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  if (!matches.length) {
    return {
      reply: catalog.fallback.reply,
      suggestions: catalog.fallback.suggested ?? [],
      matches: [],
    };
  }

  return {
    reply: formatReply(matches),
    suggestions: [],
    matches,
  };
}
