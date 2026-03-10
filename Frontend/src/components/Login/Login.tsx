import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Login.css";
import {
  cognitoSignUp,
  cognitoConfirmSignUp,
  cognitoResendCode,
} from "./cognitoAuth";

type Stage = "login" | "register" | "verify";

//Adding cognito introduced a few more states and functions to handle
function Login() {
  const [stage, setStage] = useState<Stage>("login"); //Form type shown, login, register, and verification
  const [username, setUsername] = useState("");       
  const [email, setEmail] = useState("");            
  const [password, setPassword] = useState("");
  const [verifyCode, setVerifyCode] = useState("");  //Cognito code, verification only
  const [loading, setLoading] = useState(false);     //Used for button loading state

  const navigate = useNavigate();

  //Resend verification code
  const handleResendCode = async () => {
    try {
      await cognitoResendCode(email);
      alert("Code resent to your email.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Login.tsx: Could not resend code.";
      alert(message);
    }
  };

  //One big handleSumbit, handles all 3 parts of form
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    try {

      //Verify: confirm code, update user verified status in RDS, 
      //signals delete to cognito user when verification is good 
      if (stage === "verify") {
        //Confirm code with cognito
        await cognitoConfirmSignUp(email, verifyCode);

        //Calls backend, marks user as verified in RDS AND deletes user from cognito
        const res = await fetch("http://100.27.212.225:5000/verify-complete", {
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
        setVerifyCode("");
        return;
      }

      //Register: write to RDS, then cognito sends verification email
      if (stage === "register") {
        //Calls backend register API 
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
      //Calls backend login API 
      const res = await fetch("http://100.27.212.225:5000/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();

      if (data.success) {
        navigate("/");
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


  //TEXT BOXES, BUTTONS, DIVS, AND++ 
  return (
    <div className="login-container">
      <div className="login-box">
        <h2>
          {stage === "login" && "Login"}
          {stage === "register" && "Register"}
          {stage === "verify" && "Verify Email"}
        </h2>

        <form onSubmit={handleSubmit}>
          {/* Username Box, only used for registeration */}
          {stage === "register" && (
            <input
              type="text"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          )}

          {/* Email and Password Boxes, used for login and registration */}
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

          {/* Verification Code Box, only used for verification */}
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

          {/* Clickable submit buttons for forms */}
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

        {/* Toggle button for registration/login */}
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

        {/* Verify button */}
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
