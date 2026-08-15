import { RosterUploader } from "@/components/admin/roster-uploader";

export default function RosterPage() {
  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-xl font-bold text-ink">Roster Upload</h1>
      <p className="mt-1 text-sm text-slate">
        Each valid row creates a student login (roll number + a generated
        password) and a profile record.
      </p>

      <div className="mt-6">
        <RosterUploader />
      </div>
    </div>
  );
}
