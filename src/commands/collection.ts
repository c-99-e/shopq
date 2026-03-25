import { register } from "../registry";
import { formatOutput, formatError } from "../output";
import { resolveConfig, createClient, ConfigError, GraphQLError } from "../graphql";
import type { ParsedArgs } from "../types";

const COLLECTION_GET_BY_ID_QUERY = `query CollectionGet($id: ID!) {
  collection(id: $id) {
    id
    title
    handle
    descriptionHtml
    productsCount { count precision }
    image { url altText }
    seo { title description }
  }
}`;

const COLLECTION_GET_BY_HANDLE_QUERY = `query CollectionGetByHandle($handle: String!) {
  collectionByHandle(handle: $handle) {
    id
    title
    handle
    descriptionHtml
    productsCount { count precision }
    image { url altText }
    seo { title description }
  }
}`;

interface CollectionNode {
  id: string;
  title: string;
  handle: string;
  descriptionHtml: string;
  productsCount: { count: number; precision: string };
  image: { url: string; altText: string | null } | null;
  seo: { title: string; description: string };
}

function resolveCollectionInput(input: string): { type: "gid"; id: string } | { type: "handle"; handle: string } {
  if (input.startsWith("gid://")) {
    return { type: "gid", id: input };
  }
  if (/^\d+$/.test(input)) {
    return { type: "gid", id: `gid://shopify/Collection/${input}` };
  }
  return { type: "handle", handle: input };
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").trim();
}

function truncate(str: string, max: number): string {
  if (str.length <= max) return str;
  return str.slice(0, max - 3) + "...";
}

async function handleCollectionGet(parsed: ParsedArgs): Promise<void> {
  const idOrHandle = parsed.args.join(" ");
  if (!idOrHandle) {
    formatError("Usage: misty collection get <id-or-handle>");
    process.exitCode = 1;
    return;
  }

  try {
    const config = resolveConfig(parsed.flags.store);
    const protocol = process.env.MISTY_PROTOCOL === "http" ? "http" : "https";
    const client = createClient({ ...config, protocol });

    const resolved = resolveCollectionInput(idOrHandle);
    let collection: CollectionNode | null = null;

    if (resolved.type === "gid") {
      const result = await client.query<{ collection: CollectionNode | null }>(COLLECTION_GET_BY_ID_QUERY, { id: resolved.id });
      collection = result.collection;
    } else {
      const result = await client.query<{ collectionByHandle: CollectionNode | null }>(COLLECTION_GET_BY_HANDLE_QUERY, { handle: resolved.handle });
      collection = result.collectionByHandle;
    }

    if (!collection) {
      formatError(`Collection "${idOrHandle}" not found`);
      process.exitCode = 1;
      return;
    }

    if (parsed.flags.json) {
      const data = {
        id: collection.id,
        title: collection.title,
        handle: collection.handle,
        description: stripHtml(collection.descriptionHtml),
        productsCount: collection.productsCount,
        image: collection.image ? { url: collection.image.url, alt: collection.image.altText ?? "" } : null,
        seo: collection.seo,
      };
      formatOutput(data, [], { json: true, noColor: parsed.flags.noColor });
      return;
    }

    // Key-value table output
    const label = (name: string) => parsed.flags.noColor ? name : `\x1b[1m${name}\x1b[0m`;
    const lines: string[] = [];

    lines.push(`${label("ID")}: ${collection.id}`);
    lines.push(`${label("Title")}: ${collection.title}`);
    lines.push(`${label("Handle")}: ${collection.handle}`);
    lines.push(`${label("Products Count")}: ${collection.productsCount.count}`);
    lines.push(`${label("Description")}: ${truncate(stripHtml(collection.descriptionHtml), 80)}`);

    if (collection.image) {
      lines.push(`${label("Image")}: ${collection.image.url}${collection.image.altText ? ` (${collection.image.altText})` : ""}`);
    }

    lines.push(`${label("SEO Title")}: ${collection.seo.title}`);
    lines.push(`${label("SEO Description")}: ${collection.seo.description}`);

    process.stdout.write(lines.join("\n") + "\n");
  } catch (err) {
    if (err instanceof ConfigError) {
      formatError(err.message);
      process.exitCode = 1;
      return;
    }
    if (err instanceof GraphQLError) {
      formatError(err.message);
      process.exitCode = 1;
      return;
    }
    throw err;
  }
}

register("collection", "Collection management", "get", {
  description: "Get a single collection by ID or handle",
  handler: handleCollectionGet,
});
