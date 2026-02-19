import { useState } from "react";
import "./Login.css";

function Login() {
  //variables start off false/empty (isRegister set to false because it always start with login prompt), updates with change
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Handle submit for both login and register
  const handleSubmit = async (
    e: React.FormEvent<HTMLFormElement>
  ) => {
    e.preventDefault();

    // These urls should NOT load content when clicked
    // it is frontend acessing backend api requests to database
    // if(isRegister) then takes three values and passes, else two
    const url = isRegister
      ? "http://localhost:5000/register"
      : "http://localhost:5000/login";

    const body = isRegister
      ? { username, email, password }
      : { email, password };

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      //takes backend message if exist, such as errors like email dupe
      alert(data.message);

    } catch (err) {
      alert("Server error");
    }
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <h2>{isRegister ? "Register" : "Login"}</h2>

        <form onSubmit={handleSubmit}>
          {/* Username, only needed for register */}
          {isRegister && (
            <input
              type="text"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          )}

          {/* Email textbox */}
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          {/* Password textbox */}
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          {/* Submit Button */}
          <button type="submit" className="submit-btn">
            {isRegister ? "Register" : "Login"}
          </button>
        </form>

        {/* Toggle Mode, between login/register forms */}
        <p
          onClick={() => setIsRegister(!isRegister)}
          className="toggle-text"
        >
          {isRegister
            ? "Already have an account? Click to Login"
            : "No account? Click to Register"}
        </p>
      </div>
    </div>
  );
}

export default Login;