import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Login.css";
import { useAuth } from "../../context/AuthContext"
import {
  cognitoSignUp,
  cognitoConfirmSignUp,
  cognitoResendCode,
} from "./cognitoAuth";

/* 
Bug:
happened once but upon start of web app,
login/register page and logout are gone,
user profile also contained no info,

fix was to load a seperate branch that didn't contain most recent login changes,
this could be related to local/session storage, and clearing that out
*/

//NOTE: 
//this got reverted to the state prior to logout button implementation,
//as login/register sidebar buttons are removed with login form being independent and presented at the start 

//Form stages, used to determine which form to show and which API calls to make on submit
type Stage = "login" | "register" | "verify";

//Components of overall login functionality
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

  //Password requirement checks
  const passwordRequirements = [
    { label: "Password must be at least 8 characters", met: password.length >= 8 },
    { label: "Use a number", met: /\d/.test(password) },
    { label: "Use a lowercase letter", met: /[a-z]/.test(password) },
    { label: "Use an uppercase letter", met: /[A-Z]/.test(password) },
    { label: "Use a special character", met: /[^A-Za-z0-9]/.test(password) },
  ];
  const allRequirementsMet = passwordRequirements.every((r) => r.met);

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

        //Calls backend, marks user as verified in RDS AND deletes cognito's copy of user 
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

      //Register: write to RDS, then cognito sends verification email
      if (stage === "register") {
        //Check all password requirements before submitting
        if (!allRequirementsMet) {
          alert("Password requirements not met.");
          return;
        }

        //Check passwords match
        if (password !== confirmPassword) {
          alert("Passwords do not match.");
          return;
        }

        //Calls backend register API 
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

        //Cognito side, if cognitoSignUp fails after rds insert succeeds,
        //roll back the rds row so the email isn't locked until the 24h cleanup run,
        //also handles UsernameExistsException from phantom users(from abandoned email updates)
        try {
          await cognitoSignUp(email, password, username);
        } catch (cognitoErr: any) {
          if (cognitoErr.code === "UsernameExistsException") {
            //Phantom user from an abandoned email update, delete it and retry
            await fetch(`${API_URL}/delete-cognito-user`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ email }),
            });
            await cognitoSignUp(email, password, username); //retry once
          } else {
            //Any other cognito failure, roll back the rds insert
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

      //Login: RDS only, blocks unverified users 
      //Calls backend login API 
      const res = await fetch(`${API_URL}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();

      //This sections works with AuthContext to store user info globally 
      if (data.success) {
        //used for f12 console 
        console.log('login data:', data);
        login({                
          username: data.username,
          email: data.email,
          userId: data.userId,
        });

        //Scale out the login box before navigating to home
        const el = document.querySelector('.login-box') as HTMLElement | null;
        if (el) {
          el.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
          el.style.opacity = '0';
          el.style.transform = 'scale(0.92)';
        }
        //Wait for animation to finish before navigating
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

  //TEXT BOXES, BUTTONS, DIVS, AND++ SECTION 
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
        </h2>
        {stage === "register" && (
          <p className="subtitle">Create a new account.</p>
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

          {/* Verification code box, only shown during verification */}
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
              : "Verify Email"}
          </button>
        </form>

        {/* Clickable toggle button for registration/login */}
        {stage !== "verify" && (
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

        {/* To exit verification stage */}
        {stage === "verify" && (
          <p onClick={() => setStage("register")} className="toggle-text">
            Back to Register
          </p>
        )}
        </div> {/* form-slide */}
      </div>
    </div>
  );
}

export default Login;