module.exports = (_request, response) => {
  const firebase = {
    apiKey: process.env.FIREBASE_API_KEY || '',
    authDomain: process.env.FIREBASE_AUTH_DOMAIN || '',
    projectId: process.env.FIREBASE_PROJECT_ID || '',
    appId: process.env.FIREBASE_APP_ID || '',
  };

  response.setHeader('Cache-Control', 'no-store');
  response.status(200).json({
    configured: Object.values(firebase).every((value) => value.length > 0),
    firebase,
  });
};
