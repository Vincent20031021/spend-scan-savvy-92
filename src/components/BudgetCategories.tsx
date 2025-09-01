import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Circle } from "lucide-react";

interface BudgetCategoriesProps {
  totalSpent: number;
  receipts: any[];
}

const BudgetCategories = ({ totalSpent, receipts }: BudgetCategoriesProps) => {
  // Calculate category breakdown from receipts
  const categoryBreakdown = receipts.reduce((acc: any, receipt: any) => {
    const category = receipt.category || 'Other';
    if (!acc[category]) {
      acc[category] = { total: 0, count: 0, budget: 1000 };
    }
    acc[category].total += receipt.total_amount || 0;
    acc[category].count += 1;
    return acc;
  }, {});

  const categoryColors: { [key: string]: string } = {
    "Groceries": "bg-primary",
    "Household": "bg-accent", 
    "Personal Care": "bg-category-personal-care",
    "Electronics": "bg-category-electronics",
    "Clothing": "bg-category-clothing",
    "Dining": "bg-category-dining",
    "Other": "bg-muted-foreground"
  };

  const categoryIcons: { [key: string]: string } = {
    "Groceries": "🛒",
    "Household": "🏠", 
    "Personal Care": "🧴",
    "Electronics": "📱",
    "Clothing": "👕",
    "Dining": "🍽️",
    "Other": "📦"
  };

  const remainingBudget = 1000 - totalSpent;

  return (
    <Card className="bg-card shadow-soft border-border/50">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Budget Category</CardTitle>
          <Plus className="w-5 h-5 text-muted-foreground" />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {Object.entries(categoryBreakdown).map(([category, data]: [string, any]) => (
          <div key={category} className="flex items-center justify-between py-3 border-b border-border/30 last:border-0">
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${categoryColors[category] || 'bg-muted-foreground'}`}>
              </div>
              <div>
                <div className="font-medium text-foreground">{category}</div>
                <div className="text-sm text-muted-foreground">
                  {data.count} transaction{data.count !== 1 ? 's' : ''}
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="font-semibold text-foreground">
                ${data.total.toFixed(0)}
              </div>
              <div className="text-xs text-muted-foreground">
                / ${data.budget.toFixed(0)}
              </div>
            </div>
          </div>
        ))}
        
        {/* Budget Summary */}
        <div className="pt-4 border-t border-border/30">
          <div className="text-lg font-bold text-primary mb-1">
            ${remainingBudget.toFixed(2)} left
          </div>
          <div className="w-full bg-muted rounded-full h-2 mb-2">
            <div 
              className="bg-primary h-2 rounded-full transition-all duration-500" 
              style={{ width: `${Math.max(0, (remainingBudget / 1000) * 100)}%` }}
            ></div>
          </div>
          <div className="text-sm text-muted-foreground">
            ${totalSpent.toFixed(2)} of $1,000.00 spent
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default BudgetCategories;