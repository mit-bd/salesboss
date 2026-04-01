import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, X, Pencil, Trash2 } from "lucide-react";
import { FollowupProblem, QuickInfoField } from "@/hooks/useFollowupProblems";
import { useAuth } from "@/contexts/AuthContext";

interface ProblemsQuickInfoSectionProps {
  problems: FollowupProblem[];
  quickInfoFields: QuickInfoField[];
  selectedProblems: Set<string>;
  onToggleProblem: (label: string) => void;
  quickInfoValues: Record<string, string>;
  onQuickInfoChange: (fieldId: string, value: string) => void;
  isAdmin: boolean;
  onAddProblem?: (label: string) => Promise<any>;
  onEditProblem?: (id: string, label: string) => Promise<any>;
  onDeleteProblem?: (id: string) => Promise<any>;
  onAddQuickInfoField?: (label: string, fieldType: string, options: string[]) => Promise<any>;
  onDeleteQuickInfoField?: (id: string) => Promise<any>;
}

export default function ProblemsQuickInfoSection({
  problems,
  quickInfoFields,
  selectedProblems,
  onToggleProblem,
  quickInfoValues,
  onQuickInfoChange,
  isAdmin,
  onAddProblem,
  onEditProblem,
  onDeleteProblem,
  onAddQuickInfoField,
  onDeleteQuickInfoField,
}: ProblemsQuickInfoSectionProps) {
  const [newProblem, setNewProblem] = useState("");
  const [showAddProblem, setShowAddProblem] = useState(false);
  const [editingProblemId, setEditingProblemId] = useState<string | null>(null);
  const [editingProblemLabel, setEditingProblemLabel] = useState("");
  const [newFieldLabel, setNewFieldLabel] = useState("");
  const [newFieldType, setNewFieldType] = useState("text");
  const [newFieldOptions, setNewFieldOptions] = useState("");
  const [showAddField, setShowAddField] = useState(false);

  const handleAddProblem = async () => {
    if (!newProblem.trim() || !onAddProblem) return;
    await onAddProblem(newProblem.trim());
    setNewProblem("");
    setShowAddProblem(false);
  };

  const handleEditSave = async (id: string) => {
    if (!editingProblemLabel.trim() || !onEditProblem) return;
    await onEditProblem(id, editingProblemLabel.trim());
    setEditingProblemId(null);
  };

  const handleAddField = async () => {
    if (!newFieldLabel.trim() || !onAddQuickInfoField) return;
    const opts = newFieldType === "select" ? newFieldOptions.split(",").map((s) => s.trim()).filter(Boolean) : [];
    await onAddQuickInfoField(newFieldLabel.trim(), newFieldType, opts);
    setNewFieldLabel("");
    setNewFieldType("text");
    setNewFieldOptions("");
    setShowAddField(false);
  };

  return (
    <div className="space-y-4">
      {/* Problems Selection */}
      <div>
        <Label className="text-xs font-medium">সমস্যা নির্বাচন (Select Problems)</Label>
        <div className="grid grid-cols-2 gap-2 mt-2">
          {problems.map((p) => (
            <div key={p.id} className="flex items-center gap-2 group">
              <Checkbox
                id={`problem-${p.id}`}
                checked={selectedProblems.has(p.label)}
                onCheckedChange={() => onToggleProblem(p.label)}
              />
              {editingProblemId === p.id ? (
                <div className="flex items-center gap-1 flex-1">
                  <Input
                    value={editingProblemLabel}
                    onChange={(e) => setEditingProblemLabel(e.target.value)}
                    className="h-7 text-xs"
                    onKeyDown={(e) => e.key === "Enter" && handleEditSave(p.id)}
                  />
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleEditSave(p.id)}>
                    <Plus className="h-3 w-3 rotate-45" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setEditingProblemId(null)}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <>
                  <Label htmlFor={`problem-${p.id}`} className="text-xs cursor-pointer flex-1">
                    {p.label}
                  </Label>
                  {isAdmin && (
                    <div className="flex opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5"
                        onClick={() => { setEditingProblemId(p.id); setEditingProblemLabel(p.label); }}
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 text-destructive"
                        onClick={() => onDeleteProblem?.(p.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>

        {isAdmin && (
          <div className="mt-2">
            {showAddProblem ? (
              <div className="flex items-center gap-2">
                <Input
                  value={newProblem}
                  onChange={(e) => setNewProblem(e.target.value)}
                  placeholder="নতুন সমস্যা..."
                  className="h-8 text-xs"
                  onKeyDown={(e) => e.key === "Enter" && handleAddProblem()}
                />
                <Button size="sm" className="h-8 text-xs" onClick={handleAddProblem}>Add</Button>
                <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setShowAddProblem(false)}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ) : (
              <Button variant="outline" size="sm" className="text-xs gap-1 h-7" onClick={() => setShowAddProblem(true)}>
                <Plus className="h-3 w-3" /> Add Problem
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Quick Info Fields */}
      {quickInfoFields.length > 0 && (
        <div>
          <Label className="text-xs font-medium">গ্রাহক তথ্য (Customer Quick Info)</Label>
          <div className="grid grid-cols-2 gap-3 mt-2">
            {quickInfoFields.map((field) => (
              <div key={field.id} className="space-y-1 group">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground">{field.label}</Label>
                  {isAdmin && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 opacity-0 group-hover:opacity-100 text-destructive"
                      onClick={() => onDeleteQuickInfoField?.(field.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
                {field.field_type === "select" && field.options.length > 0 ? (
                  <Select
                    value={quickInfoValues[field.id] || ""}
                    onValueChange={(val) => onQuickInfoChange(field.id, val)}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="নির্বাচন করুন..." />
                    </SelectTrigger>
                    <SelectContent>
                      {field.options.map((opt) => (
                        <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    value={quickInfoValues[field.id] || ""}
                    onChange={(e) => onQuickInfoChange(field.id, e.target.value)}
                    placeholder="..."
                    className="h-8 text-xs"
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add Quick Info Field (Admin) */}
      {isAdmin && (
        <div>
          {showAddField ? (
            <div className="rounded-lg border border-border p-3 space-y-2">
              <Input
                value={newFieldLabel}
                onChange={(e) => setNewFieldLabel(e.target.value)}
                placeholder="Field label..."
                className="h-8 text-xs"
              />
              <div className="flex gap-2">
                <Select value={newFieldType} onValueChange={setNewFieldType}>
                  <SelectTrigger className="h-8 text-xs w-28">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text">Text</SelectItem>
                    <SelectItem value="select">Dropdown</SelectItem>
                  </SelectContent>
                </Select>
                {newFieldType === "select" && (
                  <Input
                    value={newFieldOptions}
                    onChange={(e) => setNewFieldOptions(e.target.value)}
                    placeholder="Options (comma separated)"
                    className="h-8 text-xs flex-1"
                  />
                )}
              </div>
              <div className="flex gap-2">
                <Button size="sm" className="h-7 text-xs" onClick={handleAddField}>Add Field</Button>
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setShowAddField(false)}>Cancel</Button>
              </div>
            </div>
          ) : (
            <Button variant="outline" size="sm" className="text-xs gap-1 h-7" onClick={() => setShowAddField(true)}>
              <Plus className="h-3 w-3" /> Add Info Field
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
