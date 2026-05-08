import dotenv from "dotenv";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { google } from "googleapis";

dotenv.config({ path: ".env.local", override: true });

const REQUIRED_SCOPES = [
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/gmail.settings.basic",
];

async function main() {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();

  if (!clientId || !clientSecret) {
    console.error("Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET in .env.local");
    process.exit(1);
  }

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, "http://localhost");

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: REQUIRED_SCOPES,
  });

  console.log("\nOpen this URL and authorize Gmail access:\n");
  console.log(authUrl);
  console.log("\nAfter authorization, paste the returned code below.\n");

  const rl = createInterface({ input, output });
  const code = (await rl.question("Code: ")).trim();
  rl.close();

  if (!code) {
    console.error("No code provided.");
    process.exit(1);
  }

  const { tokens } = await oauth2Client.getToken(code);

  if (!tokens.refresh_token) {
    console.error("No refresh_token returned. Revoke the app grant in Google Account settings, then run this again.");
    process.exit(1);
  }

  console.log("\nGOOGLE_REFRESH_TOKEN:\n");
  console.log(tokens.refresh_token);
  console.log("\nCopy this value into GOOGLE_REFRESH_TOKEN manually. It was not saved.\n");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
