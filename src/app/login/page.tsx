import LoginForm from "./login-form";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ next?: string }>;
}) {
  const sp = (await searchParams) ?? {};
  const nextPath = sp.next ?? "/dashboard";
  return <LoginForm nextPath={nextPath} />;
}
