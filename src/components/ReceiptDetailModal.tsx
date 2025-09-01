import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent } from "@/components/ui/card";
import { Leaf, Calendar, Store, Receipt, Package } from "lucide-react";
import { useReceipts } from "@/hooks/useReceipts";

interface ReceiptDetailModalProps {
  receipt: {
    id: string;
    store_name: string;
    total_amount: number;
    purchase_date: string;
    category: string;
    sustainability_score: string;
    image_url?: string;
    created_at: string;
  } | null;
  isOpen: boolean;
  onClose: () => void;
}

const ReceiptDetailModal = ({ receipt, isOpen, onClose }: ReceiptDetailModalProps) => {
  const { getReceiptItems } = useReceipts();
  const [items, setItems] = useState<any[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);

  useEffect(() => {
    if (receipt && isOpen) {
      console.log('ReceiptDetailModal: Fetching items for receipt:', receipt.id);
      setLoadingItems(true);
      getReceiptItems(receipt.id)
        .then((data) => {
          console.log('ReceiptDetailModal: Items fetched:', data);
          setItems(data);
          setLoadingItems(false);
        })
        .catch((error) => {
          console.error('ReceiptDetailModal: Error fetching items:', error);
          setLoadingItems(false);
        });
    } else {
      console.log('ReceiptDetailModal: Not fetching items', { receipt: !!receipt, isOpen });
      setItems([]);
    }
  }, [receipt, isOpen, getReceiptItems]);

  if (!receipt) return null;

  const getSustainabilityColor = (score: number) => {
    if (score >= 80) return "text-sustainability-excellent";
    if (score >= 60) return "text-sustainability-good";
    if (score >= 40) return "text-sustainability-fair";
    return "text-sustainability-poor";
  };

  const getSustainabilityGrade = (score: number) => {
    if (score >= 80) return "A";
    if (score >= 60) return "B";
    if (score >= 40) return "C";
    return "D";
  };

  const categoryColors = {
    "Groceries": "bg-category-groceries",
    "Household": "bg-category-household",
    "Personal Care": "bg-category-personal-care",
    "Electronics": "bg-category-electronics",
    "Clothing": "bg-category-clothing",
    "Dining": "bg-category-dining"
  };

  const sustainabilityScore = parseInt(receipt.sustainability_score || '0');

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Store className="w-5 h-5" />
            {receipt.store_name}
          </DialogTitle>
          <DialogDescription>
            Receipt details and purchase breakdown
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Header Info */}
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Calendar className="w-4 h-4" />
                  <span className="text-sm">Purchase Date</span>
                </div>
                <p className="font-semibold">
                  {new Date(receipt.purchase_date).toLocaleDateString()}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Receipt className="w-4 h-4" />
                  <span className="text-sm">Total Amount</span>
                </div>
                <p className="font-bold text-lg">
                  ${receipt.total_amount?.toFixed(2) || '0.00'}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Category and Sustainability */}
          <div className="flex items-center justify-between">
            <Badge 
              className={`text-white ${categoryColors[receipt.category as keyof typeof categoryColors] || 'bg-secondary'}`}
            >
              {receipt.category}
            </Badge>
            
            <div className="flex items-center gap-2">
              <Leaf className={`w-4 h-4 ${getSustainabilityColor(sustainabilityScore)}`} />
              <span className={`font-medium ${getSustainabilityColor(sustainabilityScore)}`}>
                Eco Score: {getSustainabilityGrade(sustainabilityScore)} ({receipt.sustainability_score}%)
              </span>
            </div>
          </div>

          <Separator />

          {/* Receipt Items */}
          <div>
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <Package className="w-4 h-4" />
              Items ({items.length})
            </h3>
            
            {loadingItems ? (
              <div className="text-center py-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              </div>
            ) : items.length > 0 ? (
              <div className="space-y-2">
                {items.map((item) => (
                  <div key={item.id} className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                    <div className="flex-1">
                      <p className="font-medium">{item.name || item.item_name || 'Unknown Item'}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-xs">
                          {item.category}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          Qty: {item.quantity}
                        </span>
                      </div>
                    </div>
                    <p className="font-semibold">
                      ${item.price?.toFixed(2) || '0.00'}
                    </p>
                  </div>
                ))}
                
                <div className="flex justify-between items-center pt-3 mt-3 border-t">
                  <p className="font-semibold">Subtotal</p>
                  <p className="font-bold text-lg">
                    ${items.reduce((sum, item) => sum + (item.price || 0), 0).toFixed(2)}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-4">
                No items found for this receipt
              </p>
            )}
          </div>

          {/* Receipt Image */}
          {receipt.image_url && (
            <>
              <Separator />
              <div>
                <h3 className="font-semibold mb-3">Receipt Image</h3>
                <img 
                  src={receipt.image_url} 
                  alt="Receipt" 
                  className="w-full rounded-lg border"
                />
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ReceiptDetailModal;