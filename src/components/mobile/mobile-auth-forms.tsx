"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { mobileLogin, mobileRegister } from "@/lib/mobile-api";

function AuthCard({
  children,
  title,
  subtitle
}: {
  children: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="rounded-[2rem] border border-[var(--line-soft)] bg-white/90 p-6 shadow-[0_20px_50px_rgba(29,22,15,0.08)] backdrop-blur-xl">
      <div className="mb-6 space-y-2">
        <h1 className="text-3xl font-black tracking-[-0.04em]">{title}</h1>
        <p className="text-sm leading-6 text-[var(--text-soft)]">{subtitle}</p>
      </div>
      {children}
    </div>
  );
}

function Field({
  label,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-soft)]">{label}</span>
      <input
        {...props}
        className="h-14 rounded-2xl border border-[var(--line-warm)] bg-[var(--bg-soft)] px-4 text-base outline-none transition placeholder:text-[var(--text-soft)] focus:border-[rgba(255,107,87,0.4)] focus:bg-white"
      />
    </label>
  );
}

function TextArea({
  label,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string }) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-soft)]">{label}</span>
      <textarea
        {...props}
        className="min-h-28 rounded-2xl border border-[var(--line-warm)] bg-[var(--bg-soft)] px-4 py-4 text-base outline-none transition placeholder:text-[var(--text-soft)] focus:border-[rgba(255,107,87,0.4)] focus:bg-white"
      />
    </label>
  );
}

export function LoginForm() {
  const router = useRouter();
  const [form, setForm] = useState({ password: "", username: "" });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <AuthCard
      title="Entrar"
      subtitle="Usuario y contraseña, sin demos intermedias. Cuando entres, la app te lleva directa al móvil shell."
    >
      <form
        className="space-y-4"
        onSubmit={async (event) => {
          event.preventDefault();
          setPending(true);
          setError(null);
          try {
            await mobileLogin(form);
            router.replace("/inicio");
            router.refresh();
          } catch (submitError) {
            setError(submitError instanceof Error ? submitError.message : "No se pudo iniciar sesion.");
          } finally {
            setPending(false);
          }
        }}
      >
        <Field
          label="Usuario"
          placeholder="@usuario"
          value={form.username}
          onChange={(event) => setForm((current) => ({ ...current, username: event.target.value }))}
        />
        <Field
          label="Contraseña"
          type="password"
          placeholder="Tu contraseña"
          value={form.password}
          onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
        />
        {error ? <p className="text-sm text-[#b84031]">{error}</p> : null}
        <button
          type="submit"
          disabled={pending}
          className="tindereo-gradient h-14 w-full rounded-2xl text-base font-bold text-white shadow-[0_18px_40px_rgba(240,138,36,0.3)] disabled:opacity-70"
        >
          {pending ? "Entrando..." : "Entrar"}
        </button>
      </form>
      <p className="mt-5 text-sm text-[var(--text-soft)]">
        ¿No tienes cuenta?{" "}
        <Link href="/registro" className="font-semibold text-[var(--coral)]">
          Crear cuenta
        </Link>
      </p>
    </AuthCard>
  );
}

export function RegisterForm() {
  const router = useRouter();
  const [form, setForm] = useState({
    bio: "",
    city: "Madrid",
    handle: "",
    name: "",
    password: ""
  });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <AuthCard
      title="Crear cuenta"
      subtitle="Al registrarte entras automáticamente con ese perfil. El nombre visible puede cambiar luego, el usuario no se duplica."
    >
      <form
        className="space-y-4"
        onSubmit={async (event) => {
          event.preventDefault();
          setPending(true);
          setError(null);
          try {
            await mobileRegister(form);
            router.replace("/inicio");
            router.refresh();
          } catch (submitError) {
            setError(submitError instanceof Error ? submitError.message : "No se pudo crear la cuenta.");
          } finally {
            setPending(false);
          }
        }}
      >
        <Field
          label="Nombre"
          placeholder="Tu nombre"
          value={form.name}
          onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
        />
        <Field
          label="Usuario"
          placeholder="@usuario"
          value={form.handle}
          onChange={(event) => setForm((current) => ({ ...current, handle: event.target.value }))}
        />
        <Field
          label="Ciudad"
          placeholder="Madrid"
          value={form.city}
          onChange={(event) => setForm((current) => ({ ...current, city: event.target.value }))}
        />
        <TextArea
          label="Bio"
          placeholder="Cuéntate en una línea o dos"
          value={form.bio}
          onChange={(event) => setForm((current) => ({ ...current, bio: event.target.value }))}
        />
        <Field
          label="Contraseña"
          type="password"
          placeholder="Mínimo 8 caracteres"
          value={form.password}
          onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
        />
        {error ? <p className="text-sm text-[#b84031]">{error}</p> : null}
        <button
          type="submit"
          disabled={pending}
          className="tindereo-gradient h-14 w-full rounded-2xl text-base font-bold text-white shadow-[0_18px_40px_rgba(240,138,36,0.3)] disabled:opacity-70"
        >
          {pending ? "Creando cuenta..." : "Crear cuenta"}
        </button>
      </form>
      <p className="mt-5 text-sm text-[var(--text-soft)]">
        ¿Ya tienes cuenta?{" "}
        <Link href="/login" className="font-semibold text-[var(--coral)]">
          Entrar
        </Link>
      </p>
    </AuthCard>
  );
}
