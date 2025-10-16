import { CognitoIdentityProviderClient, ConfirmSignUpCommand } from '@aws-sdk/client-cognito-identity-provider';

export const handler = async (event) => {
    const { username, confirmationCode, clientId } = JSON.parse(event.body);
    const client = new CognitoIdentityProviderClient({});
    try {
        // Confirm sign up (verify email)
        const command = new ConfirmSignUpCommand({
            ClientId: clientId,
            Username: username,
            ConfirmationCode: confirmationCode
        });
        await client.send(command);
        return {
            statusCode: 200,
            body: JSON.stringify({
                success: true,
                message: 'Email verified and user confirmed successfully'
            })
        };
    } catch (error) {
        return {
            statusCode: 400,
            body: JSON.stringify({
                success: false,
                message: error.message
            })
        };
    }
};
