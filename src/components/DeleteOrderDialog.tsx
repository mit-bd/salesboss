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
import { useToast } from "@/hooks/use-toast";
import { Order } from "@/types/data";

interface DeleteOrderDialogProps {
  order: Order;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm?: () => void;
  childCount?: number;
}

export default function DeleteOrderDialog({
  order,
  open,
  onOpenChange,
  onConfirm,
  childCount = 0,
}: DeleteOrderDialogProps) {
  const { toast } = useToast();

  const handleDelete = () => {
    onConfirm?.();
    toast({
      title: "Order Deleted",
      description: `Order #${order.id}${childCount > 0 ? ` and ${childCount} child order(s)` : ""} deleted.`,
      variant: "destructive",
    });
    onOpenChange(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Order #{order.id}?</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently delete order <strong>#{order.id}</strong> for{" "}
            <strong>{order.customerName}</strong>.
            {childCount > 0 && (
              <>
                {" "}
                This order has <strong>{childCount} child order(s)</strong> that
                will also be removed.
              </>
            )}
            <br />
            <br />
            This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Delete Order
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
