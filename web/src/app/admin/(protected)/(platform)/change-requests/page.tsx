import { listAllChangeRequests } from "./actions";
import { ChangeRequestsReview } from "@/components/admin/change-requests-review";

export default async function ChangeRequestsPage() {
  const requests = await listAllChangeRequests();

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-xl font-bold text-ink">Change requests</h1>
      <p className="mt-1 text-sm text-slate">
        Requests from org admins for changes they can&apos;t make themselves — e.g. a wrong organization name.
      </p>

      <div className="mt-6">
        <ChangeRequestsReview requests={requests} />
      </div>
    </div>
  );
}
