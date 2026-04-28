import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Login.css";
import { useAuth } from "../../context/AuthContext"
import {
  cognitoSignUp,
  cognitoConfirmSignUp,
  cognitoResendCode,
} from "./cognitoAuth";

type Stage = "login" | "register" | "verify" | "forgot-email" | "forgot-verify" | "forgot-password";

function Login() {
  const [stage, setStage] = useState<Stage>("login");  //Form type shown, default is login

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [verifyCode, setVerifyCode] = useState("");                 //Cognito code, verification only
  const [loading, setLoading] = useState(false);                    //Used for button loading state
  const [passwordFocused, setPasswordFocused] = useState(false);    //Used to determine when to show password requirements
  const [showPassword, setShowPassword] = useState(false);          //Checkbox for showing password

  const navigate = useNavigate();
  const { login } = useAuth();
  const API_URL = import.meta.env.VITE_API_URL;                     //Base URL for backend API calls (EC2 instance)

  const passwordRequirements = [
    { label: "Password must be at least 8 characters", met: password.length >= 8 },
    { label: "Use a number", met: /\d/.test(password) },
    { label: "Use a lowercase letter", met: /[a-z]/.test(password) },
    { label: "Use an uppercase letter", met: /[A-Z]/.test(password) },
    { label: "Use a special character", met: /[^A-Za-z0-9]/.test(password) },
  ];
  const allRequirementsMet = passwordRequirements.every((r) => r.met);

  const handleResendCode = async () => {
    try {
      await cognitoResendCode(email);
      alert("Code resent to your email.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Login.tsx: Could not resend code.";
      alert(message);
    }
  };

  const handleForgotResendCode = async () => {
    try {
      await cognitoResendCode(email);
      alert("Code resent to your email.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Login.tsx: Could not resend code.";
      alert(message);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (stage === "forgot-email") {
        const checkRes = await fetch(`${API_URL}/check-email?email=${encodeURIComponent(email)}`);
        const checkData = await checkRes.json();
        if (checkData.available) {
          alert("No account found with that email.");
          return;
        }
        const tempPassword = "Tmp!" + Array.from(crypto.getRandomValues(new Uint8Array(12)))
          .map((b) => b.toString(36)).join("").slice(0, 12);
        try {
          await cognitoSignUp(email, tempPassword, email);
        } catch (cognitoErr: any) {
          if (cognitoErr.code === "UsernameExistsException" || cognitoErr.name === "UsernameExistsException") {
            await cognitoResendCode(email);
          } else {
            throw cognitoErr;
          }
        }
        setStage("forgot-verify");
        return;
      }

      if (stage === "forgot-verify") {
        await cognitoConfirmSignUp(email, verifyCode);
        await fetch(`${API_URL}/delete-cognito-user`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        });
        setVerifyCode("");
        setStage("forgot-password");
        return;
      }

      if (stage === "forgot-password") {
        if (!allRequirementsMet) {
          alert("Password requirements not met.");
          return;
        }
        if (password !== confirmPassword) {
          alert("Passwords do not match.");
          return;
        }
        const res = await fetch(`${API_URL}/reset-password`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, newPassword: password }),
        });
        const data = await res.json();
        if (!data.success) {
          alert(data.message || "Failed to reset password.");
          return;
        }
        alert("Password reset successfully. Please log in.");
        setStage("login");
        setPassword("");
        setConfirmPassword("");
        setEmail("");
        return;
      }

      if (stage === "verify") {
        await cognitoConfirmSignUp(email, verifyCode);

        const res = await fetch(`${API_URL}/verify-complete`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        });
        const data = await res.json();
        if (!data.success) {
          alert("Login.tsx: Verification error: " + data.message);
          return;
        }

        alert("Email verified, you are now a registered user.");
        setStage("login");
        setPassword("");
        setConfirmPassword("");
        setVerifyCode("");
        return;
      }

      if (stage === "register") {
        if (!allRequirementsMet) {
          alert("Password requirements not met.");
          return;
        }

        if (password !== confirmPassword) {
          alert("Passwords do not match.");
          return;
        }

        const res = await fetch(`${API_URL}/register`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, email, password }),
        });
        const data = await res.json();

        if (!res.ok) {
          alert(data.message);
          return;
        }

        try {
          await cognitoSignUp(email, password, username);
        } catch (cognitoErr: any) {
          if (cognitoErr.code === "UsernameExistsException") {
            await fetch(`${API_URL}/delete-cognito-user`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ email }),
            });
            await cognitoSignUp(email, password, username);
          } else {
            await fetch(`${API_URL}/register-rollback`, {
              method: "DELETE",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ email }),
            });
            throw cognitoErr;
          }
        }

        setStage("verify");
        alert("A verification code has been sent to your email.");
        return;
      }

      const res = await fetch(`${API_URL}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();

      if (data.success) {
        sessionStorage.setItem('fromLogin', '1');
        login(data);

        const el = document.querySelector('.login-box') as HTMLElement | null;
        if (el) {
          el.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
          el.style.opacity = '0';
          el.style.transform = 'scale(0.92)';
        }
        setTimeout(() => {
          navigate('/', { state: { fromLogin: true } });
        }, 400);
      } else {
        alert(data.message || "Incorrect email or password");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Login.tsx: Server error";
      alert(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">

      {/* Video background */}
      <video
        className="bg-video"
        autoPlay
        loop
        muted
        playsInline
        src="/bg.mp4"
        controls={false}
        disablePictureInPicture
        controlsList="nodownload nofullscreen noremoteplayback"
      />
      
      <div className="login-box">
        <div key={stage} className="form-slide">
        <h2>
          {stage === "login" && "Login"}
          {stage === "register" && "Sign up"}
          {stage === "verify" && "Verify Email"}
          {stage === "forgot-email" && "Forgot Password"}
          {stage === "forgot-verify" && "Check Your Email"}
          {stage === "forgot-password" && "Set New Password"}
        </h2>
        {stage === "register" && (
          <p className="subtitle">Create a new account.</p>
        )}
        {stage === "forgot-email" && (
          <p className="subtitle">Enter your account email to receive a reset code.</p>
        )}

        <form onSubmit={handleSubmit}>
          {/* Username Box, only used for registeration */}
          {stage === "register" && (
            <div className="input-group">
              <label>Username</label>
              <input
                type="text"
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
          )}

          {/* Email and Password Boxes, used for login and registration */}
          {(stage === "login" || stage === "register") && (
            <>
              <div className="input-group">
                <label>Email address</label>
                <input
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="input-group">
                <label>Password</label>
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter password"
                  value={password}
                  //These are just React events and handles 
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setPasswordFocused(true)}
                  onBlur={() => setPasswordFocused(false)}
                  onCopy={(e) => e.preventDefault()}
                  onPaste={(e) => e.preventDefault()}
                  onCut={(e) => e.preventDefault()}
                  required
                />

                {/* Password requirements, only shown during register and when focused or typing */}
                {/* When fulfilling requirements, they will be marked as met via color(css side) and symbol */}
                {stage === "register" && (passwordFocused || password.length > 0) && (
                  <ul className="password-requirements">
                    {passwordRequirements.map((req) => (
                      <li key={req.label} className={req.met ? "req-met" : "req-unmet"}>
                        <span className="req-icon">{req.met ? "✔" : "⊖"}</span>
                        {req.label}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Confirm Password, only shown during register */}
              {stage === "register" && (
                <div className="input-group">
                  <label>Confirm password</label>
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="Re-enter password"
                    value={confirmPassword}
                    onCopy={(e) => e.preventDefault()}
                    onPaste={(e) => e.preventDefault()}
                    onCut={(e) => e.preventDefault()}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                </div>
              )}

              {/* Show password checkbox, only shown during register */}
              {stage === "register" && (
                <label className="show-password-label">
                  <input
                    type="checkbox"
                    checked={showPassword}
                    onChange={() => setShowPassword(!showPassword)}
                  />
                  Show password
                </label>
              )}
            </>
          )}

          {/* Forgot password link, only shown on login stage */}
          {stage === "login" && (
            <button
              type="button"
              className="forgot-password-link"
              onClick={() => {
                setPassword("");
                setStage("forgot-email");
              }}
            >
              Forgot password?
            </button>
          )}

          {/* Forgot password, step 1: email input */}
          {stage === "forgot-email" && (
            <div className="input-group">
              <label>Email address</label>
              <input
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          )}

          {/* Forgot password, step 2: verification code */}
          {stage === "forgot-verify" && (
            <>
              <p className="verify-info">
                A 6-digit code was sent to <strong>{email}</strong>
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
                onClick={handleForgotResendCode}
              >
                Resend code
              </button>
            </>
          )}

          {/* Forgot password, step 3: new password + confirm */}
          {stage === "forgot-password" && (
            <>
              <div className="input-group">
                <label>New password</label>
                <input
                  type="password"
                  placeholder="Enter new password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setPasswordFocused(true)}
                  onBlur={() => setPasswordFocused(false)}
                  onCopy={(e) => e.preventDefault()}
                  onPaste={(e) => e.preventDefault()}
                  onCut={(e) => e.preventDefault()}
                  required
                />
                {(passwordFocused || password.length > 0) && (
                  <ul className="password-requirements">
                    {passwordRequirements.map((req) => (
                      <li key={req.label} className={req.met ? "req-met" : "req-unmet"}>
                        <span className="req-icon">{req.met ? "✔" : "⊖"}</span>
                        {req.label}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="input-group">
                <label>Confirm new password</label>
                <input
                  type="password"
                  placeholder="Re-enter new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  onCopy={(e) => e.preventDefault()}
                  onPaste={(e) => e.preventDefault()}
                  onCut={(e) => e.preventDefault()}
                  required
                />
              </div>
            </>
          )}

          {/* Verification code box, only shown during registration verification */}
          {stage === "verify" && (
            <>
              <p className="verify-info">
                A 6-digit code was sent to <strong>{email}</strong>
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

          {/* Clickable submit (Sign up/Login) buttons for forms */}
          <button type="submit" className="submit-btn" disabled={loading}>
            {loading
              ? "Please wait..."
              : stage === "login"
              ? "Login"
              : stage === "register"
              ? "Sign up"
              : stage === "verify"
              ? "Verify Email"
              : stage === "forgot-email"
              ? "Send Code"
              : stage === "forgot-verify"
              ? "Verify Code"
              : "Reset Password"}
          </button>
        </form>

        {/* Clickable toggle button for registration/login */}
        {(stage === "login" || stage === "register") && (
          <p
            onClick={() => {
              setStage(stage === "login" ? "register" : "login");
              setPassword("");
              setConfirmPassword("");
            }}
            className="toggle-text"
          >
            {stage === "register"
              ? "Have an account? Click to Sign in"
              : "No account? Click to Register"}
          </p>
        )}

        {/* To exit registration verification stage */}
        {stage === "verify" && (
          <p onClick={() => setStage("register")} className="toggle-text">
            Back to Register
          </p>
        )}

        {/* Back to login from forgot password stages */}
        {(stage === "forgot-email" || stage === "forgot-verify" || stage === "forgot-password") && (
          <p
            onClick={() => {
              setStage("login");
              setPassword("");
              setConfirmPassword("");
              setVerifyCode("");
              setEmail("");
            }}
            className="toggle-text"
          >
            Back to Login
          </p>
        )}
        </div> {/* form-slide */}
      </div>
    </div>
  );
}

export default Login;