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
          'hsl(142, 30%, 85%)',    // Very light mint
          'hsl(160, 25%, 88%)',    // Pale teal
          'hsl(180, 20%, 90%)',    // Very pale cyan
          'hsl(200, 18%, 92%)',    // Light blue-gray
          'hsl(220, 15%, 94%)',    // Very light slate
          'hsl(150, 28%, 87%)',    // Light sage
          'hsl(170, 22%, 89%)',    // Pale seafoam
          'hsl(190, 18%, 91%)',    // Very light sky
          'hsl(210, 15%, 93%)',    // Pale periwinkle
          'hsl(140, 25%, 86%)'     // Light forest
        ],
        borderColor: [
          'hsl(142, 30%, 75%)',    // Slightly darker light mint
          'hsl(160, 25%, 78%)',    // Darker pale teal
          'hsl(180, 20%, 80%)',    // Darker very pale cyan
          'hsl(200, 18%, 82%)',    // Darker light blue-gray
          'hsl(220, 15%, 84%)',    // Darker very light slate
          'hsl(150, 28%, 77%)',    // Darker light sage
          'hsl(170, 22%, 79%)',    // Darker pale seafoam
          'hsl(190, 18%, 81%)',    // Darker very light sky
          'hsl(210, 15%, 83%)',    // Darker pale periwinkle
          'hsl(140, 25%, 76%)'     // Darker light forest
        ],
        borderWidth: 1,
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