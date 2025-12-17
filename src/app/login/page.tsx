import LoginForm from "./login-form";

export const dynamic = "force-dynamic";

export default function LoginPage({
  searchParams,
}: {
  searchParams?: { next?: string };
}) {
  const nextPath = searchParams?.next ?? "/dashboard";
  return <LoginForm nextPath={nextPath} />;
}
