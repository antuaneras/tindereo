import { LoginForm } from "@/components/mobile/mobile-auth-forms";
import { redirectAuthenticatedUserToHome } from "@/lib/server/mobile-session";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  await redirectAuthenticatedUserToHome();

  return (
    <main className="mx-auto flex min-h-[100dvh] w-full max-w-[480px] items-center px-4 pb-10 pt-[calc(1rem+env(safe-area-inset-top))]">
      <LoginForm />
    </main>
  );
}
