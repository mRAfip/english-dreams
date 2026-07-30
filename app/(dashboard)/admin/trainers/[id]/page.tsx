import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/guards";
import { getTrainer } from "@/lib/trainer/directory";
import { TrainerDetail } from "@/components/admin/trainer-detail";

// Admin > Trainers > one trainer — profile summary plus edit/delete controls.
// Backed by the profiles + role-assignment tables.
export default async function Page(
  props: PageProps<"/admin/trainers/[id]">,
) {
  await requireRole("admin");
  const { id } = await props.params;

  const trainer = await getTrainer(id);
  if (!trainer) notFound();

  return <TrainerDetail trainer={trainer} />;
}
