// If your other DB functions import from '@netlify/neon', keep that import.
// If you switched to '@neondatabase/serverless', change the import line accordingly.
import { neon } from '@netlify/neon'; // or: '@neondatabase/serverless'

export const handler = async (event) => {
  try {
    // Use pooled URL automatically (with @netlify/neon) OR pass it explicitly if using @neondatabase/serverless:
    const sql = neon(process.env.NETLIFY_DATABASE_URL); // safe for both imports

    const url = new URL(event.rawUrl);
    const slug = (url.searchParams.get("slug") || "").trim().toLowerCase();

    if (!slug) {
      return { statusCode: 400, body: JSON.stringify({ ok: false, error: "Missing slug" }) };
    }

    const rows = await sql`
      SELECT slug, name, brand_primary, google_place_id, google_maps_url,
             keywords, highlight_options, negative_questions
      FROM tenants
      WHERE slug = ${slug}
      LIMIT 1;
    `;

    if (!rows.length) {
      return { statusCode: 404, body: JSON.stringify({ ok: false, error: "Not found" }) };
    }

    // Shape the response exactly like your JSON files
    const t = rows[0];
    const tenant = {
      slug: t.slug,
      name: t.name,
      brand: { primary: t.brand_primary || "#b91c1c" },
      google: t.google_place_id
        ? { placeId: t.google_place_id }
        : (t.google_maps_url ? { mapsUrl: t.google_maps_url } : {}),
      keywords: Array.isArray(t.keywords) ? t.keywords : (t.keywords?.array || t.keywords || []),
      highlightOptions: Array.isArray(t.highlight_options) ? t.highlight_options : (t.highlight_options?.array || t.highlight_options || ["Food","Service","Atmosphere","Authenticity"]),
      negativeQuestions: t.negative_questions || {
        diningModes: ["Dine in","Take out","Delivery"],
        meals: ["Breakfast","Brunch","Lunch","Dinner","Other"],
        spendRanges: ["$1–10","$10–20","$20–30","$30–50","$50–100","$100+"]
      }
    };

    return { statusCode: 200, body: JSON.stringify({ ok: true, tenant }) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: String(e) }) };
  }
};
