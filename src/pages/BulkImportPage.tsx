import AppLayout from "@/components/layout/AppLayout";
import PageHeader from "@/components/layout/PageHeader";
import { Upload, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function BulkImportPage() {
  return (
    <AppLayout>
      <PageHeader title="Bulk Import" description="Import orders from CSV or Google Sheets" />

      <div className="max-w-2xl animate-fade-in">
        <div className="rounded-xl border-2 border-dashed border-border bg-card p-12 text-center card-shadow">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10">
            <Upload className="h-7 w-7 text-primary" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-2">
            Upload your file
          </h3>
          <p className="text-sm text-muted-foreground mb-6">
            Drag and drop a CSV file, or click to browse. You can also paste a Google Sheets URL.
          </p>
          <div className="flex justify-center gap-3">
            <Button variant="outline" className="gap-2">
              <FileSpreadsheet className="h-4 w-4" /> Upload CSV
            </Button>
            <Button variant="outline" className="gap-2">
              Google Sheets URL
            </Button>
          </div>
        </div>

        <div className="mt-6 rounded-xl border border-border bg-card p-5 card-shadow">
          <h3 className="text-sm font-semibold text-foreground mb-3">Required Columns</h3>
          <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
            <span>• Customer Name *</span>
            <span>• Mobile Number *</span>
            <span>• Address *</span>
            <span>• Order Source *</span>
            <span>• Product</span>
            <span>• Price</span>
            <span>• Order Note</span>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
