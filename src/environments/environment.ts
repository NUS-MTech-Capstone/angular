export const environment = {
  apiUrl: 'http://localhost:3000',
  auth: {
    /** 'dev' = local mock login (no AWS needed), 'cognito' = real Cognito Hosted UI */
    mode: 'dev' as 'dev' | 'cognito',
    cognito: {
      /** e.g. https://dendenmushi.auth.ap-southeast-1.amazoncognito.com */
      domain: 'https://YOUR_COGNITO_DOMAIN.auth.ap-southeast-1.amazoncognito.com',
      clientId: 'YOUR_COGNITO_APP_CLIENT_ID',
      redirectUri: 'http://localhost:4200/auth/callback',
      logoutUri: 'http://localhost:4200/login',
      scopes: 'openid email profile',
    },
  },
};
