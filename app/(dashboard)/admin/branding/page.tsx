import { requireRole } from "@/lib/auth/guards";
import { getActiveBrandingBanner } from "@/lib/branding/actions";
import { BrandingManager } from "@/components/admin/branding-manager";

// Admin branding page — allows managing visual assets (promotional banners, logos).
export default async function AdminBrandingPage() {
  await requireRole("admin");
  const initialBanner = await getActiveBrandingBanner();

  return (
    <div className="mx-auto w-full max-w-5xl">
      <BrandingManager initialBanner={initialBanner} />
    </div>
  );
}
