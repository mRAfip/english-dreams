import { requireUser } from "@/lib/auth/guards";
import { avatarUploadsEnabled } from "@/lib/r2/client";
import { ProfileSettings } from "@/components/global/profile-settings";

// Shared > Profile — account settings; common to all roles.
export default async function Page() {
  const user = await requireUser();
  return <ProfileSettings user={user} avatarsEnabled={avatarUploadsEnabled()} />;
}
