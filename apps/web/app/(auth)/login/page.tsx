"use client";

import Link from "next/link";
import { Suspense, useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { signIn, type AuthActionState } from "@/lib/actions/auth";
import { AuthLinkError } from "@/components/auth-link-error";

const initialState: AuthActionState = { error: null };

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(signIn, initialState);

  return (
    <Card className="shadow-soft">
      <CardHeader>
        <CardTitle>Log in to VitaCount</CardTitle>
      </CardHeader>
      <CardContent>
        {/* useSearchParams needs a Suspense boundary on this static page */}
        <Suspense fallback={null}>
          <AuthLinkError />
        </Suspense>
        <form action={formAction} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" required autoComplete="email" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
            />
          </div>
          {state.error ? (
            <p className="text-sm text-destructive" role="alert">
              {state.error}
            </p>
          ) : null}
          <Button type="submit" disabled={pending} className="w-full">
            {pending ? "Logging in…" : "Log in"}
          </Button>
        </form>
        <div className="mt-4 flex justify-between text-sm text-muted-foreground">
          <Link href="/signup" className="hover:underline">
            Create an account
          </Link>
          <Link href="/reset-password" className="hover:underline">
            Forgot password?
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
