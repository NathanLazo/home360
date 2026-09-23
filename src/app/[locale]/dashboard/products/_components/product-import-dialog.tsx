"use client";

import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from "react";
import {
  CheckCircle2Icon,
  FileSpreadsheetIcon,
  FileUpIcon,
  LoaderCircleIcon,
  TriangleAlertIcon,
  XIcon,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";

import { parseProductsCsv } from "./product-csv.utils";
import type { CsvRowError, ProductCsvRow } from "./product.schema";
import type { ProductStockBranch } from "./product.types";
import { useCloseWhenReadOnly } from "~/components/dashboard/subscription-access-context";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";

type ImportPhase = "upload" | "preview" | "result";

type ImportResult = {
  created: number;
  updated: number;
  errors: CsvRowError[];
};

const EMPTY_RESULT: ImportResult = { created: 0, updated: 0, errors: [] };

export function ProductImportDialog({
  open,
  initialBranchId,
  branches,
  onOpenChange,
}: {
  open: boolean;
  initialBranchId?: string;
  branches: ProductStockBranch[];
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("dashboard.products.import");
  // A cancellation arriving mid-edit closes the form instead of letting the
  // user finish something the server will reject.
  useCloseWhenReadOnly(open, onOpenChange);
  const errorsT = useTranslations("errors");
  const locale = useLocale();
  const utils = api.useUtils();
  const mutation = api.product.importCsv.useMutation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const phaseHeadingRef = useRef<HTMLHeadingElement>(null);
  const requestErrorRef = useRef<HTMLDivElement>(null);
  const wasOpenRef = useRef(false);
  const importLockRef = useRef(false);
  const [phase, setPhase] = useState<ImportPhase>("upload");
  const [selectedBranchId, setSelectedBranchId] = useState("");
  const [fileName, setFileName] = useState("");
  const [validRows, setValidRows] = useState<ProductCsvRow[]>([]);
  const [rowErrors, setRowErrors] = useState<CsvRowError[]>([]);
  const [result, setResult] = useState<ImportResult>(EMPTY_RESULT);
  const [processingFile, setProcessingFile] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [importLocked, setImportLocked] = useState(false);
  const priceFormatter = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const selectedBranch = branches.find(
    (branch) => branch.id === selectedBranchId,
  );
  const canChooseFile = selectedBranch !== undefined && !processingFile;

  useEffect(() => {
    const justOpened = open && !wasOpenRef.current;
    wasOpenRef.current = open;
    if (!justOpened) return;

    setPhase("upload");
    setSelectedBranchId(initialBranchId ?? "");
    setFileName("");
    setValidRows([]);
    setRowErrors([]);
    setResult(EMPTY_RESULT);
    setProcessingFile(false);
    setDragActive(false);
    setRequestError(null);
    importLockRef.current = false;
    setImportLocked(false);
  }, [initialBranchId, open]);

  useEffect(() => {
    if (!open || phase === "upload") return;
    window.requestAnimationFrame(() => phaseHeadingRef.current?.focus());
  }, [open, phase]);

  async function processFile(file: File) {
    if (!canChooseFile) return;

    setProcessingFile(true);
    setRequestError(null);

    try {
      const parsed = await parseProductsCsv(file);
      setFileName(file.name);
      setValidRows(parsed.valid);
      setRowErrors(parsed.errors);
      setPhase("preview");
    } catch {
      setFileName(file.name);
      setValidRows([]);
      setRowErrors([{ line: 1, code: "CSV_PARSE_ERROR" }]);
      setPhase("preview");
    } finally {
      setProcessingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) void processFile(file);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragActive(false);
    const file = event.dataTransfer.files[0];
    if (file) void processFile(file);
  }

  function chooseAnotherFile() {
    setPhase("upload");
    setFileName("");
    setValidRows([]);
    setRowErrors([]);
    setRequestError(null);
    window.requestAnimationFrame(() =>
      document.getElementById("product-import-file-button")?.focus(),
    );
  }

  async function importRows() {
    if (importLockRef.current || !selectedBranch || validRows.length === 0)
      return;
    importLockRef.current = true;
    setImportLocked(true);
    setRequestError(null);

    try {
      const response = await mutation.mutateAsync({
        branchId: selectedBranch.id,
        rows: validRows,
      });

      if (response.error !== null || response.result === null) {
        const message = response.error
          ? errorsT(response.error)
          : t("transportError");
        setRequestError(message);
        toast.error(message);
        window.requestAnimationFrame(() => requestErrorRef.current?.focus());
        return;
      }

      setResult(response.result);
      setPhase("result");
      toast.success(t("success"));
      await Promise.all([
        utils.product.list.invalidate(),
        utils.product.listCategories.invalidate(),
        utils.product.getStockByBranch.invalidate(),
      ]);
    } catch {
      setRequestError(t("transportError"));
      toast.error(t("transportError"));
      window.requestAnimationFrame(() => requestErrorRef.current?.focus());
    } finally {
      importLockRef.current = false;
      setImportLocked(false);
    }
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && (importLockRef.current || mutation.isPending)) return;
    onOpenChange(nextOpen);
  }

  const importBusy = importLocked || mutation.isPending;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="flex max-h-[min(90vh,52rem)] flex-col overflow-hidden p-0 sm:max-w-3xl"
        aria-busy={processingFile || importBusy}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          const targetId = initialBranchId
            ? "product-import-file-button"
            : "product-import-branch";
          window.requestAnimationFrame(() =>
            document.getElementById(targetId)?.focus(),
          );
        }}
      >
        <DialogHeader className="border-b px-6 py-5 pr-16">
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
          <DialogClose asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled={importBusy}
              className="absolute top-3 right-3"
              aria-label={t("close")}
            >
              <XIcon aria-hidden="true" />
            </Button>
          </DialogClose>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
          <div className="space-y-2">
            <Label htmlFor="product-import-branch">{t("branchLabel")}</Label>
            <Select
              value={selectedBranchId}
              onValueChange={setSelectedBranchId}
              disabled={importBusy || phase === "result"}
            >
              <SelectTrigger
                id="product-import-branch"
                className="w-full"
                aria-describedby="product-import-branch-help"
              >
                <SelectValue placeholder={t("branchPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {branches.map((branch) => (
                  <SelectItem key={branch.id} value={branch.id}>
                    {branch.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p
              id="product-import-branch-help"
              className="text-muted-foreground text-copy-sm"
            >
              {selectedBranch
                ? t("branchSelectedHelp", { branch: selectedBranch.name })
                : branches.length === 0
                  ? t("noBranches")
                  : t("branchHelp")}
            </p>
          </div>

          {phase === "upload" ? (
            <div
              className={cn(
                "border-hairline-strong flex min-h-64 flex-col items-center justify-center gap-3 rounded-lg border border-dashed px-6 py-10 text-center transition-[border-color,background-color] duration-150 ease-out motion-reduce:transition-none",
                dragActive && canChooseFile && "border-link bg-link-soft/40",
                !canChooseFile && "bg-canvas-soft opacity-70",
              )}
              onDragEnter={(event) => {
                event.preventDefault();
                if (canChooseFile) setDragActive(true);
              }}
              onDragOver={(event) => event.preventDefault()}
              onDragLeave={(event) => {
                if (
                  !event.currentTarget.contains(event.relatedTarget as Node)
                ) {
                  setDragActive(false);
                }
              }}
              onDrop={handleDrop}
            >
              {processingFile ? (
                <LoaderCircleIcon
                  aria-hidden="true"
                  className="text-muted-foreground size-8 animate-spin motion-reduce:animate-none"
                />
              ) : (
                <FileSpreadsheetIcon
                  aria-hidden="true"
                  className="text-muted-foreground size-9"
                  strokeWidth={1.5}
                />
              )}
              <div className="space-y-1">
                <h3 className="text-display-sm">{t("dropTitle")}</h3>
                <p className="text-muted-foreground text-copy-sm max-w-md">
                  {t("dropDescription")}
                </p>
                <p className="text-muted-foreground max-w-md font-mono text-xs leading-relaxed">
                  {t("formatHelp")}
                </p>
              </div>
              <input
                ref={fileInputRef}
                id="product-import-file"
                type="file"
                accept=".csv,text/csv"
                className="sr-only"
                tabIndex={-1}
                disabled={!canChooseFile}
                aria-label={t("chooseFile")}
                onChange={handleFileChange}
              />
              <Button
                id="product-import-file-button"
                type="button"
                variant="outline"
                disabled={!canChooseFile}
                aria-describedby="product-import-file-hint"
                onClick={() => fileInputRef.current?.click()}
              >
                {processingFile ? (
                  <LoaderCircleIcon
                    aria-hidden="true"
                    className="animate-spin motion-reduce:animate-none"
                  />
                ) : (
                  <FileUpIcon aria-hidden="true" />
                )}
                {processingFile ? t("processing") : t("chooseFile")}
              </Button>
              <p
                id="product-import-file-hint"
                className="text-muted-foreground text-xs"
              >
                {t("fileHint")}
              </p>
              <div className="sr-only" role="status" aria-live="polite">
                {processingFile ? t("processing") : ""}
              </div>
            </div>
          ) : null}

          {phase === "preview" ? (
            <div className="space-y-5">
              <div className="space-y-1">
                <h3
                  ref={phaseHeadingRef}
                  tabIndex={-1}
                  className="text-base font-semibold outline-none"
                >
                  {t("previewTitle")}
                </h3>
                <p className="text-muted-foreground text-copy-sm">
                  {t("previewDescription", { file: fileName })}
                </p>
                <p className="text-copy-sm font-medium" role="status">
                  {t("validSummary", {
                    valid: validRows.length,
                    errors: rowErrors.length,
                  })}
                </p>
              </div>

              {validRows.length > 0 ? (
                <div className="overflow-hidden rounded-md border">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t("columns.name")}</TableHead>
                          <TableHead>{t("columns.sku")}</TableHead>
                          <TableHead>{t("columns.price")}</TableHead>
                          <TableHead className="text-right">
                            {t("columns.stock")}
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {validRows.slice(0, 10).map((row) => (
                          <TableRow key={`${row.line}-${row.sku}`}>
                            <TableCell className="font-medium">
                              {row.name}
                            </TableCell>
                            <TableCell className="font-mono text-xs">
                              {row.sku}
                            </TableCell>
                            <TableCell className="tabular-nums">
                              {priceFormatter.format(row.priceCents / 100)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {row.stock}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  {validRows.length > 10 ? (
                    <p className="text-muted-foreground text-copy-sm border-t px-4 py-2">
                      {t("moreRows", { count: validRows.length - 10 })}
                    </p>
                  ) : null}
                </div>
              ) : null}

              {rowErrors.length > 0 ? (
                <div className="bg-error-soft/60 rounded-md p-4">
                  <div className="mb-3 flex items-center gap-2 font-medium">
                    <TriangleAlertIcon
                      aria-hidden="true"
                      className="text-error size-5"
                    />
                    <h4>{t("errorsTitle")}</h4>
                  </div>
                  <ul className="text-copy-sm max-h-40 space-y-2 overflow-y-auto">
                    {rowErrors.map((error, index) => (
                      <li key={`${error.line}-${error.code}-${index}`}>
                        {t("lineError", {
                          line: error.line,
                          error: errorsT(error.code),
                        })}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {requestError ? (
                <div
                  ref={requestErrorRef}
                  tabIndex={-1}
                  role="alert"
                  className="bg-error-soft text-error-deep text-copy-sm rounded-md p-3 outline-none"
                >
                  {requestError}
                </div>
              ) : null}
            </div>
          ) : null}

          {phase === "result" ? (
            <div className="flex min-h-64 flex-col items-center justify-center gap-4 py-8 text-center">
              <CheckCircle2Icon
                aria-hidden="true"
                className="text-success size-12"
                strokeWidth={1.5}
              />
              <div className="space-y-2">
                <h3
                  ref={phaseHeadingRef}
                  tabIndex={-1}
                  className="text-display-sm outline-none"
                >
                  {t("resultTitle")}
                </h3>
                <p className="text-muted-foreground">
                  {t("resultDescription", {
                    branch: selectedBranch?.name ?? "",
                  })}
                </p>
              </div>
              <div className="grid w-full max-w-sm grid-cols-2 gap-3">
                <div className="bg-canvas-soft rounded-md border p-4">
                  <p className="text-display-md font-mono tabular-nums">
                    {result.created}
                  </p>
                  <p className="text-muted-foreground text-copy-sm">
                    {t("created")}
                  </p>
                </div>
                <div className="bg-canvas-soft rounded-md border p-4">
                  <p className="text-display-md font-mono tabular-nums">
                    {result.updated}
                  </p>
                  <p className="text-muted-foreground text-copy-sm">
                    {t("updated")}
                  </p>
                </div>
              </div>
              {result.errors.length > 0 ? (
                <div className="w-full max-w-lg rounded-md border p-4 text-left">
                  <h4 className="text-copy-sm mb-2 font-medium">
                    {t("resultErrors")}
                  </h4>
                  <ul className="text-copy-sm space-y-1">
                    {result.errors.map((error, index) => (
                      <li key={`${error.line}-${error.code}-${index}`}>
                        {t("lineError", {
                          line: error.line,
                          error: errorsT(error.code),
                        })}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        {phase === "preview" ? (
          <DialogFooter className="border-t px-6 py-4">
            <Button
              type="button"
              variant="outline"
              disabled={importBusy}
              onClick={chooseAnotherFile}
            >
              {t("back")}
            </Button>
            <Button
              type="button"
              disabled={importBusy || validRows.length === 0}
              onClick={() => void importRows()}
            >
              {importBusy ? (
                <LoaderCircleIcon
                  aria-hidden="true"
                  className="animate-spin motion-reduce:animate-none"
                />
              ) : null}
              {importBusy ? t("importing") : t("confirm")}
            </Button>
          </DialogFooter>
        ) : null}

        {phase === "result" ? (
          <DialogFooter className="border-t px-6 py-4">
            <Button
              type="button"
              variant="outline"
              disabled={importBusy}
              onClick={chooseAnotherFile}
            >
              {t("importAnother")}
            </Button>
            <DialogClose asChild>
              <Button type="button" disabled={importBusy}>
                {t("done")}
              </Button>
            </DialogClose>
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
