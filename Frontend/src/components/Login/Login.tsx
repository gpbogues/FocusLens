import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Login.css";
import {
  cognitoSignUp,
  cognitoConfirmSignUp,
  cognitoResendCode,
} from "./cognitoAuth";

type Stage = "login" | "register" | "verify";

function Login() {
  const [stage, setStage] = useState<Stage>("login");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [verifyCode, setVerifyCode] = useState("");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  const handleResendCode = async () => {
    try {
      await cognitoResendCode(email);
      alert("Code resent!");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not resend code.";
      alert(message);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    try {
      //Verify: confirm code, mark verified in RDS, delete from cognito (this is done to prevent cognito from making phantom users)
      if (stage === "verify") {
        //1, Confirm code with cognito
        await cognitoConfirmSignUp(email, verifyCode);

        //2, Single backend call: marks verified in RDS AND deletes from cognito
        const res = await fetch("http://100.27.212.225:5000/verify-complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        });
        const data = await res.json();
        if (!data.success) {
          alert("Verification error: " + data.message);
          return;
        }

        alert("Email verified, you can now log in.");
        setStage("login");
        setPassword("");
        setVerifyCode("");
        return;
      }

      //Register: write to RDS, then cognito sends verification email
      if (stage === "register") {
        const res = await fetch("http://100.27.212.225:5000/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, email, password }),
        });
        const data = await res.json();

        if (!res.ok) {
          alert(data.message);
          return;
        }

        await cognitoSignUp(email, password, username);
        setStage("verify");
        alert("A verification code has been sent to your email.");
        return;
      }

      //Login: RDS only, blocks unverified users 
      const res = await fetch("http://100.27.212.225:5000/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();

      if (data.success) {
        navigate("/");
      } else {
        alert(data.message || "Invalid email or password");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Server error";
      alert(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <h2>
          {stage === "login" && "Login"}
          {stage === "register" && "Register"}
          {stage === "verify" && "Verify Email"}
        </h2>

        <form onSubmit={handleSubmit}>
          {stage === "register" && (
            <input
              type="text"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          )}

          {(stage === "login" || stage === "register") && (
            <>
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </>
          )}

          {stage === "verify" && (
            <>
              <p className="verify-info">
                We sent a 6-digit code to <strong>{email}</strong>
              </p>
              <input
                type="text"
                placeholder="Enter verification code"
                value={verifyCode}
                onChange={(e) => setVerifyCode(e.target.value)}
                maxLength={6}
                required
              />
              <button
                type="button"
                className="resend-btn"
                onClick={handleResendCode}
              >
                Resend code
              </button>
            </>
          )}

          <button type="submit" className="submit-btn" disabled={loading}>
            {loading
              ? "Please wait..."
              : stage === "login"
              ? "Login"
              : stage === "register"
              ? "Register"
              : "Verify Email"}
          </button>
        </form>

        {stage !== "verify" && (
          <p
            onClick={() => setStage(stage === "login" ? "register" : "login")}
            className="toggle-text"
          >
            {stage === "register"
              ? "Already have an account? Click to Login"
              : "No account? Click to Register"}
          </p>
        )}

        {stage === "verify" && (
          <p onClick={() => setStage("register")} className="toggle-text">
            Back to Register
          </p>
        )}
      </div>
    </div>
  );
}

export default Login;
