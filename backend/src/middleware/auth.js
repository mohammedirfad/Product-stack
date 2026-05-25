import jwt from 'jsonwebtoken';

export function requireAuth(jwtConfig) {
  return (req, res, next) => {
    const [scheme, token] = String(req.headers.authorization || '').split(' ');
    if (scheme !== 'Bearer' || !token) {
      return res.status(401).json({
        error: {
          code: 'unauthorized',
          message: 'A valid Bearer token is required.'
        }
      });
    }

    try {
      req.user = jwt.verify(token, jwtConfig.secret, { issuer: jwtConfig.issuer });
      return next();
    } catch {
      return res.status(401).json({
        error: {
          code: 'invalid_token',
          message: 'Your session is invalid or expired. Please sign in again.'
        }
      });
    }
  };
}
