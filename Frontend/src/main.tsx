import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { AuthProvider } from 'react-oidc-context'
import './index.css'
import App from './App.tsx'

const cognitoAuthConfig = {
  authority: "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_F6PXA7rXB",
  client_id: "6i2mrsmdmtbqvt87179jp64an1",
  redirect_uri: "http://localhost:5173",
  response_type: "code",
  scope: "email openid phone",
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* AuthProvider wrapper to provide the app with cognito authentication possible within all components */}
    <AuthProvider {...cognitoAuthConfig}>
      <App />
    </AuthProvider>
  </StrictMode>,
)

/*
VERY IMPORTANT:
swap it back to the CloudFront URL before deploying to production
meaning use envs before final deploy!!!!

Can do so after fronend is hosted 
*/