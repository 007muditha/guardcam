export const GoogleSignin = {
  configure: (options?: any) => {},
  hasPlayServices: async () => true,
  signIn: async () => ({ user: { email: 'mock@example.com' } }),
  signOut: async () => {},
  isSignedIn: async () => false,
  getTokens: async () => ({ accessToken: 'mock-token', idToken: 'mock-id' }),
};
export const statusCodes = { SIGN_IN_CANCELLED: 'SIGN_IN_CANCELLED', IN_PROGRESS: 'IN_PROGRESS' };
export default GoogleSignin;
