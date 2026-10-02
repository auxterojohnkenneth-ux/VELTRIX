"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { apiUrl } from "@/lib/api";

export default function Home() {
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setLoading(true);

    try {
      const response = await fetch(apiUrl("/auth/login"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username,
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Invalid username or password.",
        );
      }

      // Save the JWT so we can use it for protected API requests.
      sessionStorage.setItem("accessToken", data.accessToken);

      // Save the logged-in user's information.
      sessionStorage.setItem("user", JSON.stringify(data.user));

      // Redirect based on the user's role.
      switch (data.user.role) {
        case "SYSTEM_ADMIN":
          router.push("/dashboard/admin");
          break;

        case "WAREHOUSE_STAFF":
          router.push("/dashboard/warehouse");
          break;

        case "LOGISTICS_MANAGER":
          router.push("/dashboard/logistics");
          break;

        default:
          throw new Error("Unknown user role.");
      }
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Unable to connect to the server.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-page">
      <div className="login-content">
        <p className="eyebrow">VELTRIX SYSTEM</p>

        <h1>Welcome back</h1>

        <p className="subtitle">
          Sign in to access your logistics workspace.
        </p>

        <form className="login-form" onSubmit={handleLogin}>
          <div className="input-group">
            <label htmlFor="username">Username</label>

            <input
              id="username"
              type="text"
              placeholder="Enter your username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              required
            />
          </div>

          <div className="input-group">
            <label htmlFor="password">Password</label>

            <input
              id="password"
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </div>

          {error && <p className="login-error">{error}</p>}

          <button type="submit" disabled={loading}>
            {loading ? "Signing in..." : "Sign in"}
            {!loading && <span>→</span>}
          </button>
        </form>

        <p className="footer-text">
          LOGISTICS • WAREHOUSE • SUPPLY CHAIN
        </p>
      </div>
    </main>
  );
}