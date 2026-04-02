/*
this is needed for AWS Cognito to function,
mainly used to ineract with aws apis and used their pre built functionalities for user management and authentication
*/

//AWS provided
import { UserManager } from "oidc-client-ts";
import {
  CognitoIdentityProviderClient,
  SignUpCommand,
  ConfirmSignUpCommand,
  ResendConfirmationCodeCommand,
} from "@aws-sdk/client-cognito-identity-provider";

//NEEDS TO BE UDPATED ONCE FRONTEND IS HOSTED, CURRENTLY USING LOCALHOST FOR TESTING PURPOSES
const REDIRECT_URI = "http://localhost:5173";

//Used for cognito's login page, works with signInWithHostedUI function, also used for sign out redirection
const cognitoAuthConfig = {
  authority: "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_F6PXA7rXB",
  client_id: "6i2mrsmdmtbqvt87179jp64an1",
  redirect_uri: REDIRECT_URI,
  response_type: "code",
  scope: "email openid phone",
};
export const userManager = new UserManager(cognitoAuthConfig);

//SDK Client, direct connection to cognito's API, needed to access functions
//Login.tsx uses said functions for signups and verification codes 
const cognitoClient = new CognitoIdentityProviderClient({
  region: "us-east-1",
});

const CLIENT_ID = "6i2mrsmdmtbqvt87179jp64an1";
const COGNITO_DOMAIN = "https://us-east-1f6pxa7rxb.auth.us-east-1.amazoncognito.com";

//Creates temp user in cognito to trigger email verification
export async function cognitoSignUp(email: string, password: string, username: string) {
  const command = new SignUpCommand({
    ClientId: CLIENT_ID,
    Username: email,
    Password: password,
    UserAttributes: [
      { Name: "email", Value: email },
      { Name: "preferred_username", Value: username },
    ],
  });
  return await cognitoClient.send(command);
}

//Validate verification code, user verifcation status gets updated to true afterwards
//also allows us to delete the user from cognito after verification, this is done to prevent phantom users
export async function cognitoConfirmSignUp(email: string, code: string) {
  const command = new ConfirmSignUpCommand({
    ClientId: CLIENT_ID,
    Username: email,
    ConfirmationCode: code,
  });
  return await cognitoClient.send(command);
}

//Resend verification code if user did not receive code or code expired, note slight possible delay in sends
export async function cognitoResendCode(email: string) {
  const command = new ResendConfirmationCodeCommand({
    ClientId: CLIENT_ID,
    Username: email,
  });
  return await cognitoClient.send(command);
}

export async function signInWithHostedUI() {
  await userManager.signinRedirect();
}

export function signOutRedirect() {
  window.location.href = `${COGNITO_DOMAIN}/logout?client_id=${CLIENT_ID}&logout_uri=${encodeURIComponent(REDIRECT_URI)}`;
}