import type { ReactNode } from "react";

import { AuthCard } from "@/app/_components/auth-card";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return <AuthCard>{children}</AuthCard>;
}
