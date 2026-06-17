export const environment = {
  apiUrl: '',
  auth: {
    /** 'dev' = local mock login (no AWS needed), 'cognito' = real Cognito Hosted UI */
    mode: 'dev' as 'dev' | 'cognito',
    cognito: {
      domain: 'https://YOUR_COGNITO_DOMAIN.auth.ap-southeast-1.amazoncognito.com',
      clientId: 'YOUR_COGNITO_APP_CLIENT_ID',
      redirectUri: 'http://localhost/auth/callback',
      logoutUri: 'http://localhost/login',
      scopes: 'openid email profile',
    },
  },
};
