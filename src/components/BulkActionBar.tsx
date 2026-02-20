import { Button } from "@/components/ui/button";
import {
  Edit2, UserPlus, ArrowRightLeft, Truck, Globe, Calendar,
  DollarSign, X, CheckCircle,
} from "lucide-react";

interface BulkActionBarProps {
  selectedCount: number;
  onClear: () => void;
  onBulkEdit: () => void;
  onAssignExecutive: () => void;
  onChangeDeliveryMethod: () => void;
  onChangeOrderSource: () => void;
  onUpdateFollowupDate?: () => void;
  onCompleteFollowup?: () => void;
}

export default function BulkActionBar({
  selectedCount,
  onClear,
  onBulkEdit,
  onAssignExecutive,
  onChangeDeliveryMethod,
  onChangeOrderSource,
  onUpdateFollowupDate,
  onCompleteFollowup,
}: BulkActionBarProps) {
  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card/95 backdrop-blur-sm shadow-lg animate-fade-in">
      <div className="mx-auto max-w-7xl px-4 py-3 flex items-center gap-3 overflow-x-auto">
        <div className="flex items-center gap-2 shrink-0">
          <span className="inline-flex items-center justify-center rounded-full bg-primary px-2.5 py-0.5 text-xs font-bold text-primary-foreground">
            {selectedCount}
          </span>
          <span className="text-sm font-medium text-foreground">Selected</span>
        </div>

        <div className="h-6 w-px bg-border shrink-0" />

        <div className="flex items-center gap-1.5 flex-wrap">
          <Button size="sm" variant="outline" className="gap-1.5 text-xs h-8" onClick={onBulkEdit}>
            <Edit2 className="h-3 w-3" /> Edit Selected
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5 text-xs h-8" onClick={onAssignExecutive}>
            <UserPlus className="h-3 w-3" /> Assign Executive
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5 text-xs h-8" onClick={onChangeDeliveryMethod}>
            <Truck className="h-3 w-3" /> Delivery Method
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5 text-xs h-8" onClick={onChangeOrderSource}>
            <Globe className="h-3 w-3" /> Order Source
          </Button>
          {onUpdateFollowupDate && (
            <Button size="sm" variant="outline" className="gap-1.5 text-xs h-8" onClick={onUpdateFollowupDate}>
              <Calendar className="h-3 w-3" /> Followup Date
            </Button>
          )}
          {onCompleteFollowup && (
            <Button size="sm" variant="outline" className="gap-1.5 text-xs h-8 border-success/30 text-success hover:bg-success/10" onClick={onCompleteFollowup}>
              <CheckCircle className="h-3 w-3" /> Complete Followup
            </Button>
          )}
        </div>

        <div className="ml-auto shrink-0">
          <Button size="sm" variant="ghost" className="gap-1 text-xs h-8 text-muted-foreground" onClick={onClear}>
            <X className="h-3 w-3" /> Clear
          </Button>
        </div>
      </div>
    </div>
  );
}
