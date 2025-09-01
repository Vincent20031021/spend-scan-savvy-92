-- Create categories table for better organization
CREATE TABLE IF NOT EXISTS public.categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Insert default categories
INSERT INTO public.categories (name) VALUES 
  ('Groceries'),
  ('Household'),
  ('Personal Care'),
  ('Electronics'),
  ('Clothing'),
  ('Dining'),
  ('Other')
ON CONFLICT (name) DO NOTHING;

-- Enable RLS on categories table
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

-- Create policy for categories (readable by all authenticated users)
CREATE POLICY "Categories are viewable by all authenticated users" 
ON public.categories 
FOR SELECT 
TO authenticated
USING (true);

-- Add category_id foreign key to receipt_items table
ALTER TABLE public.receipt_items 
ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.categories(id);

-- Update existing receipt_items to have proper category_id based on category text
UPDATE public.receipt_items 
SET category_id = (
  SELECT c.id 
  FROM public.categories c 
  WHERE c.name = receipt_items.category
)
WHERE category_id IS NULL AND category IS NOT NULL;

-- Create PostgreSQL function for category spending analysis
CREATE OR REPLACE FUNCTION public.get_user_category_spending(user_uuid UUID)
RETURNS TABLE (
  category_name TEXT,
  item_count BIGINT,
  total_spent NUMERIC
)
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    c.name as category_name,
    COUNT(ri.id) as item_count,
    COALESCE(SUM(ri.price * ri.quantity), 0) as total_spent
  FROM categories c
  LEFT JOIN receipt_items ri ON c.id = ri.category_id
  LEFT JOIN receipts r ON ri.receipt_id = r.id
  WHERE r.user_id = user_uuid OR r.user_id IS NULL
  GROUP BY c.id, c.name
  HAVING COUNT(ri.id) > 0 OR c.name = 'Other'
  ORDER BY total_spent DESC;
$$;