"use client";
import { Alert, Button, Card, CardBody, Field } from "@unipos/ui";
import { useState } from "react";
import { useAction } from "@/components/use-action";
import { importCsvAction } from "../actions";

export function ImportForm() {
  const [text, setText] = useState("");
  const [name, setName] = useState("");
  const [result, setResult] = useState<{ created: number; updated: number; errors: { row: number; message: string }[] } | null>(null);
  const { run, pending } = useAction();
  return (
    <Card>
      <CardBody className="flex flex-col gap-3">
        <Field label="CSV file" htmlFor="csv">
          <input
            id="csv"
            type="file"
            accept=".csv,text/csv"
            className="text-sm"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              setName(f.name);
              setText(await f.text());
            }}
          />
        </Field>
        {text ? (
          <p className="text-sm text-muted">
            {name}: {text.split(/\r?\n/).filter(Boolean).length - 1} rows
          </p>
        ) : null}
        <div>
          <Button disabled={!text} loading={pending} onClick={() => run(() => importCsvAction(text), { onOk: setResult, success: "Import finished" })}>
            Import
          </Button>
        </div>
        {result ? (
          <Alert
            tone={result.errors.length ? "warning" : "success"}
            title={`${result.created} created, ${result.updated} updated, ${result.errors.length} errors`}
          >
            <ul className="mt-1 max-h-48 overflow-y-auto">
              {result.errors.map((e) => (
                <li key={e.row}>
                  Row {e.row}: {e.message}
                </li>
              ))}
            </ul>
          </Alert>
        ) : null}
      </CardBody>
    </Card>
  );
}
