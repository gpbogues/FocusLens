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
 *       Check with AWS for proper documentation, here it exists as reference.
 *       
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
 * /session:
 *   post:
 *     tags: [Backend]
 *     summary: Insert a user session
 *     description: Records a completed session into the UserSession table in RDS. Called from RightSidebar.tsx when the user clicks Stop Session.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [userId, sessionStart, sessionEnd]
 *             properties:
 *               userId:
 *                 type: integer
 *                 description: FK reference to UserData.UserID
 *                 example: 1
 *               sessionStart:
 *                 type: string
 *                 description: Session start timestamp in MySQL DATETIME format (YYYY-MM-DD HH:MM:SS)
 *                 example: 2026-04-02 11:17:39
 *               sessionEnd:
 *                 type: string
 *                 description: Session end timestamp in MySQL DATETIME format (YYYY-MM-DD HH:MM:SS)
 *                 example: 2026-04-02 11:17:41
 *     responses:
 *       200:
 *         description: Session inserted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *       500:
 *         description: Session insert error
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
 *                   example: Session insert error
 */

/**
 * @swagger
 * /sessions/{userId}:
 *   get:
 *     tags: [Backend]
 *     summary: Fetch 3 most recent sessions for a user
 *     description: Retrieves the 3 most recent sessions from UserSession table for a given user, ordered by most recent first. Called from Home.tsx to populate session snapshot cards.
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *           example: 1
 *         description: FK reference to UserData.UserID
 *     responses:
 *       200:
 *         description: Sessions fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 sessions:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       sessionStart:
 *                         type: string
 *                         example: 2026-04-04T23:43:05.000Z
 *                       sessionEnd:
 *                         type: string
 *                         example: 2026-04-04T23:43:06.000Z
 *       500:
 *         description: Failed to fetch sessions
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
 *                   example: Failed to fetch sessions
 */

/**
 * @swagger
 * /register:
 *   post:
 *     tags: [Backend]
 *     summary: Register a new user
 *     description: Creates a new unverified user in RDS. User cannot log in until email is verified. If cognitoSignUp fails after this succeeds, call /register-rollback to remove the RDS row.
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
 * /register-rollback:
 *   delete:
 *     tags: [Backend]
 *     summary: Roll back a failed registration
 *     description: >
 *       Deletes an unverified RDS user row if cognitoSignUp fails after /register succeeds.
 *       Prevents the email from being permanently locked out until the 24h cleanup job runs.
 *       Only deletes rows where verified = FALSE as a safety guard against removing verified users.
 *       Called from Login.tsx if cognitoSignUp throws a non-UsernameExistsException error.
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
 *         description: Rollback successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *       500:
 *         description: Rollback failed
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
 *                   example: Rollback failed
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
 *                 userId:
 *                   type: integer
 *                   example: 1
 *                 message:
 *                   type: string
 *                   example: Please verify your email before logging in.
 */

/**
 * @swagger
 * /check-email:
 *   get:
 *     tags: [Backend]
 *     summary: Check if an email is available
 *     description: >
 *       Checks RDS to see if an email is already registered before creating a Cognito user.
 *       Called from Profile.tsx before cognitoSignUp during the email update flow.
 *       Prevents phantom Cognito users from being created for duplicate emails,
 *       since /user/email would reject the duplicate after Cognito verification with no cleanup path.
 *       Note that /user/email also checks for duplicates as a race condition guard.
 *     parameters:
 *       - in: query
 *         name: email
 *         required: true
 *         schema:
 *           type: string
 *           example: john@example.com
 *         description: Email address to check availability for
 *     responses:
 *       200:
 *         description: Availability result
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 available:
 *                   type: boolean
 *                   example: true
 *       500:
 *         description: Check failed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 available:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: Check failed
 */

/**
 * @swagger
 * /verify-complete:
 *   post:
 *     tags: [Backend]
 *     summary: Complete email verification
 *     description: Marks the user as verified in RDS (done by uEmail = ?) and deletes them from Cognito. Called after Cognito confirms the verification code.
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
 * /user/username:
 *   put:
 *     tags: [Backend]
 *     summary: Update a user's username
 *     description: Updates the uName field in RDS for the given user. Called from Profile.tsx when the user submits the username modal.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [userId, newUsername]
 *             properties:
 *               userId:
 *                 type: integer
 *                 description: FK reference to UserData.UserID
 *                 example: 1
 *               newUsername:
 *                 type: string
 *                 example: janedoe
 *     responses:
 *       200:
 *         description: Username updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *       500:
 *         description: Failed to update username
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
 *                   example: Failed to update username
 */

/**
 * @swagger
 * /user/email:
 *   put:
 *     tags: [Backend]
 *     summary: Update a user's email
 *     description: >
 *       Updates the uEmail field in RDS and deletes the temp Cognito user after verification.
 *       Called from Profile.tsx after cognitoConfirmSignUp succeeds in the email update flow.
 *       Checks for duplicate emails as a race condition guard (pre-check is done by /check-email earlier in the flow).
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [userId, newEmail]
 *             properties:
 *               userId:
 *                 type: integer
 *                 description: FK reference to UserData.UserID
 *                 example: 1
 *               newEmail:
 *                 type: string
 *                 example: newemail@example.com
 *     responses:
 *       200:
 *         description: Email update result
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Email in use
 *       500:
 *         description: Failed to update email
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
 *                   example: Failed to update email
 */

/**
 * @swagger
 * /user/password:
 *   put:
 *     tags: [Backend]
 *     summary: Update a user's password
 *     description: Verifies the current password matches before updating uPassword in RDS. Called from Profile.tsx when the user submits the password modal.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [userId, currentPassword, newPassword]
 *             properties:
 *               userId:
 *                 type: integer
 *                 description: FK reference to UserData.UserID
 *                 example: 1
 *               currentPassword:
 *                 type: string
 *                 example: OldPassword123!
 *               newPassword:
 *                 type: string
 *                 example: NewPassword456!
 *     responses:
 *       200:
 *         description: Password update result
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Current password incorrect
 *       500:
 *         description: Failed to update password
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
 *                   example: Failed to update password
 */

/**
 * @swagger
 * /delete-cognito-user:
 *   post:
 *     tags: [Backend]
 *     summary: Manually delete a Cognito user
 *     description: >
 *       Fallback endpoint to manually remove a user from Cognito by email.
 *       Uses deleteCognitoUserByEmail() which first calls listUsers to resolve the real
 *       Cognito username (a UUID) before calling adminDeleteUser, since passing email
 *       directly to adminDeleteUser causes a MissingRequiredParameter failure.
 *       Also called from Profile.tsx when the email-verify modal is closed mid-flow
 *       to clean up the orphaned Cognito user before it becomes a phantom.
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
 *       Also called from Profile.tsx during the email update flow after /check-email confirms availability.
 *       The Cognito user is deleted after verification via /verify-complete (registration) or /user/email (email update).
 *       If cognitoSignUp throws UsernameExistsException, Login.tsx calls /delete-cognito-user to clear the phantom and retries.
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
 *                 description: Real password for registration, random temp password for email update flow
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
 *       Called from Login.tsx when the user submits the verification code during registration.
 *       Also called from Profile.tsx when the user submits the code during the email update flow.
 *       On success during registration, Login.tsx then calls /verify-complete on the backend.
 *       On success during email update, Profile.tsx then calls /user/email on the backend.
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
 *       Called from Login.tsx when user clicks "Resend code" during registration verify stage.
 *       Also called from Profile.tsx when user clicks "Resend code" during the email update verify modal.
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