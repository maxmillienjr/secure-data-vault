import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { DatePipe, SlicePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { catchError, of } from 'rxjs';
import { ApiService, RecordResponse } from '../shared/api.service';

@Component({
  selector: 'app-record-list',
  imports: [RouterLink, DatePipe, SlicePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="container">
      <div
        style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem"
      >
        <h2>Encrypted Records</h2>
        <a routerLink="/records/new" class="btn btn-primary">+ Create Record</a>
      </div>

      <div class="card">
        @if (records().length > 0) {
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Tenant</th>
                <th>Version</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              @for (record of records(); track record.id) {
                <tr>
                  <td>
                    <code>{{ record.id | slice: 0 : 8 }}...</code>
                  </td>
                  <td>
                    <code>{{ record.tenantId | slice: 0 : 8 }}...</code>
                  </td>
                  <td>v{{ record.version }}</td>
                  <td>{{ record.createdAt | date: 'short' }}</td>
                  <td>
                    <a
                      [routerLink]="['/records', record.id]"
                      class="btn btn-primary"
                      style="padding: 0.25rem 0.75rem; font-size: 0.75rem"
                    >
                      View
                    </a>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        } @else {
          <p style="color: #64748b; text-align: center; padding: 2rem">
            No records found. Create one to see envelope encryption in action.
          </p>
        }
      </div>
    </div>
  `,
})
export class RecordListComponent {
  private readonly api = inject(ApiService);
  readonly records = toSignal(
    this.api.getRecords().pipe(catchError(() => of([] as RecordResponse[]))),
    {
      initialValue: [] as RecordResponse[],
    },
  );
}
