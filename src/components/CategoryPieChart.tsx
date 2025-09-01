import { useEffect, useRef, useState } from 'react';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Pie } from 'react-chartjs-2';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { PieChart as PieChartIcon } from 'lucide-react';

ChartJS.register(ArcElement, Tooltip, Legend);

interface CategoryData {
  category_name: string;
  item_count: number;
  total_spent: number;
}

export const CategoryPieChart = () => {
  const { user } = useAuth();
  const [categoryData, setCategoryData] = useState<CategoryData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCategoryData = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        console.log('Fetching category spending data for user:', user.id);
        
        const { data, error } = await supabase.rpc('get_user_category_spending', {
          user_uuid: user.id
        });

        if (error) {
          console.error('Error fetching category data:', error);
          setError('Failed to load category data');
          return;
        }

        console.log('Category data received:', data);
        setCategoryData(data || []);
        setError(null);
      } catch (err) {
        console.error('Unexpected error:', err);
        setError('An unexpected error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchCategoryData();
  }, [user]);

  const chartData = {
    labels: categoryData.map(item => item.category_name),
    datasets: [
      {
        label: 'Items by Category',
        data: categoryData.map(item => item.item_count),
        backgroundColor: [
          '#FF6B6B',    // Coral red
          '#4ECDC4',    // Turquoise
          '#45B7D1',    // Sky blue  
          '#96CEB4',    // Sage green
          '#FFEAA7',    // Warm yellow
          '#DDA0DD',    // Plum purple
          '#98D8C8',    // Mint green
          '#F7DC6F',    // Golden yellow
          '#BB8FCE',    // Lavender
          '#85C1E9'     // Light blue
        ],
        borderColor: [
          '#FF5252',    // Darker coral
          '#26A69A',    // Darker turquoise  
          '#2196F3',    // Darker blue
          '#66BB6A',    // Darker sage
          '#FFD54F',    // Darker yellow
          '#BA68C8',    // Darker plum
          '#4DB6AC',    // Darker mint
          '#FFB74D',    // Darker gold
          '#9575CD',    // Darker lavender
          '#42A5F5'     // Darker light blue
        ],
        borderWidth: 2,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'bottom' as const,
      },
      tooltip: {
        callbacks: {
          label: function(context: any) {
            const dataIndex = context.dataIndex;
            const categoryName = categoryData[dataIndex]?.category_name || '';
            const itemCount = categoryData[dataIndex]?.item_count || 0;
            const totalSpent = categoryData[dataIndex]?.total_spent || 0;
            return `${categoryName}: ${itemCount} items ($${Number(totalSpent).toFixed(2)})`;
          }
        }
      }
    },
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PieChartIcon className="w-5 h-5" />
            Spending by Category
          </CardTitle>
          <CardDescription>Your purchase breakdown by category</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PieChartIcon className="w-5 h-5" />
            Spending by Category
          </CardTitle>
          <CardDescription>Your purchase breakdown by category</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center items-center h-64">
          <p className="text-muted-foreground">{error}</p>
        </CardContent>
      </Card>
    );
  }

  if (categoryData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PieChartIcon className="w-5 h-5" />
            Spending by Category
          </CardTitle>
          <CardDescription>Your purchase breakdown by category</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center items-center h-64">
          <p className="text-muted-foreground">No category data available. Upload some receipts to see your spending breakdown!</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <PieChartIcon className="w-5 h-5" />
          Spending by Category
        </CardTitle>
        <CardDescription>Your purchase breakdown by category</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-64 flex justify-center items-center">
          <Pie data={chartData} options={chartOptions} />
        </div>
        <div className="mt-4 space-y-2">
          {categoryData.map((category, index) => (
            <div key={category.category_name} className="flex justify-between items-center text-sm">
              <div className="flex items-center gap-2">
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: chartData.datasets[0].backgroundColor[index] }}
                />
                <span>{category.category_name}</span>
              </div>
              <div className="text-right">
                <div className="font-medium">{category.item_count} items</div>
                <div className="text-muted-foreground">${Number(category.total_spent).toFixed(2)}</div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};