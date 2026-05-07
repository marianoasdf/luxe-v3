"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);
    try {
      const res = await fetch("/api/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Error");
      setMessage(data.message || "Si el email existe, se enviará un enlace para restablecer la contraseña.");
    } catch (err: any) {
      setError(err.message || "Error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-lg px-4 py-12 sm:px-6 md:py-16">
      <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-8">
        <h1 className="mb-6 text-2xl font-bold">Recuperar contraseña</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="email"
          name="email"
          placeholder="Tu email"
          className="min-h-11 w-full rounded border px-4 py-2.5"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
        />
        <button
          type="submit"
          className="min-h-11 w-full rounded bg-black px-4 py-2.5 text-white disabled:opacity-50"
          disabled={loading}
        >
          {loading ? "Enviando..." : "Enviar enlace"}
        </button>
        </form>
        {message && <div className="mt-4 text-green-600">{message}</div>}
        {error && <div className="mt-4 text-red-600">{error}</div>}
      </div>
    </div>
  );
}
