-- Drop the problematic recursive policies
DROP POLICY IF EXISTS "board_members_select_member" ON public.board_members;
DROP POLICY IF EXISTS "boards_select_member" ON public.boards;

-- Create a security definer function to check board membership (avoids recursion)
CREATE OR REPLACE FUNCTION public.is_board_member(p_board_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.board_members
    WHERE board_id = p_board_id AND user_id = p_user_id
  )
$$;

-- Recreate policies using the security definer function
CREATE POLICY "boards_select_member" ON public.boards
  FOR SELECT USING (
    owner_user_id = auth.uid() OR is_board_member(id, auth.uid())
  );

CREATE POLICY "board_members_select_member" ON public.board_members
  FOR SELECT USING (
    user_id = auth.uid() OR is_board_member(board_id, auth.uid())
  );