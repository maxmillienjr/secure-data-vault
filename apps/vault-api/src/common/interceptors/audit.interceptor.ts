import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, tap } from 'rxjs';
import { createHash } from 'node:crypto';
import { Request } from 'express';
import { AuditService } from '../../audit/audit.service';
import { AUDIT_ACTION_KEY, AUDIT_RESOURCE_TYPE_KEY } from '../decorators/audit-action.decorator';

/**
 * Global interceptor that appends an audit log entry for every
 * mutating HTTP request (POST, PUT, PATCH, DELETE).
 *
 * The audit entry is written AFTER the handler resolves successfully.
 * If the handler throws, no audit entry is written (the operation
 * did not complete).
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly auditService: AuditService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const method = request.method;

    // Only audit mutating methods
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      return next.handle();
    }

    const action = this.reflector.get<string>(AUDIT_ACTION_KEY, context.getHandler());
    const resourceType = this.reflector.get<string>(AUDIT_RESOURCE_TYPE_KEY, context.getHandler());

    // Skip routes without explicit audit metadata
    if (!action) {
      return next.handle();
    }

    const timestamp = Date.now();
    const requestHash = this.computeRequestHash(request);

    return next.handle().pipe(
      tap({
        next: async (responseBody) => {
          try {
            // Extract actor ID from JWT claims or fall back to anonymous
            const user = (request as unknown as Record<string, unknown>)['user'] as
              Record<string, string> | undefined;
            const actorId = user?.['sub'];

            const paramId = request.params?.['id'];
            const bodyId =
              typeof responseBody === 'object' && responseBody !== null
                ? ((responseBody as Record<string, unknown>)['id'] as string | undefined)
                : undefined;
            const resourceId =
              (typeof paramId === 'string' ? paramId : undefined) ?? bodyId ?? null;

            await this.auditService.append({
              actorId: actorId ?? '00000000-0000-0000-0000-000000000000',
              action,
              resourceType: resourceType ?? 'unknown',
              resourceId,
              timestamp,
              requestHash,
            });
          } catch (err) {
            // Audit failures must not break the request — log and continue
            this.logger.error('Failed to write audit entry', (err as Error).stack);
          }
        },
      }),
    );
  }

  private computeRequestHash(request: Request): string {
    const payload = JSON.stringify({
      method: request.method,
      url: request.url,
      body: request.body ? this.sortObject(request.body) : null,
    });
    return createHash('sha256').update(payload).digest('hex');
  }

  private sortObject(obj: unknown): unknown {
    if (obj === null || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map((item) => this.sortObject(item));
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(obj as Record<string, unknown>).sort()) {
      sorted[key] = this.sortObject((obj as Record<string, unknown>)[key]);
    }
    return sorted;
  }
}
