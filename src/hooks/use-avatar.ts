import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/lib/data";

/**
 * رابط موقّع لصورة المستخدم الشخصية — يُقرأ مرة ويُشارَك في كل صفحات الخدمات،
 * فتظهر صورته فور اختيارها بدل الحرف الأول.
 */
export function useAvatarUrl() {
  const { data: profile } = useProfile();
  const path = (profile as { avatar_url?: string | null } | null | undefined)?.avatar_url ?? null;

  const { data } = useQuery({
    queryKey: ["avatar-url", path],
    enabled: !!path,
    staleTime: 50 * 60 * 1000,
    queryFn: async () => {
      if (!path) return null;
      const { data } = await supabase.storage.from("avatars").createSignedUrl(path, 60 * 60);
      return data?.signedUrl ?? null;
    },
  });

  return {
    url: path ? (data ?? null) : null,
    name: (profile as { full_name?: string | null } | null | undefined)?.full_name ?? null,
  };
}
