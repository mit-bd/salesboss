import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Loader2, UserPlus } from "lucide-react";
import { useTeamMembers } from "@/hooks/useTeamMembers";


interface BulkAssignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCount: number;
  onAssign: (executiveId: string, executiveName: string) => Promise<void>;
}

export default function BulkAssignDialog({
  open,
  onOpenChange,
  selectedCount,
  onAssign,
}: BulkAssignDialogProps) {
  const [saving, setSaving] = useState(false);
  const [selectedExec, setSelectedExec] = useState("");
  const { members, loading: teamLoading } = useTeamMembers();

  const allExecutives = members.map((m) => ({ id: m.userId, name: m.name }));

  const handleAssign = async () => {
    if (!selectedExec) return;
    const exec = allExecutives.find((e) => e.id === selectedExec);
    if (!exec) return;
    setSaving(true);
    try {
      await onAssign(selectedExec, exec.name);
      setSelectedExec("");
      onOpenChange(false);
    } catch {
      // handled by caller
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" />
            Assign Orders
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div className="rounded-lg bg-muted/50 p-3">
            <p className="text-sm font-medium text-foreground">{selectedCount} order{selectedCount !== 1 ? "s" : ""} selected</p>
          </div>
          <div>
            <Label className="text-xs">Assign to Sales Executive *</Label>
            <Select value={selectedExec} onValueChange={setSelectedExec}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select executive" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__unassign__">
                  <span className="text-muted-foreground">Remove Assignment</span>
                </SelectItem>
                {allExecutives.map((e) => (
                  <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
            <Button onClick={handleAssign} disabled={saving || !selectedExec}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {selectedExec === "__unassign__" ? "Remove Assignment" : "Assign"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
