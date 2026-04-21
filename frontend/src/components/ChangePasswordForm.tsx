"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { authFetch } from "@/lib/api";

export default function ChangePasswordForm() {
  const { user } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  if (!user) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setMessage("");
    if (!currentPassword || !newPassword) {
      setError("Completá todos los campos.");
      return;
    }
    if (newPassword.length < 6) {
      setError("La nueva contraseña debe tener al menos 6 caracteres.");
      return;
    }
    if (newPassword !== confirm) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    setLoading(true);
    try {
      const res = await authFetch("/api/change-password", {
        method: "POST",
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Error");
      setMessage(data.message || "Contraseña cambiada correctamente.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirm("");
    } catch (err: any) {
      setError(err.message || "Error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto py-8">
      <h2 className="text-xl font-bold mb-4">Cambiar contraseña</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="password"
          name="currentPassword"
          placeholder="Contraseña actual"
          className="w-full border px-4 py-2 rounded"
          value={currentPassword}
          onChange={e => setCurrentPassword(e.target.value)}
          required
        />
        <input
          type="password"
          name="newPassword"
          placeholder="Nueva contraseña"
          className="w-full border px-4 py-2 rounded"
          value={newPassword}
          onChange={e => setNewPassword(e.target.value)}
          required
        />
        <input
          type="password"
          name="confirm"
          placeholder="Repetir nueva contraseña"
          className="w-full border px-4 py-2 rounded"
          value={confirm}
          onChange={e => setConfirm(e.target.value)}
          required
        />
        <button
          type="submit"
          className="w-full bg-black text-white py-2 rounded disabled:opacity-50"
          disabled={loading}
        >
          {loading ? "Cambiando..." : "Cambiar contraseña"}
        </button>
      </form>
      {message && <div className="mt-4 text-green-600">{message}</div>}
      {error && <div className="mt-4 text-red-600">{error}</div>}
    </div>
  );
}
