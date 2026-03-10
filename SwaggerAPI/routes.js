// ─────────────────────────────────────────────────────────────────────────────
// BACKEND ENDPOINTS (server.js → RDS + Cognito admin)
// Called via fetch() from Login.tsx
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * tags:
 *   - name: Backend
 *     description: Express REST API endpoints running on EC2 (port 5000)
 *   - name: Cognito SDK
 *     description: >
 *       Frontend AWS SDK calls made directly from cognitoAuth.ts to AWS Cognito.
 *       These are not HTTP endpoints — they use the @aws-sdk/client-cognito-identity-provider package.
 *       Documented here for reference only.
 */

/**
 * @swagger
 * /:
 *   get:
 *     tags: [Backend]
 *     summary: Health check
 *     description: Confirms the backend server is running
 *     responses:
 *       200:
 *         description: Server is running
 *         content:
 *           text/plain:
 *             example: Backend server is running
 */

/**
 * @swagger
 * /register:
 *   post:
 *     tags: [Backend]
 *     summary: Register a new user
 *     description: Creates a new unverified user in RDS. User cannot log in until email is verified.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [username, email, password]
 *             properties:
 *               username:
 *                 type: string
 *                 example: johndoe
 *               email:
 *                 type: string
 *                 example: john@example.com
 *               password:
 *                 type: string
 *                 example: Password123!
 *     responses:
 *       200:
 *         description: User registered successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: User registered
 *       400:
 *         description: Email already exists
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Email already exists
 */

/**
 * @swagger
 * /login:
 *   post:
 *     tags: [Backend]
 *     summary: Log in a user
 *     description: Authenticates a user against RDS. Only verified users can log in.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *                 example: john@example.com
 *               password:
 *                 type: string
 *                 example: Password123!
 *     responses:
 *       200:
 *         description: Login result
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 username:
 *                   type: string
 *                   example: johndoe
 *                 email:
 *                   type: string
 *                   example: john@example.com
 *                 message:
 *                   type: string
 *                   example: Please verify your email before logging in.
 */

/**
 * @swagger
 * /verify-complete:
 *   post:
 *     tags: [Backend]
 *     summary: Complete email verification
 *     description: Marks the user as verified in RDS and deletes them from Cognito. Called after Cognito confirms the verification code.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email:
 *                 type: string
 *                 example: john@example.com
 *     responses:
 *       200:
 *         description: Verification complete
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: Internal server error
 */

/**
 * @swagger
 * /delete-cognito-user:
 *   post:
 *     tags: [Backend]
 *     summary: Manually delete a Cognito user
 *     description: Fallback endpoint to manually remove a user from Cognito. Not called automatically.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email:
 *                 type: string
 *                 example: john@example.com
 *     responses:
 *       200:
 *         description: User deleted from Cognito
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: Internal server error
 */

// ─────────────────────────────────────────────────────────────────────────────
// COGNITO SDK FUNCTIONS (cognitoAuth.ts → AWS Cognito directly)
// Called from Login.tsx during register and verify stages
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /cognito/signup:
 *   post:
 *     tags: [Cognito SDK]
 *     summary: cognitoSignUp()
 *     description: >
 *       Frontend SDK call — NOT an HTTP endpoint.
 *       Creates a temporary Cognito user and triggers a 6-digit verification email.
 *       Called from Login.tsx after a successful /register backend call.
 *       The Cognito user is deleted after verification via /verify-complete.
 *       Uses SignUpCommand from @aws-sdk/client-cognito-identity-provider.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password, username]
 *             properties:
 *               email:
 *                 type: string
 *                 description: Used as Cognito Username (pool is configured for email alias)
 *                 example: john@example.com
 *               password:
 *                 type: string
 *                 example: Password123!
 *               username:
 *                 type: string
 *                 description: Stored as preferred_username attribute in Cognito
 *                 example: johndoe
 *     responses:
 *       200:
 *         description: Cognito user created, verification email sent
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 UserConfirmed:
 *                   type: boolean
 *                   example: false
 *                   description: Always false — user must confirm via email code
 */

/**
 * @swagger
 * /cognito/confirm:
 *   post:
 *     tags: [Cognito SDK]
 *     summary: cognitoConfirmSignUp()
 *     description: >
 *       Frontend SDK call — NOT an HTTP endpoint.
 *       Validates the 6-digit code the user received via email.
 *       Called from Login.tsx when the user submits the verification code.
 *       On success, Login.tsx then calls /verify-complete on the backend.
 *       Uses ConfirmSignUpCommand from @aws-sdk/client-cognito-identity-provider.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, code]
 *             properties:
 *               email:
 *                 type: string
 *                 description: Used as Cognito Username
 *                 example: john@example.com
 *               code:
 *                 type: string
 *                 description: 6-digit verification code from email
 *                 example: "123456"
 *     responses:
 *       200:
 *         description: Email verified successfully in Cognito
 *       400:
 *         description: Invalid or expired code
 */

/**
 * @swagger
 * /cognito/resend:
 *   post:
 *     tags: [Cognito SDK]
 *     summary: cognitoResendCode()
 *     description: >
 *       Frontend SDK call — NOT an HTTP endpoint.
 *       Resends the verification email if the code expired or wasn't received.
 *       Called from Login.tsx when user clicks the "Resend code" button.
 *       Uses ResendConfirmationCodeCommand from @aws-sdk/client-cognito-identity-provider.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email:
 *                 type: string
 *                 description: Used as Cognito Username
 *                 example: john@example.com
 *     responses:
 *       200:
 *         description: Verification code resent successfully
 *       400:
 *         description: User not found or already confirmed
 */