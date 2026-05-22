import { NextFunction, Request, Response } from 'express';
import { Pool, PoolClient } from 'pg';

export interface AuthenticatedRequest extends Request {
  dbClient?: PoolClient;
  tenantId?: string;
}

const decodeJwtPayload = (token: string): Record<string, unknown> => {
  const parts = token.split('.');
  if (parts.length < 2) {
    throw new Error('Malformed JWT token');
  }

  const payload = Buffer.from(parts[1], 'base64url').toString('utf8');
  return JSON.parse(payload) as Record<string, unknown>;
};

export const createTenantContextMiddleware = (pool: Pool) => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const authHeader = req.header('authorization') ?? '';
    const match = authHeader.match(/^Bearer\s+(.+)$/i);

    if (!match) {
      res.status(401).json({ error: 'Missing or invalid bearer token' });
      return;
    }

    let tenantId: string;

    try {
      const payload = decodeJwtPayload(match[1]);
      if (typeof payload.tenantId !== 'string' || payload.tenantId.length === 0) {
        throw new Error('tenantId claim missing');
      }
      tenantId = payload.tenantId;
    } catch {
      res.status(401).json({ error: 'Invalid token payload' });
      return;
    }

    const client = await pool.connect();

    try {
      await client.query('BEGIN');
      await client.query('SET LOCAL app.current_tenant = $1', [tenantId]);

      req.dbClient = client;
      req.tenantId = tenantId;

      res.on('finish', async () => {
        try {
          if (res.statusCode >= 400) {
            await client.query('ROLLBACK');
          } else {
            await client.query('COMMIT');
          }
        } catch {
          // no-op: avoid unhandled rejection in response lifecycle callback
        } finally {
          client.release();
        }
      });

      next();
    } catch (error) {
      await client.query('ROLLBACK');
      client.release();
      next(error);
    }
  };
};
