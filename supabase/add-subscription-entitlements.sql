-- Create type for entitlement target
DO $$ BEGIN
    CREATE TYPE public.entitlement_type AS ENUM ('exam_package', 'category_access');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create entitlements table
CREATE TABLE IF NOT EXISTS public.subscription_plan_entitlements (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id uuid NOT NULL REFERENCES public.subscription_plans(id) ON DELETE CASCADE,
    target_id uuid NOT NULL, -- e.g. exam_packages.id
    entitlement_type public.entitlement_type NOT NULL,
    created_at timestamptz DEFAULT now(),
    
    -- Ensure unique link per plan-target
    UNIQUE(plan_id, target_id, entitlement_type)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_entitlements_plan ON public.subscription_plan_entitlements(plan_id);
CREATE INDEX IF NOT EXISTS idx_entitlements_target ON public.subscription_plan_entitlements(target_id);

-- RLS
ALTER TABLE public.subscription_plan_entitlements ENABLE ROW LEVEL SECURITY;

-- Everyone can read entitlements (needed for checking access)
CREATE POLICY "Everyone can read entitlements" ON public.subscription_plan_entitlements
    FOR SELECT USING (true);

-- Only admins can manage
CREATE POLICY "Admins manage entitlements" ON public.subscription_plan_entitlements
    FOR ALL
    USING (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()))
    WITH CHECK (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()));
