import { neon } from '@netlify/neon'; // or '@neondatabase/serverless'

export const handler = async () => {
  try {
    const sql = neon(process.env.NETLIFY_DATABASE_URL);

    // Two example tenants (mirror your current JSON)
    const tenants = [
      {
        slug: "sahara",
        name: "Sahara",
        brand_primary: "#b91c1c",
        google_maps_url: "https://www.google.com/maps/place/Sahara+Restaurant/@40.5000681,-74.4567202,17z/data=!4m8!3m7!1s0x89c3c6ff3e35125b:0xc9ebce3f3d21e043!8m2!3d40.5000681!4d-74.4541453!9m1!1b1!16s%2Fg%2F1tczldzb?hl=en-US&entry=ttu",
        google_place_id: null,
        keywords: [
          "chicken kebab","adana kebab","lamb chops","hummus","baba ghanoush",
          "falafel","tabouleh","baklava","salmon","shrimp","tilapia",
          "roasted eggplant","couscous","shepherd’s salad","pita","turkish coffee"
        ],
        highlight_options: ["Food","Service","Atmosphere","Authenticity"],
        negative_questions: {
          diningModes: ["Dine in","Take out","Delivery"],
          meals: ["Breakfast","Brunch","Lunch","Dinner","Other"],
          spendRanges: ["$1–10","$10–20","$20–30","$30–50","$50–100","$100+"]
        }
      },
      {
        slug: "cedars",
        name: "Cedars",
        brand_primary: "#0ea5e9",
        google_maps_url: null,
        google_place_id: null, // fill this later if you have it
        keywords: ["shawarma","hummus","grape leaves","kabob","baklava"],
        highlight_options: ["Food","Service","Atmosphere","Authenticity"],
        negative_questions: {
          diningModes: ["Dine in","Take out","Delivery"],
          meals: ["Lunch","Dinner","Other"],
          spendRanges: ["$10–20","$20–30","$30–50"]
        }
      }
    ];

    for (const t of tenants) {
      await sql`
        INSERT INTO tenants (
          slug, name, brand_primary, google_place_id, google_maps_url,
          keywords, highlight_options, negative_questions
        ) VALUES (
          ${t.slug}, ${t.name}, ${t.brand_primary}, ${t.google_place_id}, ${t.google_maps_url},
          ${sql.json(t.keywords)}, ${sql.json(t.highlight_options)}, ${sql.json(t.negative_questions)}
        )
        ON CONFLICT (slug) DO UPDATE SET
          name = EXCLUDED.name,
          brand_primary = EXCLUDED.brand_primary,
          google_place_id = EXCLUDED.google_place_id,
          google_maps_url = EXCLUDED.google_maps_url,
          keywords = EXCLUDED.keywords,
          highlight_options = EXCLUDED.highlight_options,
          negative_questions = EXCLUDED.negative_questions;
      `;
    }

    return { statusCode: 200, body: JSON.stringify({ ok: true, count: tenants.length }) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: String(e) }) };
  }
};
