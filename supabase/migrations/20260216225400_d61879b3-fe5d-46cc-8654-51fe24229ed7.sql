
-- Add current_status column to orders
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS current_status text NOT NULL DEFAULT 'pending';

-- Create followup_history table
CREATE TABLE public.followup_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  step_number integer NOT NULL CHECK (step_number BETWEEN 1 AND 5),
  note text NOT NULL DEFAULT '',
  problems_discussed text NOT NULL DEFAULT '',
  upsell_attempted boolean NOT NULL DEFAULT false,
  upsell_details text NOT NULL DEFAULT '',
  next_followup_date date,
  completed_by uuid REFERENCES auth.users(id),
  completed_by_name text NOT NULL DEFAULT '',
  completed_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(order_id, step_number)
);

-- Enable RLS
ALTER TABLE public.followup_history ENABLE ROW LEVEL SECURITY;

-- RLS policies for followup_history
CREATE POLICY "Authenticated users can view followup history"
  ON public.followup_history FOR SELECT
  USING (true);

CREATE POLICY "Admin/SubAdmin can insert followup history"
  ON public.followup_history FOR INSERT
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'sub_admin'::app_role) OR
    has_role(auth.uid(), 'sales_executive'::app_role)
  );

CREATE POLICY "Admin/SubAdmin can update followup history"
  ON public.followup_history FOR UPDATE
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'sub_admin'::app_role)
  );

CREATE POLICY "Admin can delete followup history"
  ON public.followup_history FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Enable realtime for followup_history
ALTER PUBLICATION supabase_realtime ADD TABLE public.followup_history;

-- Create index for performance
CREATE INDEX idx_followup_history_order_id ON public.followup_history(order_id);
CREATE INDEX idx_followup_history_step ON public.followup_history(order_id, step_number);

-- Create function for daily transitions (called by edge function)
CREATE OR REPLACE FUNCTION public.advance_followup_steps()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected_count integer := 0;
BEGIN
  -- Find orders where current_status = 'completed' and next_followup_date <= today and step < 5
  UPDATE public.orders o
  SET 
    followup_step = o.followup_step + 1,
    current_status = 'pending',
    followup_date = (
      SELECT fh.next_followup_date 
      FROM public.followup_history fh 
      WHERE fh.order_id = o.id AND fh.step_number = o.followup_step 
      ORDER BY fh.completed_at DESC LIMIT 1
    ),
    updated_at = now()
  WHERE 
    o.is_deleted = false
    AND o.current_status = 'completed'
    AND o.followup_step < 5
    AND EXISTS (
      SELECT 1 FROM public.followup_history fh
      WHERE fh.order_id = o.id 
        AND fh.step_number = o.followup_step
        AND fh.next_followup_date IS NOT NULL
        AND fh.next_followup_date <= CURRENT_DATE
    );
  
  GET DIAGNOSTICS affected_count = ROW_COUNT;
  RETURN affected_count;
END;
$$;
