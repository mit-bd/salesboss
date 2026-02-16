import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, Edit2 } from "lucide-react";
import { FollowupHistoryEntry } from "@/types/data";

interface EditFollowupDialogProps {
  entry: FollowupHistoryEntry | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: {
    followupId: string;
    note: string;
    problemsDiscussed: string;
  }) => Promise<void>;
}

export default function EditFollowupDialog({
  entry,
  open,
  onOpenChange,
  onSave,
}: EditFollowupDialogProps) {
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState("");
  const [problems, setProblems] = useState("");

  useEffect(() => {
    if (entry) {
      setNote(entry.note);
      setProblems(entry.problemsDiscussed);
    }
  }, [entry]);

  const handleSubmit = async () => {
    if (!entry) return;
    setSaving(true);
    try {
      await onSave({
        followupId: entry.id,
        note,
        problemsDiscussed: problems,
      });
      onOpenChange(false);
    } catch {
      // handled by caller
    } finally {
      setSaving(false);
    }
  };

  if (!entry) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit2 className="h-5 w-5 text-primary" />
            Edit Step {entry.stepNumber} Record
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div>
            <Label className="text-xs">Summary Note *</Label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="mt-1"
              rows={3}
            />
          </div>
          <div>
            <Label className="text-xs">Problems Discussed</Label>
            <Textarea
              value={problems}
              onChange={(e) => setProblems(e.target.value)}
              className="mt-1"
              rows={2}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
