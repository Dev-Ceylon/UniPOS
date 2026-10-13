import { Alert, Card, CardBody, CardHeader, CardTitle, PageHeader } from "@unipos/ui";
import { LinkButton } from "@/components/link-button";
import { requireContext } from "@/lib/context";
import { RestoreForm } from "./restore";

export const metadata = { title: "Backup" };

export default async function BackupPage() {
  await requireContext("backup.manage");
  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <PageHeader title="Backup & restore" />
      <Card>
        <CardHeader>
          <CardTitle>Export</CardTitle>
        </CardHeader>
        <CardBody className="flex flex-col gap-3 text-sm">
          <p>Download every record for this business (products, stock ledger, sales, customers, settings) as one JSON file. Keep it somewhere safe.</p>
          <div>
            <LinkButton href="/api/v1/backup" variant="primary">
              Download backup
            </LinkButton>
          </div>
        </CardBody>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Restore</CardTitle>
        </CardHeader>
        <CardBody className="flex flex-col gap-3">
          <Alert tone="warning">Restoring replaces all business data with the backup. Staff accounts are kept. The restore is recorded in the audit log.</Alert>
          <RestoreForm />
        </CardBody>
      </Card>
    </div>
  );
}
