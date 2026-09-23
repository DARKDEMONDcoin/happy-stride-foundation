import { useAvatarUrl } from "@/hooks/use-avatar";
import { cn } from "@/lib/utils";
import defaultUserAvatar from "@/assets/default-user-avatar.jpg";

/** صورة المستخدم أينما ظهر حسابه — تعود للصورة الافتراضية إن لم يرفع صورة. */
export function UserAvatar({
  className,
  fallbackClassName,
}: {
  className?: string;
  fallbackClassName?: string;
}) {
  const { url, name } = useAvatarUrl();
  return (
    <img
      src={url ?? defaultUserAvatar}
      alt={url ? `صورة ${name ?? "المستخدم"}` : "الصورة الافتراضية للمستخدم"}
      loading="lazy"
      width={1024}
      height={1024}
      className={cn(
        "size-full rounded-[inherit] object-cover",
        !url && fallbackClassName,
        className,
      )}
    />
  );
}
