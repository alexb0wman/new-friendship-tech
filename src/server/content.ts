import { z } from "zod";
import { placeInput } from "./admin";
const https = z.url().refine((value) => new URL(value).protocol === "https:", "Use HTTPS");
export const cityInput = z
  .object({
    slug: z.string().regex(/^[a-z-]+$/),
    name: z.string().min(2).max(80),
    timezone: z.string().refine((value) => {
      try {
        new Intl.DateTimeFormat("en", { timeZone: value });
        return true;
      } catch {
        return false;
      }
    }, "Use an IANA timezone"),
    published: z.boolean(),
  })
  .strict();
export const eventInput = z
  .object({
    id: z.string().uuid(),
    city: z.string().regex(/^[a-z-]+$/),
    title: z.string().min(3).max(150),
    neighborhood: z.string().min(1).max(60),
    startsAt: z.iso.datetime({ offset: true }),
    endsAt: z.iso.datetime({ offset: true }),
    registrationUrl: https,
    sourceUrl: https,
    accessNote: z.string().min(5).max(500),
    published: z.boolean(),
  })
  .strict()
  .refine((value) => new Date(value.endsAt) > new Date(value.startsAt), "End must follow start");
export const contentBundle = z
  .object({
    originalOrLicensed: z.literal(true),
    cities: z.array(cityInput).max(50),
    places: z.array(placeInput).max(5000),
    events: z.array(eventInput).max(500),
  })
  .strict()
  .superRefine((value, ctx) => {
    const seen = new Set<string>();
    for (const p of value.places) {
      if (seen.has(p.slug))
        ctx.addIssue({ code: "custom", message: "Duplicate place slug: " + p.slug });
      seen.add(p.slug);
    }
  });
