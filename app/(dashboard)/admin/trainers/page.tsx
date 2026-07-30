import { requireRole } from "@/lib/auth/guards";
import { getTrainers } from "@/lib/trainer/directory";
import { TrainerDirectory } from "@/components/admin/trainer-directory";

// Admin > Trainers — provision trainers (create account + assign the trainer
// role) and see the team. Backed by the profiles + role-assignment tables.
export default async function Page() {
  await requireRole("admin");
  const trainers = await getTrainers();
  return <TrainerDirectory trainers={trainers} />;
}
