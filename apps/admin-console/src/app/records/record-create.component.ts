import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { catchError, of } from 'rxjs';
import { ApiService, TenantResponse, UserResponse } from '../shared/api.service';

@Component({
  selector: 'app-record-create',
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="container" style="max-width: 600px">
      <h2>Create Encrypted Record</h2>
      <p style="color: #64748b; margin-bottom: 1.5rem">
        The payload will be encrypted at the application layer using AES-256-GCM before being stored
        in the database.
      </p>

      <div class="card">
        <form (ngSubmit)="onSubmit()">
          <div class="form-group">
            <label for="tenant">Tenant</label>
            <select
              id="tenant"
              name="tenantId"
              required
              [ngModel]="tenantId()"
              (ngModelChange)="tenantId.set($event)"
            >
              <option value="" disabled>Select a tenant</option>
              @for (t of tenants(); track t.id) {
                <option [value]="t.id">{{ t.name }}</option>
              }
            </select>
          </div>

          <div class="form-group">
            <label for="owner">Owner</label>
            <select
              id="owner"
              name="ownerId"
              required
              [ngModel]="ownerId()"
              (ngModelChange)="ownerId.set($event)"
            >
              <option value="" disabled>Select a user</option>
              @for (u of users(); track u.id) {
                <option [value]="u.id">{{ u.email }}</option>
              }
            </select>
          </div>

          <div class="form-group">
            <label for="payload">Payload (JSON)</label>
            <textarea
              id="payload"
              name="payload"
              rows="6"
              placeholder='{ "notes": "Sensitive data here" }'
              required
              [ngModel]="payloadJson()"
              (ngModelChange)="payloadJson.set($event)"
            ></textarea>
          </div>

          @if (error()) {
            <div style="color: #f87171; margin-bottom: 1rem; font-size: 0.875rem">
              {{ error() }}
            </div>
          }

          <button type="submit" class="btn btn-primary" [disabled]="submitting()">
            {{ submitting() ? 'Encrypting...' : 'Encrypt & Store' }}
          </button>
        </form>
      </div>
    </div>
  `,
})
export class RecordCreateComponent {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);

  readonly tenants = toSignal(
    this.api.getTenants().pipe(catchError(() => of([] as TenantResponse[]))),
    {
      initialValue: [] as TenantResponse[],
    },
  );
  readonly users = toSignal(this.api.getUsers().pipe(catchError(() => of([] as UserResponse[]))), {
    initialValue: [] as UserResponse[],
  });

  readonly tenantId = signal('');
  readonly ownerId = signal('');
  readonly payloadJson = signal('');
  readonly error = signal('');
  readonly submitting = signal(false);

  onSubmit() {
    this.error.set('');
    let payload: Record<string, unknown>;

    try {
      payload = JSON.parse(this.payloadJson());
    } catch {
      this.error.set('Invalid JSON payload.');
      return;
    }

    this.submitting.set(true);
    this.api
      .createRecord({ tenantId: this.tenantId(), ownerId: this.ownerId(), payload })
      .subscribe({
        next: (record) => {
          this.router.navigate(['/records', record.id]);
        },
        error: (err) => {
          this.submitting.set(false);
          this.error.set(err?.error?.detail ?? 'Failed to create record.');
        },
      });
  }
}
