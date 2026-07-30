# supabase/

SQL migrations for the app. Run each in order in the Supabase SQL editor, or
`supabase db push` with the CLI.

- `migrations/`
  - `0001_profiles_and_roles.sql` — profiles, role catalogue, RLS helpers
    (`is_admin()`, `has_role()`), and the `touch_updated_at()` trigger fn.
  - `0002`–`0005` — seed admin/trainer/student users.
  - `0006_content.sql` — curriculum content: `content_weeks`, `content_days`,
    and `content_assets` (video + notes stored in Cloudflare R2, keyed by
    `r2_key`). RLS: any signed-in user reads, only admins write. Seeds the empty
    12-week / 60-day structure on first run.

## Content media (Cloudflare R2)

Uploaded videos and documents live in an R2 bucket; only the object key + file
metadata are stored in `content_assets`. Configure the R2 env vars (see `.env`,
the "Cloudflare R2" section) and add a **CORS policy** on the bucket allowing
`PUT` (and `GET`) from the app origin, since the browser uploads directly to R2
via presigned URLs (see `lib/r2/`).
