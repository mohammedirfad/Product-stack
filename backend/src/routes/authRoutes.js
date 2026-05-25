import { Router } from 'express';

export function createAuthRoutes({ authService }) {
  const router = Router();

  router.post('/login', async (req, res) => {
    const session = await authService.login(req.body || {});
    if (!session) {
      return res.status(401).json({
        error: {
          code: 'invalid_credentials',
          message: 'Invalid email or password.'
        }
      });
    }

    return res.status(200).json(session);
  });

  return router;
}
