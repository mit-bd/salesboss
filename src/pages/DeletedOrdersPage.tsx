import { useState } from "react";
import { useNavigate } from "react-router-dom";
import AppLayout from "@/components/layout/AppLayout";
import PageHeader from "@/components/layout/PageHeader";
import { useOrderStore } from "@/contexts/OrderStoreContext";
import { useRole } from "@/contexts/RoleContext";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { RotateCcw, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function DeletedOrdersPage() {
  const { deletedOrders, restoreOrder, hardDelete } = useOrderStore();
  const { isAdmin } = useRole();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [hardDeleteId, setHardDeleteId] = useState<string | null>(null);

  if (!isAdmin) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          Access restricted to Admin only.
        </div>
      </AppLayout>
    );
  }

  const handleRestore = async (id: string) => {
    await restoreOrder(id);
    toast({ title: "Order Restored", description: `Order #${id} has been restored.` });
  };

  const handleHardDelete = async () => {
    if (!hardDeleteId) return;
    await hardDelete(hardDeleteId);
    toast({ title: "Permanently Deleted", description: `Order #${hardDeleteId} permanently removed.`, variant: "destructive" });
    setHardDeleteId(null);
  };

  return (
    <AppLayout>
      <PageHeader title="Deleted Orders" description="Soft-deleted orders — restore or permanently remove" />

      <div className="rounded-xl border border-border bg-card card-shadow overflow-hidden animate-fade-in">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Order ID</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Product</TableHead>
              <TableHead className="text-right">Price</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {deletedOrders.map((order) => (
              <TableRow key={order.id}>
                <TableCell className="font-medium text-foreground">{order.id}</TableCell>
                <TableCell>
                  <p className="font-medium text-foreground">{order.customerName}</p>
                  <p className="text-xs text-muted-foreground">{order.mobile}</p>
                </TableCell>
                <TableCell className="text-muted-foreground">{order.productTitle}</TableCell>
                <TableCell className="text-right font-medium">৳{order.price}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{order.orderDate}</TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={() => handleRestore(order.id)}>
                      <RotateCcw className="h-3 w-3" /> Restore
                    </Button>
                    <Button variant="outline" size="sm" className="gap-1 text-xs text-destructive hover:text-destructive" onClick={() => setHardDeleteId(order.id)}>
                      <Trash2 className="h-3 w-3" /> Delete
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {deletedOrders.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  No deleted orders.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={!!hardDeleteId} onOpenChange={(o) => !o && setHardDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Permanently Delete Order?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove order <strong>#{hardDeleteId}</strong> and its child orders. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleHardDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Permanently Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
