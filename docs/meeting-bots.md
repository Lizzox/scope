# Meeting integrations

## Consent and retention

Only start Scope Capture after every participant has been informed and has consented. The Discord command requires an explicit consent value and posts a visible recording notice in the channel. Imported Teams transcripts require the same confirmation in Scope. Recordings and transcripts follow the workspace retention policy.

## Discord voice bot

1. Create an application in the Discord Developer Portal and add a bot user.
2. Copy the Application ID and bot token into **Meetings → Meeting Bots → Discord**. Scope validates the credentials and encrypts the token with `SCOPE_ENCRYPTION_KEY`.
3. Use the generated **Invite to Discord** link to add the bot to a server. Scope requests only View Channel, Send Messages and Connect permissions plus the application-command scope.
4. Join a voice channel and run `/scope-start title:<title> consent:true`.
5. Run `/scope-stop`. The self-hosted runner transcribes the captured voice segments and creates a normal Scope meeting with speaker-labelled text.

Discord credentials are never returned by the API after saving. The runner reconciles newly configured bots every 30 seconds.

## Microsoft Teams

Microsoft recommends the Graph transcript APIs for meeting intelligence. The standard Cloud Communications Media Access API must not be used to persist meeting media, while application-hosted real-time media bots require specialized C# and Azure Windows infrastructure. Scope therefore imports the official Teams transcript instead of recording raw Teams media.

1. Register a Microsoft Entra application in the tenant.
2. Grant the application permission `OnlineMeetingTranscript.Read.All` and give admin consent.
3. Create an application access policy for the meeting organizer.
4. Enter Tenant ID, Client ID, Client Secret and Organizer User ID under **Meetings → Meeting Bots → Microsoft Teams**.
5. Enable transcription in the Teams meeting. After the meeting, paste its join link or Online Meeting ID into Scope and import it.

The client secret is encrypted at rest and never returned. Scope requests the transcript directly from Microsoft Graph and stores it as a regular Scope Capture meeting, ready for correction and Scope AI Summary.
