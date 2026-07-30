import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/guards";
import { getInbox, getThreadWith } from "@/lib/inbox/conversations";
import { ConversationList } from "@/components/global/inbox/conversation-list";
import { ConversationView } from "@/components/global/inbox/conversation-view";

// Shared > Inbox thread with one person. Two-pane from `lg` (list stays
// visible); the thread alone on smaller screens, where the view's back arrow
// returns to /inbox. 404s if the viewer isn't allowed to message this person and
// has no existing thread with them.
export default async function Page({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const [{ userId }, user] = await Promise.all([params, requireUser()]);

  const [thread, entries] = await Promise.all([
    getThreadWith(user, userId),
    getInbox(user),
  ]);
  if (!thread) notFound();

  return (
    <div className="grid gap-6 lg:grid-cols-[20rem_1fr]">
      <ConversationList
        entries={entries}
        activeUserId={userId}
        className="hidden lg:flex"
      />
      <ConversationView key={thread.with.id} thread={thread} meId={user.id} />
    </div>
  );
}
